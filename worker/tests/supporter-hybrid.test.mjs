import test from "node:test";
import assert from "node:assert/strict";

import {
  getSupporterEntitlement,
  putSupporterEntitlement
} from "../src/data/supporter.js";

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
}

function supporterRow(overrides = {}) {
  return {
    user_id: 424242,
    supporter_until: 200,
    referral_entitlement_total: 0,
    activation_until: 0,
    activation_bonus_pending_days: 14,
    total_stars: 2,
    payment_count: 1,
    last_payment_at: 100,
    last_package_id: "day",
    wall_mode: "private",
    tag_applied: 0,
    updated_at: 150,
    ...overrides
  };
}

test("supporter repository stays KV-only while D1 gate is off", async () => {
  const kv = new Kv({
    "supporter:user:424242": JSON.stringify({
      user_id: "424242",
      supporter_until: 100,
      username: "legacy-user"
    })
  });
  const env = {
    PAIRINGS: kv,
    BOT_DB: {
      prepare() {
        throw new Error("D1 must not be touched while supporter gate is off");
      }
    }
  };

  const record = await getSupporterEntitlement(env, 424242);
  assert.equal(record.supporter_until, 100);
  assert.equal(record.username, "legacy-user");

  record.supporter_until = 125;
  await putSupporterEntitlement(env, 424242, record);
  const mirrored = await kv.get("supporter:user:424242", "json");
  assert.equal(mirrored.supporter_until, 125);
});

test("supporter repository uses D1 core with KV metadata when gate is on", async () => {
  let row = supporterRow();
  const db = {
    prepare(sql) {
      if (sql.startsWith("SELECT * FROM supporter_state")) {
        return {
          bind() {
            return {
              async first() {
                return row;
              }
            };
          }
        };
      }

      if (sql.startsWith("INSERT INTO supporter_state")) {
        return {
          bind(...args) {
            return {
              async run() {
                row = supporterRow({
                  supporter_until: Number(args[1]),
                  referral_entitlement_total: Number(args[2]),
                  activation_until: Number(args[3]),
                  activation_bonus_pending_days: Number(args[4]),
                  total_stars: Number(args[5]),
                  payment_count: Number(args[6]),
                  last_payment_at: Number(args[7]),
                  last_package_id: args[8],
                  wall_mode: args[9],
                  tag_applied: Number(args[10]),
                  updated_at: Number(args[11])
                });
                return {meta: {changes: 1}};
              }
            };
          }
        };
      }

      throw new Error("unexpected SQL: " + sql);
    }
  };

  const kv = new Kv({
    "supporter:user:424242": JSON.stringify({
      user_id: "424242",
      supporter_until: 100,
      username: "legacy-user",
      first_name: "Legacy",
      last_activation_issued_at: 99
    })
  });

  const env = {
    PAIRINGS: kv,
    BOT_DB: db,
    BOT_V2_SUPPORTER_D1_ENABLED: "true"
  };

  const record = await getSupporterEntitlement(env, 424242);
  assert.equal(record.supporter_until, 200);
  assert.equal(record.username, "legacy-user");
  assert.equal(record.first_name, "Legacy");
  assert.equal(record.last_activation_issued_at, 99);

  record.supporter_until = 250;
  record.wall_mode = "anonymous";
  await putSupporterEntitlement(env, 424242, record);

  assert.equal(row.supporter_until, 250);
  assert.equal(row.wall_mode, "anonymous");

  const mirrored = await kv.get("supporter:user:424242", "json");
  assert.equal(mirrored.supporter_until, 250);
  assert.equal(mirrored.username, "legacy-user");
});
