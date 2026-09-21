import {supporterPackage} from "../features/supporter-model.js";
import {d1BindingAvailable} from "../data/d1/mode.js";

async function listAllByPrefix(kv, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await kv.list({
      prefix,
      limit: 1000,
      ...(cursor ? {cursor} : {})
    });
    out.push(...(page?.keys || []));
    cursor = page?.list_complete === false && page?.cursor
      ? String(page.cursor)
      : null;
  } while (cursor);
  return out;
}

function safeInteger(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function validWallMode(value) {
  return ["private", "public", "anonymous"].includes(String(value || "private"));
}

function entitlementShape(record, keyUserId) {
  if (!record || typeof record !== "object") return false;
  const recordUserId = String(record.user_id || "");
  if (!recordUserId || recordUserId !== keyUserId) return false;

  const numericFields = [
    "supporter_until",
    "activation_until",
    "activation_bonus_pending_days",
    "total_stars",
    "payment_count",
    "last_payment_at"
  ];
  for (const field of numericFields) {
    if (record[field] != null && !Number.isFinite(Number(record[field]))) return false;
  }
  return validWallMode(record.wall_mode);
}

function paymentMarkerShape(record) {
  if (!record || typeof record !== "object") return false;
  const userId = safeInteger(record.user_id);
  const pkg = supporterPackage(record.package_id);
  const stars = Number(record.stars);
  const charge = String(record.telegram_payment_charge_id || "");
  const processedAt = Number(record.processed_at || 0);

  return Boolean(
    userId &&
    pkg &&
    stars === pkg.stars &&
    charge &&
    Number.isFinite(processedAt) &&
    processedAt > 0
  );
}

async function d1TargetCounts(env) {
  if (!d1BindingAvailable(env)) {
    return {available: false};
  }

  const tables = ["users", "supporter_state", "payments"];
  const counts = {};
  for (const table of tables) {
    const row = await env.BOT_DB
      .prepare("SELECT COUNT(*) AS count FROM " + table)
      .first();
    counts[table] = Math.max(0, Number(row?.count || 0));
  }
  return {available: true, counts};
}

export async function supporterMigrationDryRun(env) {
  if (!env?.PAIRINGS || typeof env.PAIRINGS.list !== "function") {
    return {ok: false, reason: "kv_unavailable"};
  }

  const entitlementKeys = await listAllByPrefix(env.PAIRINGS, "supporter:user:");
  const paymentKeys = await listAllByPrefix(env.PAIRINGS, "supporter-payment:");

  const entitlementUserIds = new Set();
  let validEntitlements = 0;
  let invalidEntitlements = 0;
  let activeEntitlements = 0;
  let expiredEntitlements = 0;

  for (const item of entitlementKeys) {
    const key = String(item?.name || "");
    const userId = key.slice("supporter:user:".length);
    const record = await env.PAIRINGS.get(key, "json");
    if (!entitlementShape(record, userId)) {
      invalidEntitlements += 1;
      continue;
    }

    validEntitlements += 1;
    entitlementUserIds.add(userId);
    if (Number(record.supporter_until || 0) > Date.now()) {
      activeEntitlements += 1;
    } else {
      expiredEntitlements += 1;
    }
  }

  let validPayments = 0;
  let invalidPayments = 0;
  let paymentsWithKnownEntitlement = 0;
  let paymentsWithoutKnownEntitlement = 0;

  for (const item of paymentKeys) {
    const key = String(item?.name || "");
    const record = await env.PAIRINGS.get(key, "json");
    if (!paymentMarkerShape(record)) {
      invalidPayments += 1;
      continue;
    }

    validPayments += 1;
    if (entitlementUserIds.has(String(record.user_id))) {
      paymentsWithKnownEntitlement += 1;
    } else {
      paymentsWithoutKnownEntitlement += 1;
    }
  }

  const target = await d1TargetCounts(env);

  return {
    ok: invalidEntitlements === 0 && invalidPayments === 0,
    source: {
      supporter_entitlement: {
        total: entitlementKeys.length,
        valid: validEntitlements,
        invalid: invalidEntitlements,
        active: activeEntitlements,
        expired: expiredEntitlements
      },
      supporter_payment_marker: {
        total: paymentKeys.length,
        valid: validPayments,
        invalid: invalidPayments,
        linked_to_known_entitlement: paymentsWithKnownEntitlement,
        without_known_entitlement: paymentsWithoutKnownEntitlement
      }
    },
    target_d1: target,
    apply_ready: Boolean(
      invalidEntitlements === 0 &&
      invalidPayments === 0 &&
      target.available &&
      target.counts?.users === 0 &&
      target.counts?.supporter_state === 0 &&
      target.counts?.payments === 0
    )
  };
}
