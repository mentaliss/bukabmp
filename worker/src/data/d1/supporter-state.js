import {requireBotDb} from "./client.js";

function normalizeWallMode(value) {
  return ["public", "anonymous"].includes(String(value || ""))
    ? String(value)
    : "private";
}

function nonNegativeNumber(value) {
  return Math.max(0, Number(value || 0));
}

export function d1SupporterRowToRecord(row) {
  if (!row) return null;
  return {
    user_id: String(row.user_id),
    supporter_until: nonNegativeNumber(row.supporter_until),
    referral_entitlement_total: nonNegativeNumber(row.referral_entitlement_total),
    activation_until: nonNegativeNumber(row.activation_until),
    activation_bonus_pending_days: nonNegativeNumber(row.activation_bonus_pending_days),
    total_stars: nonNegativeNumber(row.total_stars),
    payment_count: nonNegativeNumber(row.payment_count),
    last_payment_at: nonNegativeNumber(row.last_payment_at),
    last_package_id: row.last_package_id ? String(row.last_package_id) : null,
    wall_mode: normalizeWallMode(row.wall_mode),
    tag_applied: Boolean(Number(row.tag_applied || 0)),
    updated_at: nonNegativeNumber(row.updated_at)
  };
}

export async function getD1SupporterState(env, userId) {
  const row = await requireBotDb(env)
    .prepare("SELECT * FROM supporter_state WHERE user_id = ?1")
    .bind(Number(userId))
    .first();
  return d1SupporterRowToRecord(row);
}

export async function putD1SupporterState(
  env,
  userId,
  record,
  updatedAt = Date.now()
) {
  const id = Number(userId);
  const now = Number(updatedAt);
  const db = requireBotDb(env);

  await db.prepare(
    "INSERT INTO supporter_state " +
    "(user_id, supporter_until, referral_entitlement_total, activation_until, " +
      "activation_bonus_pending_days, total_stars, payment_count, last_payment_at, " +
      "last_package_id, wall_mode, tag_applied, updated_at) " +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) " +
    "ON CONFLICT(user_id) DO UPDATE SET " +
      "supporter_until = excluded.supporter_until, " +
      "referral_entitlement_total = excluded.referral_entitlement_total, " +
      "activation_until = excluded.activation_until, " +
      "activation_bonus_pending_days = excluded.activation_bonus_pending_days, " +
      "total_stars = excluded.total_stars, " +
      "payment_count = excluded.payment_count, " +
      "last_payment_at = excluded.last_payment_at, " +
      "last_package_id = excluded.last_package_id, " +
      "wall_mode = excluded.wall_mode, " +
      "tag_applied = excluded.tag_applied, " +
      "updated_at = excluded.updated_at"
  ).bind(
    id,
    nonNegativeNumber(record?.supporter_until),
    nonNegativeNumber(record?.referral_entitlement_total),
    nonNegativeNumber(record?.activation_until),
    nonNegativeNumber(record?.activation_bonus_pending_days),
    nonNegativeNumber(record?.total_stars),
    nonNegativeNumber(record?.payment_count),
    nonNegativeNumber(record?.last_payment_at),
    record?.last_package_id ? String(record.last_package_id) : null,
    normalizeWallMode(record?.wall_mode),
    record?.tag_applied ? 1 : 0,
    now
  ).run();

  return await getD1SupporterState(env, id);
}
