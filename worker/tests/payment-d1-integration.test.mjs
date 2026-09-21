import test from "node:test";
import assert from "node:assert/strict";

import {applySuccessfulSupporterPayment} from "../src/features/payment.js";
import {sha256Hex} from "../src/security/crypto.js";

class Kv {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial));
  }
  async get(key, type) {
    const value = this.map.get(String(key));
    if (value == null) return null;
    return type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value) {
    this.map.set(String(key), String(value));
  }
  async delete(key) {
    this.map.delete(String(key));
  }
}

class PaymentDb {
  constructor() {
    this.users = new Map();
    this.states = new Map();
    this.payments = new Map();
    this.events = new Map();
    this.batchCalls = 0;
  }

  statement(sql, args = []) {
    const db = this;
    return {
      sql,
      args,
      bind(...nextArgs) {
        return db.statement(sql, nextArgs);
      },
      async first() {
        if (sql.startsWith("SELECT * FROM payments WHERE telegram_charge_ref")) {
          return db.payments.get(String(args[0])) || null;
        }
        if (sql.startsWith("SELECT * FROM users WHERE telegram_user_id")) {
          return db.users.get(Number(args[0])) || null;
        }
        if (sql.startsWith("SELECT * FROM supporter_state WHERE user_id")) {
          return db.states.get(Number(args[0])) || null;
        }
        throw new Error("unexpected first SQL: " + sql);
      },
      async run() {
        if (sql.startsWith("INSERT OR IGNORE INTO users")) {
          const id = Number(args[0]);
          if (!db.users.has(id)) {
            db.users.set(id, {
              telegram_user_id: id,
              created_at: Number(args[1]),
              referral_code: String(args[2]),
              updated_at: Number(args[3])
            });
            return {meta: {changes: 1}};
          }
          return {meta: {changes: 0}};
        }

        if (sql.startsWith("INSERT INTO supporter_state")) {
          const id = Number(args[0]);
          db.states.set(id, {
            user_id: id,
            supporter_until: Number(args[1]),
            referral_entitlement_total: Number(args[2]),
            activation_until: Number(args[3]),
            activation_bonus_pending_days: Number(args[4]),
            total_stars: Number(args[5]),
            payment_count: Number(args[6]),
            last_payment_at: Number(args[7]),
            last_package_id: args[8] == null ? null : String(args[8]),
            wall_mode: String(args[9]),
            tag_applied: Number(args[10]),
            updated_at: Number(args[11])
          });
          return {meta: {changes: 1}};
        }

        throw new Error("unexpected run SQL: " + sql);
      }
    };
  }

  prepare(sql) {
    return this.statement(sql);
  }

  async batch(statements) {
    this.batchCalls += 1;

    for (const statement of statements) {
      const {sql, args} = statement;

      if (sql.startsWith("INSERT INTO payments")) {
        const ref = String(args[1]);
        if (this.payments.has(ref)) {
          throw new Error("UNIQUE constraint failed: payments.telegram_charge_ref");
        }
        this.payments.set(ref, {
          payment_event_id: String(args[0]),
          telegram_charge_ref: ref,
          user_id: Number(args[2]),
          package_id: String(args[3]),
          stars: Number(args[4]),
          processed_at: Number(args[5]),
          status: "PROCESSED"
        });
        continue;
      }

      if (sql.startsWith("INSERT OR IGNORE INTO supporter_state")) {
        const id = Number(args[0]);
        if (!this.states.has(id)) {
          this.states.set(id, {
            user_id: id,
            supporter_until: Number(args[1]),
            referral_entitlement_total: Number(args[2]),
            activation_until: Number(args[3]),
            activation_bonus_pending_days: Number(args[4]),
            total_stars: Number(args[5]),
            payment_count: Number(args[6]),
            last_payment_at: Number(args[7]),
            last_package_id: args[8] == null ? null : String(args[8]),
            wall_mode: String(args[9]),
            tag_applied: Number(args[10]),
            updated_at: Number(args[11])
          });
        }
        continue;
      }

      if (sql.startsWith("UPDATE supporter_state SET")) {
        const id = Number(args[0]);
        const now = Number(args[1]);
        const dayMs = Number(args[2]);
        const stars = Number(args[3]);
        const pkg = String(args[4]);
        const bonusMs = Number(args[5]);
        const maxActivation = Number(args[6]);
        const maxPending = Number(args[7]);
        const bonusDays = Number(args[8]);
        const row = this.states.get(id);

        row.supporter_until = Math.max(now, row.supporter_until) + dayMs;
        row.total_stars += stars;
        row.payment_count += 1;
        row.last_payment_at = now;
        row.last_package_id = pkg;
        if (row.activation_until > now) {
          row.activation_until = Math.min(
            row.activation_until + bonusMs,
            maxActivation
          );
        } else {
          row.activation_bonus_pending_days = Math.min(
            maxPending,
            row.activation_bonus_pending_days + bonusDays
          );
        }
        row.updated_at = now;
        continue;
      }

      if (sql.startsWith("INSERT INTO supporter_events")) {
        this.events.set(String(args[0]), {
          event_id: String(args[0]),
          user_id: Number(args[1]),
          days_delta: Number(args[2]),
          source_ref: String(args[3]),
          created_at: Number(args[4])
        });
        continue;
      }

      throw new Error("unexpected batch SQL: " + sql);
    }

    return statements.map(() => ({meta: {changes: 1}}));
  }
}

