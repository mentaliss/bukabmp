import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql = await readFile(
  new URL("../migrations/0001_bot_v2.sql", import.meta.url),
  "utf8"
);

test("D1 foundation contains the durable Bot V2 authorities", () => {
  for (const table of [
    "users",
    "referrals",
    "supporter_state",
    "supporter_events",
    "payments",
    "referral_rewards",
    "processed_updates"
  ]) {
    assert.match(sql, new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\b"));
  }
});

test("D1 referral/payment/update uniqueness is explicit", () => {
  assert.match(sql, /referred_user_id INTEGER NOT NULL UNIQUE/);
  assert.match(sql, /telegram_charge_ref TEXT NOT NULL UNIQUE/);
  assert.match(sql, /update_id INTEGER PRIMARY KEY/);
  assert.match(sql, /source_ref TEXT NOT NULL UNIQUE/);
});

test("D1 schema does not encode the proposed referred-user +1 day policy", () => {
  assert.doesNotMatch(sql, /referred.*\+?1\s*day/i);
});
