import {sha256Hex} from "../security/crypto.js";
import {createOpaqueReferralCode} from "./referral.js";
import {supporterPackage} from "./supporter-model.js";
import {
  d1BindingAvailable,
  d1MigrationEnabled
} from "../data/d1/mode.js";

const ENTITLEMENT_PREFIX = "supporter:user:";
const PAYMENT_PREFIX = "supporter-payment:";
const APPLY_CONFIRMATION = "APPLY_SUPPORTER_KV_TO_D1_V1";

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

function safeNumber(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function wallMode(value) {
  const mode = String(value || "private");
  return ["private", "public", "anonymous"].includes(mode)
    ? mode
    : null;
}

function normalizeEntitlement(record, keyUserId) {
  if (!record || typeof record !== "object") return null;

  const keyId = safeInteger(keyUserId);
  const recordId = safeInteger(record.user_id);
  if (!keyId || !recordId || keyId !== recordId) return null;

  const normalized = {
    userId: recordId,
    supporterUntil: safeNumber(record.supporter_until),
    referralEntitlementTotal: safeNumber(record.referral_entitlement_total),
    activationUntil: safeNumber(record.activation_until),
    activationBonusPendingDays: safeNumber(record.activation_bonus_pending_days),
    totalStars: safeNumber(record.total_stars),
    paymentCount: safeNumber(record.payment_count),
    lastPaymentAt: safeNumber(record.last_payment_at),
    lastPackageId: record.last_package_id
      ? String(record.last_package_id)
      : null,
    wallMode: wallMode(record.wall_mode),
    tagApplied: Boolean(record.tag_applied)
  };

  for (const value of [
    normalized.supporterUntil,
    normalized.referralEntitlementTotal,
    normalized.activationUntil,
    normalized.activationBonusPendingDays,
    normalized.totalStars,
    normalized.paymentCount,
    normalized.lastPaymentAt
  ]) {
    if (value == null || value < 0) return null;
  }

  if (!normalized.wallMode) return null;
  if (
    normalized.lastPackageId &&
    !supporterPackage(normalized.lastPackageId)
  ) return null;

  return normalized;
}

async function normalizePaymentMarker(record, key) {
  if (!record || typeof record !== "object") return null;

  const userId = safeInteger(record.user_id);
  const pkg = supporterPackage(record.package_id);
  const stars = safeNumber(record.stars);
  const processedAt = safeNumber(record.processed_at);
  const rawCharge = String(record.telegram_payment_charge_id || "");
  const chargeRef = String(key || "").slice(PAYMENT_PREFIX.length);

  if (
    !userId ||
    !pkg ||
    stars !== pkg.stars ||
    !rawCharge ||
    !processedAt ||
    !/^[a-f0-9]{64}$/i.test(chargeRef)
  ) return null;

  const expectedRef = await sha256Hex("support-payment:" + rawCharge);
  if (expectedRef !== chargeRef) return null;

  return {
    userId,
    packageId: pkg.id,
    stars: pkg.stars,
    processedAt,
    chargeRef
  };
}

async function sourceSnapshot(env) {
  if (!env?.PAIRINGS || typeof env.PAIRINGS.list !== "function") {
    return {ok: false, reason: "kv_unavailable"};
  }

  const entitlementKeys = await listAllByPrefix(
    env.PAIRINGS,
    ENTITLEMENT_PREFIX
  );
  const paymentKeys = await listAllByPrefix(
    env.PAIRINGS,
    PAYMENT_PREFIX
  );

  const entitlements = [];
  const payments = [];
  let invalidEntitlements = 0;
  let invalidPayments = 0;
  let activeEntitlements = 0;
  let expiredEntitlements = 0;

  for (const item of entitlementKeys) {
    const key = String(item?.name || "");
    const keyUserId = key.slice(ENTITLEMENT_PREFIX.length);
    const record = await env.PAIRINGS.get(key, "json");
    const normalized = normalizeEntitlement(record, keyUserId);
    if (!normalized) {
      invalidEntitlements += 1;
      continue;
    }

    entitlements.push({key, ...normalized});
    if (normalized.supporterUntil > Date.now()) {
      activeEntitlements += 1;
    } else {
      expiredEntitlements += 1;
    }
  }

  const entitlementIds = new Set(
    entitlements.map(item => String(item.userId))
  );
  let linkedPayments = 0;
  let unlinkedPayments = 0;

  for (const item of paymentKeys) {
    const key = String(item?.name || "");
    const record = await env.PAIRINGS.get(key, "json");
    const normalized = await normalizePaymentMarker(record, key);
    if (!normalized) {
      invalidPayments += 1;
      continue;
    }

    payments.push({key, ...normalized});
    if (entitlementIds.has(String(normalized.userId))) {
      linkedPayments += 1;
    } else {
      unlinkedPayments += 1;
    }
  }

  return {
    ok: invalidEntitlements === 0 &&
      invalidPayments === 0 &&
      unlinkedPayments === 0,
    entitlements,
    payments,
    summary: {
      supporter_entitlement: {
        total: entitlementKeys.length,
        valid: entitlements.length,
        invalid: invalidEntitlements,
        active: activeEntitlements,
        expired: expiredEntitlements
      },
      supporter_payment_marker: {
        total: paymentKeys.length,
        valid: payments.length,
        invalid: invalidPayments,
        linked_to_known_entitlement: linkedPayments,
        without_known_entitlement: unlinkedPayments
      }
    }
  };
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

function stateMatches(row, source) {
  if (!row) return false;
  return (
    Number(row.user_id) === source.userId &&
    Number(row.supporter_until || 0) === source.supporterUntil &&
    Number(row.referral_entitlement_total || 0) === source.referralEntitlementTotal &&
    Number(row.activation_until || 0) === source.activationUntil &&
    Number(row.activation_bonus_pending_days || 0) === source.activationBonusPendingDays &&
    Number(row.total_stars || 0) === source.totalStars &&
    Number(row.payment_count || 0) === source.paymentCount &&
    Number(row.last_payment_at || 0) === source.lastPaymentAt &&
    String(row.last_package_id || "") === String(source.lastPackageId || "") &&
    String(row.wall_mode || "private") === source.wallMode &&
    Boolean(Number(row.tag_applied || 0)) === source.tagApplied
  );
}

function paymentMatches(row, source) {
  if (!row) return false;
  return (
    String(row.telegram_charge_ref || "") === source.chargeRef &&
    Number(row.user_id) === source.userId &&
    String(row.package_id || "") === source.packageId &&
    Number(row.stars || 0) === source.stars &&
    Number(row.processed_at || 0) === source.processedAt &&
    String(row.status || "") === "PROCESSED"
  );
}

async function inspectTargetState(env, snapshot) {
  const counts = await d1TargetCounts(env);
  if (!counts.available) {
    return {
      available: false,
      counts: null,
      empty: false,
      already_applied: false,
      conflicting: false
    };
  }

  let matches = 0;
  for (const source of snapshot.entitlements) {
    const user = await env.BOT_DB
      .prepare("SELECT telegram_user_id FROM users WHERE telegram_user_id = ?1")
      .bind(source.userId)
      .first();
    const state = await env.BOT_DB
      .prepare("SELECT * FROM supporter_state WHERE user_id = ?1")
      .bind(source.userId)
      .first();

    if (Number(user?.telegram_user_id) === source.userId &&
        stateMatches(state, source)) {
      matches += 1;
    }
  }

  let paymentMatchesCount = 0;
  for (const source of snapshot.payments) {
    const payment = await env.BOT_DB
      .prepare("SELECT * FROM payments WHERE telegram_charge_ref = ?1")
      .bind(source.chargeRef)
      .first();
    if (paymentMatches(payment, source)) {
      paymentMatchesCount += 1;
    }
  }

  const empty = (
    counts.counts.users === 0 &&
    counts.counts.supporter_state === 0 &&
    counts.counts.payments === 0
  );
  const alreadyApplied = (
    snapshot.entitlements.length > 0 &&
    matches === snapshot.entitlements.length &&
    paymentMatchesCount === snapshot.payments.length
  );

  return {
    available: true,
    counts: counts.counts,
    empty,
    already_applied: alreadyApplied,
    conflicting: !empty && !alreadyApplied
  };
}

export async function supporterMigrationDryRun(env) {
  const snapshot = await sourceSnapshot(env);
  if (!snapshot.ok) {
    return {
      ok: false,
      reason: snapshot.reason || "source_validation_failed",
      source: snapshot.summary || null,
      target_d1: await d1TargetCounts(env),
      apply_ready: false
    };
  }

  const target = await inspectTargetState(env, snapshot);
  return {
    ok: true,
    source: snapshot.summary,
    target_d1: {
      available: target.available,
      counts: target.counts
    },
    already_applied: target.already_applied,
    apply_ready: Boolean(
      target.available &&
      target.empty &&
      !target.already_applied
    )
  };
}

export async function supporterMigrationApply(env, confirmation) {
  if (!d1MigrationEnabled(env)) {
    return {ok: false, reason: "migration_disabled"};
  }
  if (String(confirmation || "") !== APPLY_CONFIRMATION) {
    return {ok: false, reason: "confirmation_required"};
  }

  const snapshot = await sourceSnapshot(env);
  if (!snapshot.ok) {
    return {
      ok: false,
      reason: snapshot.reason || "source_validation_failed"
    };
  }

  const target = await inspectTargetState(env, snapshot);
  if (!target.available) {
    return {ok: false, reason: "d1_unavailable"};
  }
  if (target.already_applied) {
    return {
      ok: true,
      applied: false,
      already_applied: true,
      migrated: {
        users: snapshot.entitlements.length,
        supporter_state: snapshot.entitlements.length,
        payments: snapshot.payments.length
      }
    };
  }
  if (!target.empty) {
    return {ok: false, reason: "target_not_empty_or_conflicting"};
  }

  const now = Date.now();
  const statements = [];
  const referralCodes = new Set();

  for (const source of snapshot.entitlements) {
    let referralCode;
    do {
      referralCode = createOpaqueReferralCode();
    } while (referralCodes.has(referralCode));
    referralCodes.add(referralCode);

    statements.push(
      env.BOT_DB.prepare(
        "INSERT INTO users " +
        "(telegram_user_id, created_at, referral_code, updated_at) " +
        "VALUES (?1, ?2, ?3, ?4)"
      ).bind(
        source.userId,
        source.lastPaymentAt > 0 ? source.lastPaymentAt : now,
        referralCode,
        now
      )
    );

    statements.push(
      env.BOT_DB.prepare(
        "INSERT INTO supporter_state " +
        "(user_id, supporter_until, referral_entitlement_total, activation_until, " +
          "activation_bonus_pending_days, total_stars, payment_count, last_payment_at, " +
          "last_package_id, wall_mode, tag_applied, updated_at) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
      ).bind(
        source.userId,
        source.supporterUntil,
        source.referralEntitlementTotal,
        source.activationUntil,
        source.activationBonusPendingDays,
        source.totalStars,
        source.paymentCount,
        source.lastPaymentAt,
        source.lastPackageId,
        source.wallMode,
        source.tagApplied ? 1 : 0,
        now
      )
    );

    const sourceHash = await sha256Hex("migration:entitlement:" + source.key);
    statements.push(
      env.BOT_DB.prepare(
        "INSERT INTO supporter_events " +
        "(event_id, user_id, source, days_delta, source_ref, created_at) " +
        "VALUES (?1, ?2, 'migration', 0, ?3, ?4)"
      ).bind(
        "migration_" + sourceHash,
        source.userId,
        "migration:kv:" + sourceHash,
        now
      )
    );
  }

  for (const source of snapshot.payments) {
    statements.push(
      env.BOT_DB.prepare(
        "INSERT INTO payments " +
        "(payment_event_id, telegram_charge_ref, user_id, package_id, stars, processed_at, status) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'PROCESSED')"
      ).bind(
        "migration_payment_" + source.chargeRef,
        source.chargeRef,
        source.userId,
        source.packageId,
        source.stars,
        source.processedAt
      )
    );
  }

  await env.BOT_DB.batch(statements);

  const verified = await inspectTargetState(env, snapshot);
  if (!verified.already_applied) {
    return {ok: false, reason: "post_verify_failed"};
  }

  return {
    ok: true,
    applied: true,
    already_applied: false,
    migrated: {
      users: snapshot.entitlements.length,
      supporter_state: snapshot.entitlements.length,
      payments: snapshot.payments.length,
      migration_events: snapshot.entitlements.length
    },
    kv_deleted: 0
  };
}

export const SUPPORTER_MIGRATION_CONFIRMATION = APPLY_CONFIRMATION;
