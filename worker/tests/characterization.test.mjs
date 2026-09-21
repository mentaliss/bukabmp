import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {sha256Hex} from "../src/security/crypto.js";

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
  assert.equal(body.bot_v2_d1_bound, false);
  assert.equal(body.bot_v2_d1_readable, false);
  assert.equal(body.bot_v2_d1_write_enabled, false);
  assert.equal(body.bot_v2_d1_replay_enabled, false);
  assert.equal(body.bot_v2_d1_migration_enabled, false);
});

test("health reports candidate D1 binding without enabling write authorities", async () => {
  const db = {
    prepare(sql) {
      assert.equal(sql, "SELECT 1 AS ok");
      return {
        async first() {
          return {ok: 1};
        }
      };
    }
  };
  const response = await worker.fetch(
    new Request("https://worker.test/health"),
    baseEnv({BOT_DB: db})
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.bot_v2_d1_bound, true);
  assert.equal(body.bot_v2_d1_readable, true);
  assert.equal(body.bot_v2_d1_write_enabled, false);
  assert.equal(body.bot_v2_d1_replay_enabled, false);
  assert.equal(body.bot_v2_d1_migration_enabled, false);
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

test("private start without pair code opens the DM control panel", async () => {
  const env = baseEnv();
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(env, {
      update_id: 4001,
      message: {
        message_id: 41,
        from: {id: 424242, is_bot: false},
        chat: {id: 424242, type: "private"},
        text: "/start"
      }
    });
    assert.equal(response.status, 200);
    const menu = calls.find(call =>
      call.method === "sendMessage" &&
      String(call.body.text || "").includes("Pilih menu:")
    );
    assert.ok(menu);
    const callbacks = menu.body.reply_markup.inline_keyboard
      .flat()
      .map(button => button.callback_data)
      .filter(Boolean);
    assert.ok(callbacks.includes("menu:account"));
    assert.ok(callbacks.includes("menu:referral"));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("group menu command exposes only a DM deep-link", async () => {
  const env = baseEnv({SUPPORT_GROUP_ID: "-10042"});
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(env, {
      update_id: 4002,
      message: {
        message_id: 42,
        from: {id: 424242, is_bot: false},
        chat: {id: -10042, type: "supergroup"},
        text: "/menu"
      }
    });
    assert.equal(response.status, 200);
    const reply = calls.find(call => call.method === "sendMessage");
    assert.ok(reply);
    assert.match(String(reply.body.text || ""), /lewat DM bot/);
    assert.equal(
      reply.body.reply_markup.inline_keyboard[0][0].url,
      "https://t.me/bukabmp_bot?start=menu"
    );
    assert.doesNotMatch(String(reply.body.text || ""), /Supporter aktif|Referral valid/);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("invalid referral deep-link never falls through to activation verification", async () => {
  const env = baseEnv();
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const response = await webhook(env, {
      update_id: 4003,
      message: {
        message_id: 43,
        from: {id: 424242, is_bot: false},
        chat: {id: 424242, type: "private"},
        text: "/start ref_424242"
      }
    });
    assert.equal(response.status, 200);
    assert.equal(calls.some(call => call.method === "getChatMember"), false);
    assert.ok(calls.some(call =>
      call.method === "sendMessage" &&
      String(call.body.text || "") === "Link referral tidak valid."
    ));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("owner-only KV inventory rejects missing admin auth", async () => {
  const response = await worker.fetch(
    new Request("https://worker.test/admin/kv-inventory"),
    baseEnv({
      ADMIN_SETUP_TOKEN: "fixture-admin",
      PAIRINGS: {
        async list() {
          throw new Error("must not list without auth");
        }
      }
    })
  );
  assert.equal(response.status, 401);
});

test("owner-only KV inventory returns counts without raw keys", async () => {
  const pages = [
    {
      list_complete: false,
      cursor: "next",
      keys: [
        {name: "pair:PairSecretABC"},
        {name: "supporter:user:424242"},
        {name: "supporter-payment:chargehash"},
        {name: "support-ai-day:424242:2026-09-21"}
      ]
    },
    {
      list_complete: true,
      keys: [
        {name: "telegram-update:9001"},
        {name: "mystery:private-value"}
      ]
    }
  ];
  let page = 0;
  const env = baseEnv({
    ADMIN_SETUP_TOKEN: "fixture-admin",
    PAIRINGS: {
      async list() {
        return pages[page++];
      }
    }
  });

  const response = await worker.fetch(
    new Request("https://worker.test/admin/kv-inventory", {
      headers: {Authorization: "Bearer fixture-admin"}
    }),
    env
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total_keys, 6);
  assert.deepEqual(body.families, {
    pair: 1,
    supporter_entitlement: 1,
    supporter_payment_marker: 1,
    support_ai_quota: 1,
    telegram_update_legacy: 1,
    other: 1
  });
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /PairSecretABC|424242|chargehash|private-value/);
});

test("supporter migration dry-run rejects missing admin auth", async () => {
  const response = await worker.fetch(
    new Request("https://worker.test/admin/supporter-migration-dry-run"),
    baseEnv({ADMIN_SETUP_TOKEN: "fixture-admin"})
  );
  assert.equal(response.status, 401);
});

test("supporter migration dry-run summarizes authority without exposing records", async () => {
  const chargeRef = await sha256Hex("support-payment:secret-charge-id");
  const kv = new Map([
    ["supporter:user:111", JSON.stringify({
      user_id: "111",
      supporter_until: Date.now() + 86400000,
      activation_until: 0,
      activation_bonus_pending_days: 14,
      total_stars: 2,
      payment_count: 1,
      last_payment_at: 1700000000000,
      last_package_id: "day",
      wall_mode: "private",
      username: "private-user"
    })],
    ["supporter:user:222", JSON.stringify({
      user_id: "222",
      supporter_until: 1,
      activation_until: 0,
      activation_bonus_pending_days: 0,
      total_stars: 0,
      payment_count: 0,
      last_payment_at: 0,
      wall_mode: "anonymous"
    })],
    ["supporter-payment:" + chargeRef, JSON.stringify({
      processed_at: 1700000000000,
      user_id: "111",
      package_id: "day",
      stars: 2,
      telegram_payment_charge_id: "secret-charge-id"
    })]
  ]);

  const pairings = {
    async list({prefix}) {
      return {
        list_complete: true,
        keys: [...kv.keys()]
          .filter(key => key.startsWith(prefix))
          .map(name => ({name}))
      };
    },
    async get(key, type) {
      const value = kv.get(String(key));
      if (value == null) return null;
      return type === "json" ? JSON.parse(value) : value;
    }
  };

  const db = {
    prepare(sql) {
      if (/^SELECT COUNT\(\*\) AS count FROM (users|supporter_state|payments)$/.test(sql)) {
        return {
          async first() {
            return {count: 0};
          }
        };
      }
      if (
        sql.startsWith("SELECT telegram_user_id FROM users") ||
        sql.startsWith("SELECT * FROM supporter_state") ||
        sql.startsWith("SELECT * FROM payments")
      ) {
        return {
          bind() {
            return {
              async first() {
                return null;
              }
            };
          }
        };
      }
      throw new Error("unexpected migration dry-run query");
    }
  };

  const response = await worker.fetch(
    new Request("https://worker.test/admin/supporter-migration-dry-run", {
      headers: {Authorization: "Bearer fixture-admin"}
    }),
    baseEnv({
      ADMIN_SETUP_TOKEN: "fixture-admin",
      PAIRINGS: pairings,
      BOT_DB: db
    })
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.apply_ready, true);
  assert.deepEqual(body.source.supporter_entitlement, {
    total: 2,
    valid: 2,
    invalid: 0,
    active: 1,
    expired: 1
  });
  assert.deepEqual(body.source.supporter_payment_marker, {
    total: 1,
    valid: 1,
    invalid: 0,
    linked_to_known_entitlement: 1,
    without_known_entitlement: 0
  });
  assert.deepEqual(body.target_d1, {
    available: true,
    counts: {users: 0, supporter_state: 0, payments: 0}
  });

  const serialized = JSON.stringify(body);
  assert.doesNotMatch(
    serialized,
    /111|222|private-user|secret-charge-id/
  );
  assert.equal(serialized.includes(chargeRef), false);
});

test("supporter migration apply stays locked while migration gate is off", async () => {
  const env = baseEnv({
    ADMIN_SETUP_TOKEN: "fixture-admin",
    BOT_DB: {
      prepare() {
        throw new Error("D1 must not be touched while migration gate is off");
      }
    },
    PAIRINGS: {
      async list() {
        throw new Error("KV must not be read while migration gate is off");
      }
    }
  });

  const response = await worker.fetch(
    new Request("https://worker.test/admin/supporter-migration-apply", {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture-admin",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        confirm: "APPLY_SUPPORTER_KV_TO_D1_V1"
      })
    }),
    env
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    reason: "migration_disabled"
  });
});
