import {requireBotDb} from "./client.js";

const DAY_MS = 86400000;

export async function applySupporterPaymentTransaction(
  env,
  {
    paymentEventId,
    supporterEventId,
    telegramChargeRef,
    userId,
    packageId,
    stars,
    days,
    activationBonusDays,
    activationMaxDays,
    tokenTtlDays,
    seed = {},
    processedAt = Date.now()
  }
) {
  const db = requireBotDb(env);
  const now = Number(processedAt);
  const id = Number(userId);
  const paymentId = String(paymentEventId);
  const supporterId = String(supporterEventId);
  const chargeRef = String(telegramChargeRef);
  const pkg = String(packageId);
  const dayCount = Math.max(0, Number(days || 0));
  const starCount = Math.max(0, Number(stars || 0));
  const bonusDays = Math.max(0, Number(activationBonusDays || 0));
  const maxDays = Math.max(0, Number(activationMaxDays || 0));
  const baseTokenDays = Math.max(0, Number(tokenTtlDays || 0));
  const maxPendingDays = Math.max(0, maxDays - baseTokenDays);
  const maxActivation = now + maxDays * DAY_MS;

  const insertPayment = db.prepare(
    "INSERT INTO payments " +
    "(payment_event_id, telegram_charge_ref, user_id, package_id, stars, processed_at, status) " +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'PROCESSED')"
  ).bind(paymentId, chargeRef, id, pkg, starCount, now);

  const seedState = db.prepare(
    "INSERT OR IGNORE INTO supporter_state " +
    "(user_id, supporter_until, referral_entitlement_total, activation_until, " +
      "activation_bonus_pending_days, total_stars, payment_count, last_payment_at, " +
      "last_package_id, wall_mode, tag_applied, updated_at) " +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
  ).bind(
    id,
    Math.max(0, Number(seed.supporter_until || 0)),
    Math.max(0, Number(seed.referral_entitlement_total || 0)),
    Math.max(0, Number(seed.activation_until || 0)),
    Math.max(0, Number(seed.activation_bonus_pending_days || 0)),
    Math.max(0, Number(seed.total_stars || 0)),
    Math.max(0, Number(seed.payment_count || 0)),
    Math.max(0, Number(seed.last_payment_at || 0)),
    seed.last_package_id ? String(seed.last_package_id) : null,
    ["public", "anonymous"].includes(seed.wall_mode) ? seed.wall_mode : "private",
    seed.tag_applied ? 1 : 0,
    now
  );

  const updateState = db.prepare(
    "UPDATE supporter_state SET " +
      "supporter_until = MAX(?2, supporter_until) + ?3, " +
      "total_stars = total_stars + ?4, " +
      "payment_count = payment_count + 1, " +
      "last_payment_at = ?2, " +
      "last_package_id = ?5, " +
      "activation_until = CASE " +
        "WHEN activation_until > ?2 THEN MIN(activation_until + ?6, ?7) " +
        "ELSE activation_until END, " +
      "activation_bonus_pending_days = CASE " +
        "WHEN activation_until > ?2 THEN activation_bonus_pending_days " +
        "ELSE MIN(?8, activation_bonus_pending_days + ?9) END, " +
      "updated_at = ?2 " +
    "WHERE user_id = ?1"
  ).bind(
    id,
    now,
    dayCount * DAY_MS,
    starCount,
    pkg,
    bonusDays * DAY_MS,
    maxActivation,
    maxPendingDays,
    bonusDays
  );

  const event = db.prepare(
    "INSERT INTO supporter_events " +
    "(event_id, user_id, source, days_delta, source_ref, created_at) " +
    "VALUES (?1, ?2, 'stars', ?3, ?4, ?5)"
  ).bind(
    supporterId,
    id,
    dayCount,
    "payment:" + chargeRef,
    now
  );

  await db.batch([insertPayment, seedState, updateState, event]);

  return await db.prepare(
    "SELECT * FROM supporter_state WHERE user_id = ?1"
  ).bind(id).first();
}

export async function getPaymentByChargeRef(env, telegramChargeRef) {
  return await requireBotDb(env)
    .prepare("SELECT * FROM payments WHERE telegram_charge_ref = ?1")
    .bind(String(telegramChargeRef))
    .first();
}
