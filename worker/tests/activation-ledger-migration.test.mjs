import test from "node:test";
import assert from "node:assert/strict";

import {
  activationLedgerMigrationApply,
  activationLedgerMigrationDryRun
} from "../src/features/activation-ledger-migration.js";

class FakeDb {
  constructor() {
    this.columns = new Set([
      "telegram_user_id",
      "created_at",
      "referral_code",
      "referred_by",
      "updated_at"
    ]);
    this.alters = [];
  }

  prepare(sql) {
    const db = this;
    return {
      async all() {
        if (sql === "PRAGMA table_info(users)") {
          return {
            results: [...db.columns].map((name, cid) => ({
              cid,
              name
            }))
          };
        }
        throw new Error("unexpected all SQL: " + sql);
      },
      async run() {
        const match = sql.match(
          /^ALTER TABLE users ADD COLUMN ([a-z_]+)/
        );
        if (!match) throw new Error("unexpected run SQL: " + sql);
        const name = match[1];
        if (db.columns.has(name)) {
          throw new Error("duplicate column: " + name);
        }
        db.columns.add(name);
        db.alters.push(sql);
        return {meta: {changes: 0}};
      }
    };
  }
}

test("activation ledger schema migration is additive and idempotent", async () => {
  const db = new FakeDb();
  const env = {BOT_DB: db};

  const before = await activationLedgerMigrationDryRun(env);
  assert.equal(before.ok, true);
  assert.equal(before.apply_ready, true);
  assert.equal(before.missing_count, 3);

  const applied = await activationLedgerMigrationApply(
    env,
    "APPLY_ACTIVATION_LEDGER_V1"
  );
  assert.deepEqual(applied, {
    ok: true,
    applied: true,
    already_applied: false,
    columns_added: 3
  });
  assert.equal(db.alters.length, 3);

  const second = await activationLedgerMigrationApply(
    env,
    "APPLY_ACTIVATION_LEDGER_V1"
  );
  assert.deepEqual(second, {
    ok: true,
    applied: false,
    already_applied: true,
    columns_added: 0
  });
  assert.equal(db.alters.length, 3);
});

test("activation ledger schema migration requires exact confirmation", async () => {
  const db = new FakeDb();
  const result = await activationLedgerMigrationApply(
    {BOT_DB: db},
    "wrong"
  );
  assert.deepEqual(result, {
    ok: false,
    reason: "confirmation_required"
  });
  assert.equal(db.alters.length, 0);
});
