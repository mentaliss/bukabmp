import {tg} from "../telegram/api.js";
import {b64url, b64urlJson, importSigningKey, sha256Hex} from "../security/crypto.js";
import {auditErrorName, auditRef} from "../security/audit.js";
import {getSupporterEntitlement, putSupporterEntitlement} from "../data/supporter.js";
import {
  SUPPORTER_ACTIVATION_MAX_DAYS,
  SUPPORTER_MEMBER_TAG,
  supporterIsActive
} from "./supporter-model.js";
import {qualifyReferralAfterActivation} from "./referral-service.js";
import {recordSuccessfulActivation} from "../data/d1/activation-ledger.js";

const TOKEN_ISSUER = "bmp-terbuka-community";
const TOKEN_AUDIENCE = "bmp-terbuka-extension";
export const TOKEN_TTL_DAYS = 14;
export const PAIR_TTL_SECONDS = 15 * 60;
export const TOKEN_SCHEMA_VERSION = 2;
export const TOKEN_REFRESH_MIN_VERSION = "1.1.0";

function supporterTokenSnapshot(record, now = Date.now()) {
  const active = supporterIsActive(record, now);
  const until = active ? Number(record?.supporter_until || 0) : 0;
  return {
    active,
    until,
    label: active ? SUPPORTER_MEMBER_TAG : ""
  };
}

function versionParts(value) {
  return String(value || "")
    .split(".")
    .slice(0, 4)
    .map(x => Number.parseInt(x, 10))
    .map(x => Number.isFinite(x) ? x : 0);
}

