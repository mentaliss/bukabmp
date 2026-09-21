import test from "node:test";
import assert from "node:assert/strict";

import {d1BindingAvailable, d1WritesEnabled} from "../src/data/d1/mode.js";
import {qualifyReferralForActivatedUser} from "../src/data/d1/referral-qualification.js";
import {applySupporterPaymentTransaction} from "../src/data/d1/payment-transaction.js";
import {ensureReferralUser} from "../src/features/referral-service.js";

function fakeDb({
  firstRows = new Map(),
  firstStatementChanges = 1
} = {}) {
  const batches = [];
  const prepared = [];

  function statement(sql, args = []) {
    return {
      sql,
      args,
      bind(...nextArgs) {
        return statement(sql, nextArgs);
      },
      async first() {
        for (const [needle, value] of firstRows) {
          if (sql.includes(needle)) return value;
        }
        return null;
      }
    };
  }

  return {
    batches,
    prepared,
    prepare(sql) {
      prepared.push(sql);
      return statement(sql);
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map((_, index) => ({
        meta: {changes: index === 0 ? firstStatementChanges : 1}
      }));
    }
  };
}

test("D1 write authority requires both binding and explicit feature gate", async () => {
  const throwingDb = {
    prepare() {
      throw new Error("must not touch D1 while gate is disabled");
    }
  };

  assert.equal(d1BindingAvailable({}), false);
  assert.equal(d1WritesEnabled({BOT_DB: throwingDb}), false);
  assert.equal(
    d1WritesEnabled({
      BOT_DB: throwingDb,
      BOT_V2_D1_WRITE_ENABLED: "true"
    }),
    true
  );

  const disabled = await ensureReferralUser(
    {BOT_DB: throwingDb},
    424242
  );
  assert.deepEqual(disabled, {available: false, user: null});
});

test("referral qualification is executed as one D1 batch", async () => {
  const db = fakeDb({
    firstRows: new Map([
      ["FROM referral_rewards WHERE reward_event_id", {
        user_id: 1001,
        valid_referral_count: 3,
        entitlement_total_days: 7,
        credited_delta_days: 3
      }]
    ])
  });

  const result = await qualifyReferralForActivatedUser(
    {BOT_DB: db},
    {
      referredUserId: 2002,
      qualificationRef: "qual_fixture",
      rewardEventId: "reward_fixture",
      supporterEventId: "support_fixture",
      now: 1700000000000
    }
  );

  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 5);
  assert.match(db.batches[0][0].sql, /qualification_ref/);
  assert.match(db.batches[0][1].sql, /INSERT INTO referral_rewards/);
  assert.match(db.batches[0][3].sql, /UPDATE supporter_state/);
  assert.equal(result.qualified, true);
  assert.equal(result.validReferralCount, 3);
  assert.equal(result.entitlementTotalDays, 7);
  assert.equal(result.creditedDeltaDays, 3);
});

test("already-qualified referral performs no second reward", async () => {
  const db = fakeDb({firstStatementChanges: 0});
  const result = await qualifyReferralForActivatedUser(
    {BOT_DB: db},
    {
      referredUserId: 2002,
      qualificationRef: "qual_retry",
      rewardEventId: "reward_retry",
      supporterEventId: "support_retry",
      now: 1700000000001
    }
  );

  assert.equal(result.qualified, false);
  assert.equal(result.reason, "already_qualified_or_unattributed");
});

test("supporter payment contract starts with unique payment insert in one transaction", async () => {
  const state = {
    user_id: 424242,
    supporter_until: 1700100000000,
    activation_bonus_pending_days: 14
  };
  const db = fakeDb({
    firstRows: new Map([
      ["SELECT * FROM supporter_state", state]
    ])
  });

  const result = await applySupporterPaymentTransaction(
    {BOT_DB: db},
    {
      paymentEventId: "pay_fixture",
      supporterEventId: "support_pay_fixture",
      telegramChargeRef: "hashed_charge_fixture",
      userId: 424242,
      packageId: "day",
      stars: 2,
      days: 1,
      activationBonusDays: 14,
      activationMaxDays: 60,
      tokenTtlDays: 14,
      processedAt: 1700000000000
    }
  );

  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 4);
  assert.match(db.batches[0][0].sql, /^INSERT INTO payments/);
  assert.doesNotMatch(db.batches[0][0].sql, /OR IGNORE/);
  assert.match(db.batches[0][2].sql, /UPDATE supporter_state/);
  assert.deepEqual(result, state);
});
