import {d1BindingAvailable} from "../data/d1/mode.js";

export const ACTIVATION_LEDGER_MIGRATION_CONFIRMATION =
  "APPLY_ACTIVATION_LEDGER_V1";

const REQUIRED = Object.freeze([
  "first_activated_at",
  "last_activated_at",
  "activation_count"
]);

async function columns(env) {
  if (!d1BindingAvailable(env)) {
    return {available: false, names: []};
  }
  const result = await env.BOT_DB
    .prepare("PRAGMA table_info(users)")
    .all();
  const names = (result?.results || [])
    .map(row => String(row?.name || ""))
    .filter(Boolean);
  return {available: true, names};
}

export async function activationLedgerMigrationDryRun(env) {
  const state = await columns(env);
  if (!state.available) {
    return {ok: false, reason: "d1_unavailable"};
  }

  const present = Object.fromEntries(
    REQUIRED.map(name => [name, state.names.includes(name)])
  );
  const missing = REQUIRED.filter(name => !present[name]);

  return {
    ok: true,
    present,
    missing_count: missing.length,
    apply_ready: missing.length > 0,
    already_applied: missing.length === 0
  };
}

export async function activationLedgerMigrationApply(
  env,
  confirmation
) {
  if (
    String(confirmation || "") !==
    ACTIVATION_LEDGER_MIGRATION_CONFIRMATION
  ) {
    return {ok: false, reason: "confirmation_required"};
  }

  const before = await activationLedgerMigrationDryRun(env);
  if (!before.ok) return before;
  if (before.already_applied) {
    return {
      ok: true,
      applied: false,
      already_applied: true,
      columns_added: 0
    };
  }

  const statements = {
    first_activated_at:
      "ALTER TABLE users ADD COLUMN first_activated_at INTEGER",
    last_activated_at:
      "ALTER TABLE users ADD COLUMN last_activated_at INTEGER",
    activation_count:
      "ALTER TABLE users ADD COLUMN activation_count INTEGER NOT NULL DEFAULT 0"
  };

  let added = 0;
  for (const name of REQUIRED) {
    if (before.present[name]) continue;
    await env.BOT_DB.prepare(statements[name]).run();
    added += 1;
  }

  const after = await activationLedgerMigrationDryRun(env);
  if (!after.ok || !after.already_applied) {
    return {
      ok: false,
      reason: "post_verify_failed",
      columns_added: added
    };
  }

  return {
    ok: true,
    applied: true,
    already_applied: false,
    columns_added: added
  };
}