function versionAtLeast(value, minimum) {
  const a = versionParts(value);
  const b = versionParts(minimum);
  const n = Math.max(a.length, b.length, 3);
  for (let i = 0; i < n; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

function b64urlToBytes(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function decodeB64urlJson(value) {
  return JSON.parse(
    new TextDecoder().decode(b64urlToBytes(value))
  );
}

async function importVerifyKey(env) {
  if (!env.SIGNING_PRIVATE_JWK) {
    throw new Error("SIGNING_PRIVATE_JWK secret belum diset.");
  }
  const privateJwk = JSON.parse(env.SIGNING_PRIVATE_JWK);
  const publicJwk = {
    kty: privateJwk.kty,
    n: privateJwk.n,
    e: privateJwk.e,
    alg: "RS256",
    ext: true,
    key_ops: ["verify"]
  };
  return await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"},
    false,
    ["verify"]
  );
}


async function activationExpiryForIssue(
  env,
  telegramUserId,
  minimumExpiryMs = 0
) {
  const now = Date.now();
  const baseExpiry = now + TOKEN_TTL_DAYS * 86400000;
  const signedFloor = Number(minimumExpiryMs || 0) > now
    ? Number(minimumExpiryMs)
    : 0;
  const maxExpiry = now + SUPPORTER_ACTIVATION_MAX_DAYS * 86400000;
  const record = await getSupporterEntitlement(env, telegramUserId);

  if (!record) {
    return {
      expiryMs: Math.max(baseExpiry, signedFloor),
      supporter: supporterTokenSnapshot(null, now)
    };
  }

  const trackedExpiry = Number(record.activation_until || 0);
  const pendingDays = Math.max(0, Math.min(
    SUPPORTER_ACTIVATION_MAX_DAYS - TOKEN_TTL_DAYS,
    Number(record.activation_bonus_pending_days || 0)
  ));

  let target = Math.max(
    baseExpiry,
    trackedExpiry > now ? trackedExpiry : 0,
    signedFloor
  );
  if (pendingDays > 0) target += pendingDays * 86400000;
  // Never shorten a currently valid signed token during one-time re-verification.
  // The ordinary entitlement cap still applies unless the old signed token itself
  // already carries a later expiry, in which case that signed floor wins.
  target = Math.max(signedFloor, Math.min(target, maxExpiry));

  record.activation_until = target;
  record.activation_bonus_pending_days = 0;
  record.last_activation_issued_at = now;
  await putSupporterEntitlement(env, telegramUserId, record);
  return {
    expiryMs: target,
    supporter: supporterTokenSnapshot(record, now)
  };
}

async function signCommunityToken(
  env,
  installId,
  telegramUserId,
  expiryMs,
  supporter = null
) {
  const now = Math.floor(Date.now() / 1000);
  const header = {alg: "RS256", typ: "JWT"};
  const payload = {
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    sub: "tg:" + String(telegramUserId),
    token_version: TOKEN_SCHEMA_VERSION,
    install_id: installId,
    iat: now,
    exp: Math.max(now + 60, Math.floor(Number(expiryMs) / 1000)),
    scope: ["community_access"],
    supporter_active: supporter?.active === true,
    supporter_until: supporter?.active
      ? Math.max(0, Math.floor(Number(supporter.until || 0) / 1000))
      : 0,
    supporter_label: supporter?.active ? String(supporter.label || SUPPORTER_MEMBER_TAG) : "",
    member_ref: await sha256Hex(
      "tg:" + telegramUserId + ":" + (env.MEMBER_HASH_SALT || "")
    )
  };

  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const signingInput = h + "." + p;
  const key = await importSigningKey(env);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  return signingInput + "." + b64url(new Uint8Array(sig));
}

export async function issueToken(
  env,
  installId,
  telegramUserId,
  minimumExpiryMs = 0
) {
  const issue = await activationExpiryForIssue(
    env,
    telegramUserId,
    minimumExpiryMs
  );
  return await signCommunityToken(
    env,
    installId,
    telegramUserId,
    issue.expiryMs,
    issue.supporter
  );
}

export async function activationTokenReauthFloor(
  env,
  token,
  installId
) {
  if (!token || !installId) return {expiryMs: 0, memberRef: ""};
  const verified = await verifyIssuedToken(env, token);
  if (!verified.ok) return {expiryMs: 0, memberRef: ""};
  if (String(verified.payload?.install_id || "") !== String(installId)) {
    return {expiryMs: 0, memberRef: ""};
  }
  const expiryMs = Number(verified.payload?.exp || 0) * 1000;
  const memberRef = String(verified.payload?.member_ref || "");
  if (expiryMs <= Date.now() || !memberRef) {
    return {expiryMs: 0, memberRef: ""};
  }
  return {expiryMs, memberRef};
}

export async function activationTokenExpiryFloor(
  env,
  token,
  installId
) {
  return (await activationTokenReauthFloor(env, token, installId)).expiryMs;
}

export async function preservedReauthExpiryForUser(
  env,
  record,
  userId
) {
  const expectedMemberRef = await sha256Hex(
    "tg:" + userId + ":" + (env.MEMBER_HASH_SALT || "")
  );
  return String(record?.minimum_expiry_member_ref || "") === expectedMemberRef
    ? Math.max(0, Number(record?.minimum_expiry_ms || 0))
    : 0;
}

async function verifyIssuedToken(env, token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return {ok: false, reason: "format"};

    const header = decodeB64urlJson(parts[0]);
    const payload = decodeB64urlJson(parts[1]);
    if (header?.alg !== "RS256") return {ok: false, reason: "alg"};
    if (payload?.iss !== TOKEN_ISSUER) return {ok: false, reason: "issuer"};
    if (payload?.aud !== TOKEN_AUDIENCE) return {ok: false, reason: "audience"};

    const now = Math.floor(Date.now() / 1000);
    if (!Number(payload?.exp) || Number(payload.exp) <= now) {
      return {ok: false, reason: "expired", payload};
    }
    if (
      !Array.isArray(payload?.scope) ||
      !payload.scope.map(String).includes("community_access")
    ) {
      return {ok: false, reason: "scope"};
    }

    const key = await importVerifyKey(env);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    return valid
      ? {ok: true, payload}
      : {ok: false, reason: "signature"};
  } catch {
    return {ok: false, reason: "invalid"};
  }
}

async function activationExpiryForRefresh(
  env,
  telegramUserId,
  currentExpiryMs
) {
  const now = Date.now();
  const maxExpiry = now + SUPPORTER_ACTIVATION_MAX_DAYS * 86400000;
  const current = Number(currentExpiryMs || 0);
  const record = await getSupporterEntitlement(env, telegramUserId);

  if (!record) {
    return {
      expiryMs: current,
      changed: false,
      supporterBonusApplied: false,
      supporter: supporterTokenSnapshot(null, now)
    };
  }

  const trackedExpiry = Number(record.activation_until || 0);
  const pendingDays = Math.max(0, Math.min(
    SUPPORTER_ACTIVATION_MAX_DAYS - TOKEN_TTL_DAYS,
    Number(record.activation_bonus_pending_days || 0)
  ));

  let target = Math.max(
    current,
    trackedExpiry > now ? trackedExpiry : 0
  );
  if (pendingDays > 0) {
    target += pendingDays * 86400000;
  }
  // The server-side cap may limit new entitlement growth, but refresh must
  // never shorten an already-valid signed token (including a preserved legacy
  // expiry floor that is temporarily beyond the ordinary cap).
  target = Math.max(current, Math.min(target, maxExpiry));

  const changed = target > current + 1000;
  const supporterBonusApplied = Boolean(
    changed &&
    (pendingDays > 0 || trackedExpiry > current + 1000)
  );

  if (
    pendingDays > 0 ||
    Number(record.activation_until || 0) !== target
  ) {
    record.activation_until = target;
    record.activation_bonus_pending_days = 0;
    record.last_activation_issued_at = now;
    await putSupporterEntitlement(env, telegramUserId, record);
  }

  return {
    expiryMs: target,
    changed,
    supporterBonusApplied,
    supporter: supporterTokenSnapshot(record, now)
  };
}

export async function refreshActivationToken(
  env,
  {
    token,
    installId,
    extensionVersion
  }
) {
  if (!versionAtLeast(extensionVersion, TOKEN_REFRESH_MIN_VERSION)) {
    return {
      ok: false,
      reason: "update_required",
      minimumVersion: TOKEN_REFRESH_MIN_VERSION
    };
  }

  const verified = await verifyIssuedToken(env, token);
  if (!verified.ok) {
    return {ok: false, reason: "invalid_token"};
  }

  const payload = verified.payload;
  if (
    Number(payload?.token_version || 0) < TOKEN_SCHEMA_VERSION ||
    !/^tg:\d+$/.test(String(payload?.sub || ""))
  ) {
    return {ok: false, reason: "legacy_token"};
  }

  if (
    !/^[0-9a-fA-F-]{20,64}$/.test(String(installId || "")) ||
    String(payload.install_id || "") !== String(installId)
  ) {
    return {ok: false, reason: "device_mismatch"};
  }

  const userId = Number(String(payload.sub).slice(3));
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return {ok: false, reason: "invalid_subject"};
  }

  const membership = await checkMembership(env, userId);
  if (!membership.channel || !membership.group) {
    return {ok: false, reason: "membership_required"};
  }

  const currentExpiryMs = Number(payload.exp) * 1000;
  const expiry = await activationExpiryForRefresh(
    env,
    userId,
    currentExpiryMs
  );
  const refreshedToken = await signCommunityToken(
    env,
    installId,
    userId,
    expiry.expiryMs,
    expiry.supporter
  );

  return {
    ok: true,
    token: refreshedToken,
    expiresAt: expiry.expiryMs,
    changed: expiry.changed,
    supporterBonusApplied: expiry.supporterBonusApplied
  };
}

