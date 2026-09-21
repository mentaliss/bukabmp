import test from "node:test";
import assert from "node:assert/strict";

import {sha256Hex} from "../src/security/crypto.js";
import {
  supporterMigrationApply,
  supporterMigrationCompare
} from "../src/features/supporter-migration.js";

class MigrationDb {
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
        if (sql === "SELECT COUNT(*) AS count FROM users") {
          return {count: db.users.size};
        }
        if (sql === "SELECT COUNT(*) AS count FROM supporter_state") {
          return {count: db.states.size};
        }
        if (sql === "SELECT COUNT(*) AS count FROM payments") {
          return {count: db.payments.size};
        }
        if (sql.startsWith("SELECT telegram_user_id FROM users")) {
          const row = db.users.get(Number(args[0]));
          return row ? {telegram_user_id: row.telegram_user_id} : null;
        }
        if (sql.startsWith("SELECT * FROM supporter_state")) {
          return db.states.get(Number(args[0])) || null;
        }
        if (sql.startsWith("SELECT * FROM payments")) {
          return db.payments.get(String(args[0])) || null;
        }
        if (sql.startsWith("SELECT user_id, source, days_delta, source_ref FROM supporter_events")) {
          return db.events.get(String(args[0])) || null;
        }
        throw new Error("unexpected first(): " + sql);
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

      if (sql.startsWith("INSERT INTO users")) {
        this.users.set(Number(args[0]), {
          telegram_user_id: Number(args[0]),
          created_at: Number(args[1]),
          referral_code: String(args[2]),
          updated_at: Number(args[3])
        });
        continue;
      }

      if (sql.startsWith("INSERT INTO supporter_state")) {
        this.states.set(Number(args[0]), {
          user_id: Number(args[0]),
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
        continue;
      }

      if (sql.startsWith("INSERT INTO supporter_events")) {
        this.events.set(String(args[2]), {
          event_id: String(args[0]),
          user_id: Number(args[1]),
          source: "migration",
          days_delta: 0,
          source_ref: String(args[2]),
          created_at: Number(args[3])
        });
        continue;
      }

      if (sql.startsWith("INSERT INTO payments")) {
        this.payments.set(String(args[1]), {
          payment_event_id: String(args[0]),
          telegram_charge_ref: String(args[1]),
          user_id: Number(args[2]),
          package_id: String(args[3]),
          stars: Number(args[4]),
          processed_at: Number(args[5]),
          status: "PROCESSED"
        });
        continue;
      }

      throw new Error("unexpected batch statement: " + sql);
    }

    return statements.map(() => ({meta: {changes: 1}}));
  }
}

test("supporter migration is transactional, copy-only and idempotent", async () => {
  const rawCharge = "fixture-telegram-charge";
  const chargeRef = await sha256Hex("support-payment:" + rawCharge);
  const kv = new Map([
    ["supporter:user:424242", JSON.stringify({
      user_id: "424242",
      supporter_until: 1800000000000,
      referral_entitlement_total: 0,
      activation_until: 0,
      activation_bonus_pending_days: 14,
      total_stars: 2,
      payment_count: 1,
      last_payment_at: 1700000000000,
      last_package_id: "day",
      wall_mode: "private",
      tag_applied: true
    })],
    ["supporter-payment:" + chargeRef, JSON.stringify({
      processed_at: 1700000000000,
      user_id: "424242",
      package_id: "day",
      stars: 2,
      telegram_payment_charge_id: rawCharge
    })]
  ]);

  let deletes = 0;
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
    },
    async delete() {
      deletes += 1;
      throw new Error("migration must never delete KV");
    }
  };

  const db = new MigrationDb();
  const env = {
    BOT_DB: db,
    BOT_V2_D1_MIGRATION_ENABLED: "true",
    PAIRINGS: pairings
  };

  const first = await supporterMigrationApply(
    env,
    "APPLY_SUPPORTER_KV_TO_D1_V1"
  );

  assert.equal(first.ok, true);
  assert.equal(first.applied, true);
  assert.equal(first.already_applied, false);
  assert.deepEqual(first.migrated, {
    users: 1,
    supporter_state: 1,
    payments: 1,
    migration_events: 1
  });
  assert.equal(first.kv_deleted, 0);
  assert.equal(db.batchCalls, 1);
  assert.equal(deletes, 0);

  const second = await supporterMigrationApply(
    env,
    "APPLY_SUPPORTER_KV_TO_D1_V1"
  );

  assert.equal(second.ok, true);
  assert.equal(second.applied, false);
  assert.equal(second.already_applied, true);
  assert.equal(db.batchCalls, 1);
  assert.equal(deletes, 0);

  const compare = await supporterMigrationCompare(env);
  assert.deepEqual(compare, {
    ok: true,
    expected: {
      users: 1,
      supporter_state: 1,
      payments: 1,
      migration_events: 1
    },
    matched: {
      users: 1,
      supporter_state: 1,
      payments: 1,
      migration_events: 1
    },
    kv_untouched: true
  });
});
