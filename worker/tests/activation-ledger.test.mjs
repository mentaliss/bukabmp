import test from "node:test";
import assert from "node:assert/strict";

import {
  getActivationLedger,
  recordSuccessfulActivation
} from "../src/data/d1/activation-ledger.js";
import {attributeReferralFromCode} from "../src/features/referral-service.js";

function fakeLedgerDb(initial) {
  const row = {...initial};

  function statement(sql, args = []) {
    return {
      bind(...nextArgs) {
        return statement(sql, nextArgs);
      },
      async first() {
        if (sql.startsWith("SELECT * FROM users WHERE telegram_user_id")) {
          return Number(args[0]) === Number(row.telegram_user_id) ? {...row} : null;
        }
        if (
          sql.startsWith(
            "SELECT telegram_user_id, first_activated_at, last_activated_at"
          )
        ) {
          return Number(args[0]) === Number(row.telegram_user_id)
            ? {
                telegram_user_id: row.telegram_user_id,
                first_activated_at: row.first_activated_at ?? null,
                last_activated_at: row.last_activated_at ?? null,
                activation_count: row.activation_count ?? 0
              }
            : null;
        }
        throw new Error("unexpected first SQL: " + sql);
      },
      async run() {
        if (sql.startsWith("UPDATE users SET first_activated_at")) {
          const at = Number(args[1]);
          if (row.first_activated_at == null) row.first_activated_at = at;
          row.last_activated_at = at;
          row.activation_count = Number(row.activation_count || 0) + 1;
          row.updated_at = at;
          return {meta: {changes: 1}};
        }
        throw new Error("unexpected run SQL: " + sql);
      }
    };
  }

  return {
    row,
    prepare(sql) {
      return statement(sql);
    }
  };
}

test("activation ledger preserves first activation and counts later activations", async () => {
  const db = fakeLedgerDb({
    telegram_user_id: 424242,
    referral_code: "fixtureReferral",
    first_activated_at: null,
    last_activated_at: null,
    activation_count: 0,
    updated_at: 1
  });
  const env = {
    BOT_DB: db,
    BOT_V2_ACTIVATION_LEDGER_ENABLED: "true"
  };

  const first = await recordSuccessfulActivation(env, 424242, 1000);
  assert.equal(first.recorded, true);
  assert.equal(first.firstActivation, true);
  assert.equal(db.row.first_activated_at, 1000);
  assert.equal(db.row.last_activated_at, 1000);
  assert.equal(db.row.activation_count, 1);

  const second = await recordSuccessfulActivation(env, 424242, 2000);
  assert.equal(second.recorded, true);
  assert.equal(second.firstActivation, false);
  assert.equal(db.row.first_activated_at, 1000);
  assert.equal(db.row.last_activated_at, 2000);
  assert.equal(db.row.activation_count, 2);

  const state = await getActivationLedger(env, 424242);
  assert.equal(state.activated, true);
  assert.equal(state.row.first_activated_at, 1000);
});

test("recorded activation blocks new referral attribution", async () => {
  const db = fakeLedgerDb({
    telegram_user_id: 424242,
    referral_code: "fixtureReferral",
    first_activated_at: 1000,
    last_activated_at: 1000,
    activation_count: 1,
    updated_at: 1000
  });
  const env = {
    BOT_DB: db,
    BOT_V2_SUPPORTER_D1_ENABLED: "true",
    BOT_V2_REFERRAL_D1_ENABLED: "true",
    BOT_V2_ACTIVATION_LEDGER_ENABLED: "true"
  };

  const result = await attributeReferralFromCode(
    env,
    424242,
    "someoneElseCode"
  );
  assert.deepEqual(result, {
    available: true,
    created: false,
    reason: "already_activated"
  });
});

test("legacy user remains unregistered until a future activation is recorded", async () => {
  const db = fakeLedgerDb({
    telegram_user_id: 424242,
    referral_code: "fixtureReferral",
    first_activated_at: null,
    last_activated_at: null,
    activation_count: 0,
    updated_at: 1
  });
  const env = {
    BOT_DB: db,
    BOT_V2_ACTIVATION_LEDGER_ENABLED: "true"
  };

  const state = await getActivationLedger(env, 424242);
  assert.equal(state.available, true);
  assert.equal(state.activated, false);
});