export function memberOk(member) {
  if (!member) return false;
  if (["creator", "administrator", "member"].includes(member.status)) return true;
  return member.status === "restricted" && member.is_member === true;
}

export async function checkMembership(env, userId) {
  if (!env.CHANNEL_ID || !env.GROUP_ID) {
    throw new Error("CHANNEL_ID / GROUP_ID belum dikonfigurasi.");
  }
  const [channel, group] = await Promise.all([
    tg(env, "getChatMember", {chat_id: env.CHANNEL_ID, user_id: userId}),
    tg(env, "getChatMember", {chat_id: env.GROUP_ID, user_id: userId})
  ]);
  return {
    channel: memberOk(channel),
    group: memberOk(group)
  };
}

function joinKeyboard(env, pairId) {
  const rows = [];
  if (env.CHANNEL_URL) rows.push([{text: "Gabung Buka BMP", url: env.CHANNEL_URL}]);
  if (env.GROUP_URL) rows.push([{text: "Gabung Group Terbuka", url: env.GROUP_URL}]);
  rows.push([{text: "Cek lagi", callback_data: "verify:" + pairId}]);
  return {inline_keyboard: rows};
}

async function sendMembershipResult(env, chatId, pairId, memberships) {
  const missing = [];
  if (!memberships.channel) missing.push("Buka BMP");
  if (!memberships.group) missing.push("Group Terbuka");

  if (missing.length) {
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text:
        "Belum lengkap.\n\nGabung dulu: " + missing.join(" + ") + ".\n" +
        "Setelah itu tekan tombol Cek lagi.",
      reply_markup: joinKeyboard(env, pairId)
    });
    return false;
  }
  return true;
}

