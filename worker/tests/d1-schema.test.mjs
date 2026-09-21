import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql = await readFile(
  new URL("../migrations/0001_bot_v2.sql", import.meta.url),
  "utf8"
);

const wranglerText = await readFile(
  new URL("../wrangler.jsonc", import.meta.url),
  "utf8"
);
const wrangler = JSON.parse(wranglerText);

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
  assert.match(sql, /qualification_ref TEXT UNIQUE/);
  assert.match(sql, /telegram_charge_ref TEXT NOT NULL UNIQUE/);
  assert.match(sql, /update_id INTEGER PRIMARY KEY/);
  assert.match(sql, /source_ref TEXT NOT NULL UNIQUE/);
});

test("D1 schema does not encode the proposed referred-user +1 day policy", () => {
  assert.doesNotMatch(sql, /referred.*\+?1\s*day/i);
});

test("D1 supporter state preserves payment and activation continuity", () => {
  assert.match(sql, /activation_bonus_pending_days INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /total_stars INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /payment_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /last_payment_at INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /last_package_id TEXT/);
  assert.match(sql, /tag_applied INTEGER NOT NULL DEFAULT 0/);
});

test("candidate config binds BOT_DB without enabling D1 authorities", () => {
  const binding = (wrangler.d1_databases || []).find(
    item => item.binding === "BOT_DB"
  );
  assert.ok(binding);
  assert.equal(binding.database_name, "bmp-terbuka-bot-v2");
  assert.equal(binding.migrations_dir, "migrations");
  assert.equal(wrangler.vars?.BOT_V2_D1_WRITE_ENABLED, undefined);
  assert.equal(wrangler.vars?.BOT_V2_D1_REPLAY_ENABLED, "true");
  assert.equal(wrangler.vars?.BOT_V2_D1_MIGRATION_ENABLED, "false");
  assert.equal(wrangler.vars?.BOT_V2_SUPPORTER_D1_ENABLED, "true");
  assert.equal(wrangler.vars?.BOT_V2_PAYMENT_D1_ENABLED, "true");
  assert.equal(wrangler.vars?.BOT_V2_REFERRAL_D1_ENABLED, undefined);
});