function telegramFetchRecorder(calls) {
  return async (url, init = {}) => {
    const method = new URL(url).pathname.split("/").filter(Boolean).pop();
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({method, body});
    return new Response(JSON.stringify({
      ok: true,
      result: {message_id: calls.length}
    }), {
      status: 200,
      headers: {"content-type": "application/json"}
    });
  };
}

test("D1 payment path credits once and mirrors rollback state to KV", async () => {
  const nonce = "abcdefgh1234";
  const rawCharge = "telegram-charge-fixture";
  const chargeRef = await sha256Hex("support-payment:" + rawCharge);
  const payload = "support:v1:day:424242:" + nonce;

  const kv = new Kv({
    ["supporter-invoice:" + nonce]: JSON.stringify({
      user_id: "424242",
      package_id: "day",
      stars: 2,
      payload,
      created_at: Date.now(),
      terms_accepted_at: Date.now()
    })
  });
  const db = new PaymentDb();
  const env = {
    TELEGRAM_BOT_TOKEN: "fixture-token",
    PAIRINGS: kv,
    BOT_DB: db,
    BOT_V2_SUPPORTER_D1_ENABLED: "true",
    BOT_V2_PAYMENT_D1_ENABLED: "true"
  };

  const message = {
    from: {
      id: 424242,
      username: "fixture-user",
      first_name: "Fixture"
    },
    chat: {id: 424242, type: "private"},
    successful_payment: {
      invoice_payload: payload,
      currency: "XTR",
      total_amount: 2,
      telegram_payment_charge_id: rawCharge
    }
  };

  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = telegramFetchRecorder(calls);
  try {
    const first = await applySuccessfulSupporterPayment(env, message);
    const second = await applySuccessfulSupporterPayment(env, message);

    assert.equal(first, true);
    assert.equal(second, true);
  } finally {
    globalThis.fetch = oldFetch;
  }

  assert.equal(db.batchCalls, 1);
  assert.equal(db.payments.size, 1);
  assert.equal(db.events.size, 1);

  const state = db.states.get(424242);
  assert.equal(state.total_stars, 2);
  assert.equal(state.payment_count, 1);
  assert.equal(state.last_package_id, "day");
  assert.ok(state.supporter_until > Date.now());

  const mirror = await kv.get("supporter:user:424242", "json");
  assert.equal(mirror.total_stars, 2);
  assert.equal(mirror.payment_count, 1);
  assert.equal(mirror.username, undefined);

  const marker = await kv.get(
    "supporter-payment:" + chargeRef,
    "json"
  );
  assert.equal(marker.package_id, "day");
  assert.equal(marker.stars, 2);
  assert.equal(marker.telegram_payment_charge_id, rawCharge);

  assert.equal(
    calls.filter(call => call.method === "sendMessage").length,
    2
  );
});
