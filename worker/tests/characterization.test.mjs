import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

class MemoryKV {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial).map(([k, v]) => [String(k), String(v)]));
  }
  async get(key, type) {
    const value = this.map.get(String(key));
    if (value == null) return null;
    if (type === "json") return JSON.parse(value);
    return value;
  }
  async put(key, value) {
    this.map.set(String(key), String(value));
  }
  async delete(key) {
    this.map.delete(String(key));
  }
  keys() {
    return [...this.map.keys()];
  }
}

function baseEnv(overrides = {}) {
  return {
    TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
    TELEGRAM_BOT_TOKEN: "test-bot-token",
    BOT_USERNAME: "bukabmp_bot",
    PAIRINGS: new MemoryKV(),
    ...overrides
  };
}

function telegramFetchRecorder(calls) {
  return async (url, init = {}) => {
    const method = new URL(url).pathname.split("/").filter(Boolean).pop();
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({method, body});
    let result = {};
    if (method === "getChatMember") result = {status: "member", tag: ""};
    if (method === "sendMessage") result = {message_id: calls.length};
    return new Response(JSON.stringify({ok: true, result}), {
      status: 200,
      headers: {"content-type": "application/json"}
    });
  };
}

async function webhook(env, update, secret = env.TELEGRAM_WEBHOOK_SECRET) {
  return worker.fetch(new Request("https://worker.test/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": secret
    },
    body: JSON.stringify(update)
  }), env);
}

test("health keeps the current production-facing supporter/security surface", async () => {
  const response = await worker.fetch(new Request("https://worker.test/health"), baseEnv());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.version, "1.0.5-support-bot-v12-sponsor-surface");
  assert.equal(body.supporter_pass, true);
  assert.equal(body.privacy_gate_enabled, true);
  assert.equal(body.realtime_extension_state, true);
  assert.equal(body.supporter_packages.day.stars, 2);
  assert.equal(body.supporter_packages.month.stars, 50);
});

test("telegram webhook rejects a bad secret before processing an update", async () => {
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(baseEnv(), {
      update_id: 1001,
      message: {
        message_id: 1,
        from: {id: 424242, is_bot: false},
        chat: {id: 424242, type: "private"},
        text: "/start"
      }
    }, "wrong-secret");
    assert.equal(response.status, 401);
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("pair start preserves activation contract and stores only pending pair state", async () => {
  const env = baseEnv();
  const response = await worker.fetch(new Request("https://worker.test/v1/pair/start", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      extension_version: "1.0.5",
      distribution_channel: "github",
      install_id: "01234567-89ab-cdef-01234567"
    })
  }), env);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.pair_id, /^[A-Za-z0-9_-]+$/);
  assert.match(body.poll_secret, /^[A-Za-z0-9_-]+$/);
  assert.match(body.deep_link, /^https:\/\/t\.me\/bukabmp_bot\?start=/);

  const pairKeys = env.PAIRINGS.keys().filter(key => key.startsWith("pair:"));
  assert.equal(pairKeys.length, 1);
  const record = await env.PAIRINGS.get(pairKeys[0], "json");
  assert.equal(record.status, "pending");
  assert.equal(record.install_id, "01234567-89ab-cdef-01234567");
  assert.equal("token" in record, false);
});