export async function verifyPairForUser(env, pairId, userId, chatId) {
  const key = "pair:" + pairId;
  const record = await env.PAIRINGS.get(key, "json");

  if (!record) {
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text: "Sesi aktivasi sudah tidak berlaku. Buka BMP Terbuka dan mulai verifikasi lagi."
    });
    return {ok: false, reason: "expired"};
  }

  let memberships;
  try {
    memberships = await checkMembership(env, userId);
  } catch (error) {
    console.error("membership_check_failed", {
      pair_ref: await auditRef(env, "pair", pairId),
      user_ref: await auditRef(env, "telegram-user", userId),
      error_name: auditErrorName(error)
    });
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text:
        "⚠️ Verifikasi keanggotaan belum dapat dilakukan.\n\n" +
        "Pastikan bot menjadi admin di Buka BMP dan Group Terbuka, lalu coba lagi."
    }).catch(() => {});
    return {ok: false, reason: "membership_check_error"};
  }

  const pass = await sendMembershipResult(env, chatId, pairId, memberships);
  if (!pass) return {ok: false, reason: "membership"};

  let token;
  try {
    const preservedExpiry = await preservedReauthExpiryForUser(
      env,
      record,
      userId
    );

    token = await issueToken(
      env,
      record.install_id,
      userId,
      preservedExpiry
    );
  } catch (error) {
    console.error("token_issue_failed", {
      pair_ref: await auditRef(env, "pair", pairId),
      error_name: auditErrorName(error)
    });
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text:
        "⚠️ Keanggotaan terverifikasi, tetapi token aktivasi belum dapat dibuat.\n\n" +
        "Coba lagi setelah konfigurasi backend diperbaiki."
    }).catch(() => {});
    return {ok: false, reason: "token_issue_error"};
  }

  const verified = {
    ...record,
    status: "verified",
    token,
    verified_at: Date.now()
  };

  await env.PAIRINGS.put(key, JSON.stringify(verified), {
    expirationTtl: PAIR_TTL_SECONDS
  });

  try {
    await recordSuccessfulActivation(env, userId);
  } catch (error) {
    console.error("activation_ledger_record_failed", {
      user_ref: await auditRef(env, "telegram-user", userId),
      error_name: auditErrorName(error)
    });
  }

  // Referral qualification is secondary to activation. Await it so Workers
  // cannot terminate the reward write after the response, but swallow failures
  // so a referral problem can never invalidate a successful activation.
  try {
    await qualifyReferralAfterActivation(env, userId);
  } catch (error) {
    console.error("referral_qualification_failed", {
      user_ref: await auditRef(env, "telegram-user", userId),
      error_name: auditErrorName(error)
    });
  }

  await tg(env, "sendMessage", {
    chat_id: chatId,
    text:
      "✅ Aktivasi BMP Terbuka berhasil.\n\n" +
      "Kembali ke extension. Aktivasi akan terdeteksi otomatis; tombol Cek sekarang tersedia jika diperlukan."
  }).catch(() => {});

  return {ok: true};
}
