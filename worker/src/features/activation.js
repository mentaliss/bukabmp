import {tg} from "../telegram/api.js";
import {b64url, b64urlJson, importSigningKey, sha256Hex} from "../security/crypto.js";
import {getSupporterEntitlement, putSupporterEntitlement} from "../data/supporter.js";
import {SUPPORTER_ACTIVATION_MAX_DAYS} from "./supporter-model.js";

const TOKEN_ISSUER = "bmp-terbuka-community";
const TOKEN_AUDIENCE = "bmp-terbuka-extension";
const TOKEN_TTL_DAYS = 14;
export const PAIR_TTL_SECONDS = 15 * 60;

async function activationExpiryForIssue(env, telegramUserId) {
  const now = Date.now();
  const baseExpiry = now + TOKEN_TTL_DAYS * 86400000;
  const maxExpiry = now + SUPPORTER_ACTIVATION_MAX_DAYS * 86400000;
  const record = await getSupporterEntitlement(env, telegramUserId);

  // Preserve production behavior: normal community activation is stateless
  // after the short pairing record expires. Existing Supporter entitlement may
  // carry activation bonus bookkeeping.
  if (!record) return baseExpiry;

  const trackedExpiry = Number(record.activation_until || 0);
  const pendingDays = Math.max(0, Math.min(
    SUPPORTER_ACTIVATION_MAX_DAYS - TOKEN_TTL_DAYS,
    Number(record.activation_bonus_pending_days || 0)
  ));

  let target = Math.max(baseExpiry, trackedExpiry > now ? trackedExpiry : 0);
  if (pendingDays > 0) target += pendingDays * 86400000;
  target = Math.min(target, maxExpiry);

  record.activation_until = target;
  record.activation_bonus_pending_days = 0;
  record.last_activation_issued_at = now;
  await putSupporterEntitlement(env, telegramUserId, record);
  return target;
}

async function issueToken(env, installId, telegramUserId) {
  const now = Math.floor(Date.now() / 1000);
  const expiryMs = await activationExpiryForIssue(env, telegramUserId);
  const header = {alg: "RS256", typ: "JWT"};
  const payload = {
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    install_id: installId,
    iat: now,
    exp: Math.max(now + 60, Math.floor(expiryMs / 1000)),
    scope: ["community_access"],
    member_ref: await sha256Hex("tg:" + telegramUserId + ":" + (env.MEMBER_HASH_SALT || ""))
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
      pairId,
      userId,
      error: String(error?.message || error)
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
    token = await issueToken(env, record.install_id, userId);
  } catch (error) {
    console.error("token_issue_failed", {
      pairId,
      error: String(error?.message || error)
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

  await tg(env, "sendMessage", {
    chat_id: chatId,
    text:
      "✅ Aktivasi BMP Terbuka berhasil.\n\n" +
      "Kembali ke extension. Aktivasi akan terdeteksi otomatis; tombol Cek sekarang tersedia jika diperlukan."
  }).catch(() => {});

  return {ok: true};
}