test("membership verification still turns a valid pair into a signed activation", async () => {
  const keyPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  }, true, ["sign", "verify"]);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const pairId = "PairCodeABC1";
  const env = baseEnv({
    CHANNEL_ID: "-10011",
    GROUP_ID: "-10022",
    MEMBER_HASH_SALT: "test-salt",
    SIGNING_PRIVATE_JWK: JSON.stringify(privateJwk)
  });
  await env.PAIRINGS.put("pair:" + pairId, JSON.stringify({
    install_id: "01234567-89ab-cdef-01234567",
    status: "pending",
    created_at: Date.now()
  }));

  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(env, {
      update_id: 1002,
      message: {
        message_id: 2,
        from: {id: 424242, is_bot: false},
        chat: {id: 424242, type: "private"},
        text: "/start " + pairId
      }
    });
    assert.equal(response.status, 200);
    const record = await env.PAIRINGS.get("pair:" + pairId, "json");
    assert.equal(record.status, "verified");
    assert.match(record.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(calls.filter(call => call.method === "getChatMember").length, 2);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("group privacy gate deletes direct identifiers and does not call AI", async () => {
  let aiCalls = 0;
  const env = baseEnv({
    SUPPORT_GROUP_ID: "-10042",
    AI: {run: async () => { aiCalls += 1; return {response: "should-not-run"}; }}
  });
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(env, {
      update_id: 1003,
      message: {
        message_id: 3,
        from: {id: 424242, is_bot: false},
        chat: {id: -10042, type: "supergroup"},
        text: "email saya demo@example.invalid"
      }
    });
    assert.equal(response.status, 200);
    assert.ok(calls.some(call => call.method === "deleteMessage"));
    assert.ok(calls.some(call => call.method === "sendMessage"));
    assert.equal(aiCalls, 0);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("known group FAQ is answered deterministically before Workers AI", async () => {
  let aiCalls = 0;
  const env = baseEnv({
    SUPPORT_GROUP_ID: "-10042",
    AI: {run: async () => { aiCalls += 1; return {response: "should-not-run"}; }}
  });
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(env, {
      update_id: 1004,
      message: {
        message_id: 4,
        from: {id: 424242, is_bot: false},
        chat: {id: -10042, type: "supergroup"},
        text: "/ask kode bmp ambil dimana"
      }
    });
    assert.equal(response.status, 200);
    assert.equal(aiCalls, 0);
    const replies = calls.filter(call => call.method === "sendMessage").map(call => String(call.body.text || ""));
    assert.ok(replies.some(text => text.includes("Kode BMP")));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("sequential Telegram Stars redelivery does not double-credit Supporter", async () => {
  const env = baseEnv();
  const nonce = "AbCdEf12";
  const payload = "support:v1:day:424242:" + nonce;
  await env.PAIRINGS.put("supporter-invoice:" + nonce, JSON.stringify({
    user_id: "424242",
    package_id: "day",
    stars: 2,
    payload,
    created_at: Date.now(),
    terms_accepted_at: Date.now()
  }));

  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const paymentMessage = {
      message_id: 5,
      from: {id: 424242, is_bot: false, username: "fixture_user", first_name: "Fixture"},
      chat: {id: 424242, type: "private"},
      successful_payment: {
        currency: "XTR",
        total_amount: 2,
        invoice_payload: payload,
        telegram_payment_charge_id: "fixture-charge-001"
      }
    };

    let response = await webhook(env, {update_id: 2001, message: paymentMessage});
    assert.equal(response.status, 200);
    const first = await env.PAIRINGS.get("supporter:user:424242", "json");
    assert.equal(first.payment_count, 1);
    const firstUntil = first.supporter_until;

    response = await webhook(env, {update_id: 2002, message: paymentMessage});
    assert.equal(response.status, 200);
    const second = await env.PAIRINGS.get("supporter:user:424242", "json");
    assert.equal(second.payment_count, 1);
    assert.equal(second.supporter_until, firstUntil);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("store version policy does not force an unpublished Edge minimum", async () => {
  const env = baseEnv({
    EXTENSION_EDGE_LATEST_VERSION: "1.0.6",
    EXTENSION_EDGE_MINIMUM_VERSION: "1.0.6",
    EXTENSION_EDGE_STORE_READY: "false"
  });
  const response = await worker.fetch(new Request(
    "https://worker.test/v1/version?distribution_channel=edge&extension_version=1.0.5"
  ), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.distribution_channel, "edge");
  assert.equal(body.latest_version, "1.0.6");
  assert.equal(body.minimum_version, null);
  assert.equal(body.store_ready, false);
});

test("reviewer activation preserves the signed Store review flow", async () => {
  const keyPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  }, true, ["sign", "verify"]);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const env = baseEnv({
    STORE_REVIEWER_SECRET: "fixture-reviewer-secret",
    MEMBER_HASH_SALT: "fixture-salt",
    SIGNING_PRIVATE_JWK: JSON.stringify(privateJwk)
  });
  const pairId = "StorePair001";
  await env.PAIRINGS.put("pair:" + pairId, JSON.stringify({
    install_id: "01234567-89ab-cdef-01234567",
    distribution_channel: "edge",
    status: "pending",
    created_at: Date.now()
  }));

  const response = await worker.fetch(new Request("https://worker.test/v1/reviewer/activate", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      pair_id: pairId,
      reviewer_code: "fixture-reviewer-secret"
    })
  }), env);

  assert.equal(response.status, 200);
  const record = await env.PAIRINGS.get("pair:" + pairId, "json");
  assert.equal(record.status, "verified");
  assert.equal(record.verification_source, "store_reviewer");
  assert.match(record.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test("telegram replay guard suppresses a duplicate webhook update", async () => {
  const env = baseEnv();
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const update = {
      update_id: 3001,
      message: {
        message_id: 31,
        from: {id: 424242, is_bot: false},
        chat: {id: 424242, type: "private"},
        text: "/start"
      }
    };
    let response = await webhook(env, update);
    assert.equal(response.status, 200);
    const firstCallCount = calls.length;
    assert.ok(firstCallCount > 0);

    response = await webhook(env, update);
    assert.equal(response.status, 200);
    assert.equal(calls.length, firstCallCount);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("unknown callback is answered safely and never reaches a feature handler", async () => {
  const env = baseEnv();
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(env, {
      update_id: 3002,
      callback_query: {
        id: "cb-unknown",
        from: {id: 424242, is_bot: false},
        data: "admin:delete:user",
        message: {
          message_id: 32,
          chat: {id: 424242, type: "private"}
        }
      }
    });
    assert.equal(response.status, 200);
    const answers = calls.filter(call => call.method === "answerCallbackQuery");
    assert.equal(answers.length, 1);
    assert.equal(answers[0].body.text, "Aksi tidak dikenali.");
    assert.equal(calls.some(call => call.method === "sendInvoice"), false);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("supporter callback scope remains private-only", async () => {
  const env = baseEnv();
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(env, {
      update_id: 3003,
      callback_query: {
        id: "cb-group-support",
        from: {id: 424242, is_bot: false},
        data: "support:terms",
        message: {
          message_id: 33,
          chat: {id: -10042, type: "supergroup"}
        }
      }
    });
    assert.equal(response.status, 200);
    assert.equal(calls.some(call => call.method === "sendInvoice"), false);
    assert.equal(
      calls.some(call => call.method === "sendMessage" && String(call.body.text || "").includes("BMP Supporter Pass — Terms")),
      false
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});
