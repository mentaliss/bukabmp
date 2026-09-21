import test from "node:test";
import assert from "node:assert/strict";

import {
  activationTokenExpiryFloor,
  issueToken,
  refreshActivationToken,
  TOKEN_REFRESH_MIN_VERSION,
  TOKEN_SCHEMA_VERSION
} from "../src/features/activation.js";

class MemoryKV {
  constructor() {
    this.map = new Map();
  }
  async get(key, type) {
    const value = this.map.get(String(key));
    if (value == null) return null;
    return type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value) {
    this.map.set(String(key), String(value));
  }
}

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return Buffer.from(binary, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlJson(value) {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodePayload(token) {
  const part = token.split(".")[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = part + "=".repeat((4 - part.length % 4) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

async function signLegacyToken(privateKey, {
  installId,
  userId,
  expiresAt
}) {
  const header = {alg: "RS256", typ: "JWT"};
  const payload = {
    iss: "bmp-terbuka-community",
    aud: "bmp-terbuka-extension",
    install_id: installId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt / 1000),
    scope: ["community_access"],
    member_ref: "legacy-fixture-" + userId
  };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const input = h + "." + p;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(input)
  );
  return input + "." + b64url(new Uint8Array(sig));
}

async function fixture() {
  const keyPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  }, true, ["sign", "verify"]);
  const privateJwk = await crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey
  );

  const kv = new MemoryKV();
  const env = {
    PAIRINGS: kv,
    TELEGRAM_BOT_TOKEN: "fixture-bot-token",
    CHANNEL_ID: "-10011",
    GROUP_ID: "-10022",
    MEMBER_HASH_SALT: "fixture-salt",
    SIGNING_PRIVATE_JWK: JSON.stringify(privateJwk)
  };

  return {env, kv, keyPair};
}

function telegramMembershipFetch({member = true} = {}) {
  return async url => {
    if (!String(url).includes("getChatMember")) {
      throw new Error("unexpected fetch: " + url);
    }
    return new Response(JSON.stringify({
      ok: true,
      result: member
        ? {status: "member"}
        : {status: "left"}
    }), {
      status: 200,
      headers: {"content-type": "application/json"}
    });
  };
}

test("1.1.0 activation refresh applies tracked supporter entitlement exactly once", async () => {
  const {env, kv} = await fixture();
  const userId = 424242;
  const installId = "01234567-89ab-cdef-01234567";

  const supporterUntil = Date.now() + 24 * 60 * 60 * 1000;
  await kv.put("supporter:user:" + userId, JSON.stringify({
    user_id: String(userId),
    supporter_until: supporterUntil,
    activation_until: 0,
    activation_bonus_pending_days: 0
  }));

  const token = await issueToken(env, installId, userId);
  const firstPayload = decodePayload(token);
  assert.equal(firstPayload.token_version, TOKEN_SCHEMA_VERSION);
  assert.equal(firstPayload.sub, "tg:" + userId);
  assert.equal(firstPayload.supporter_active, true);
  assert.equal(firstPayload.supporter_label, "BMP Supporter");
  assert.ok(
    Math.abs(Number(firstPayload.supporter_until) * 1000 - supporterUntil) < 2000
  );

  const firstExpiry = Number(firstPayload.exp) * 1000;
  const supporterTarget = firstExpiry + 14 * 86400000;
  const state = await kv.get("supporter:user:" + userId, "json");
  state.activation_until = supporterTarget;
  await kv.put("supporter:user:" + userId, JSON.stringify(state));

  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramMembershipFetch();
  try {
    const refreshed = await refreshActivationToken(env, {
      token,
      installId,
      extensionVersion: "1.1.0"
    });

    assert.equal(refreshed.ok, true);
    assert.equal(refreshed.changed, true);
    assert.equal(refreshed.supporterBonusApplied, true);
    const refreshedPayload = decodePayload(refreshed.token);
    assert.equal(refreshedPayload.install_id, installId);
    assert.equal(refreshedPayload.sub, "tg:" + userId);
    assert.equal(refreshedPayload.supporter_active, true);
    assert.equal(refreshedPayload.supporter_label, "BMP Supporter");
    assert.ok(
      Math.abs(Number(refreshedPayload.supporter_until) * 1000 - supporterUntil) < 2000
    );
    assert.ok(
      Math.abs(Number(refreshedPayload.exp) * 1000 - supporterTarget) < 2000
    );

    const second = await refreshActivationToken(env, {
      token: refreshed.token,
      installId,
      extensionVersion: "1.1.0"
    });
    assert.equal(second.ok, true);
    assert.equal(second.changed, false);
    assert.equal(second.supporterBonusApplied, false);
    const secondPayload = decodePayload(second.token);
    assert.equal(secondPayload.exp, refreshedPayload.exp);
    assert.equal(secondPayload.supporter_active, true);
    assert.equal(secondPayload.supporter_label, "BMP Supporter");
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("activation refresh rejects old extension versions and wrong devices", async () => {
  const {env} = await fixture();
  const installId = "01234567-89ab-cdef-01234567";
  const token = await issueToken(env, installId, 424242);

  let result = await refreshActivationToken(env, {
    token,
    installId,
    extensionVersion: "1.0.6"
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "update_required",
    minimumVersion: TOKEN_REFRESH_MIN_VERSION
  });

  result = await refreshActivationToken(env, {
    token,
    installId: "fedcba98-7654-3210-fedcba98",
    extensionVersion: "1.1.0"
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "device_mismatch"
  });
});

test("legacy community token requires one-time re-verification for refresh", async () => {
  const {env, keyPair} = await fixture();
  const installId = "01234567-89ab-cdef-01234567";
  const token = await signLegacyToken(keyPair.privateKey, {
    installId,
    userId: 424242,
    expiresAt: Date.now() + 7 * 86400000
  });

  const result = await refreshActivationToken(env, {
    token,
    installId,
    extensionVersion: "1.1.0"
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "legacy_token"
  });
});

test("activation refresh re-checks community membership", async () => {
  const {env} = await fixture();
  const installId = "01234567-89ab-cdef-01234567";
  const token = await issueToken(env, installId, 424242);

  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramMembershipFetch({member: false});
  try {
    const result = await refreshActivationToken(env, {
      token,
      installId,
      extensionVersion: "1.1.0"
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "membership_required"
    });
  } finally {
    globalThis.fetch = oldFetch;
  }
});


test("one-time v2 re-verification can preserve a longer active legacy expiry", async () => {
  const {env, keyPair} = await fixture();
  const installId = "01234567-89ab-cdef-01234567";
  const legacyExpiry = Date.now() + 31 * 86400000;
  const legacy = await signLegacyToken(keyPair.privateKey, {
    installId,
    userId: 424242,
    expiresAt: legacyExpiry
  });

  const floor = await activationTokenExpiryFloor(env, legacy, installId);
  assert.ok(Math.abs(floor - legacyExpiry) < 2000);

  const replacement = await issueToken(env, installId, 424242, floor);
  const payload = decodePayload(replacement);
  assert.equal(payload.token_version, TOKEN_SCHEMA_VERSION);
  assert.equal(payload.sub, "tg:424242");
  assert.ok(Number(payload.exp) * 1000 + 1000 >= floor);

  assert.equal(
    await activationTokenExpiryFloor(
      env,
      legacy,
      "fedcba98-7654-3210-fedcba98"
    ),
    0
  );
});
