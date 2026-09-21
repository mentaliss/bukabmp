import {requireBotDb} from "./client.js";

export async function getReferralByReferredUser(env, referredUserId) {
  return await requireBotDb(env)
    .prepare("SELECT * FROM referrals WHERE referred_user_id = ?1")
    .bind(Number(referredUserId))
    .first();
}

export async function getQualifiedReferralCount(env, referrerUserId) {
  const row = await requireBotDb(env)
    .prepare(
      "SELECT COUNT(*) AS count FROM referrals " +
      "WHERE referrer_user_id = ?1 AND status = 'QUALIFIED'"
    )
    .bind(Number(referrerUserId))
    .first();
  return Math.max(0, Number(row?.count || 0));
}

export async function createFirstTouchReferral(
  env,
  {referralId, referrerUserId, referredUserId, now = Date.now()}
) {
  const referrer = Number(referrerUserId);
  const referred = Number(referredUserId);
  if (!Number.isSafeInteger(referrer) || !Number.isSafeInteger(referred)) {
    return {created: false, reason: "invalid_user_id"};
  }
  if (referrer === referred) {
    return {created: false, reason: "self_referral"};
  }

  const db = requireBotDb(env);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO referrals " +
    "(referral_id, referrer_user_id, referred_user_id, attributed_at, status) " +
    "VALUES (?1, ?2, ?3, ?4, 'ATTRIBUTED')"
  ).bind(String(referralId), referrer, referred, Number(now));

  // Tie users.referred_by to the referral row that actually won the UNIQUE
  // referred_user_id race. A losing concurrent referrer cannot overwrite it.
  const linkUser = db.prepare(
    "UPDATE users SET referred_by = ?1, updated_at = ?3 " +
    "WHERE telegram_user_id = ?2 AND referred_by IS NULL " +
    "AND EXISTS (" +
      "SELECT 1 FROM referrals " +
      "WHERE referred_user_id = ?2 AND referrer_user_id = ?1" +
    ")"
  ).bind(referrer, referred, Number(now));

  const results = await db.batch([insert, linkUser]);
  const created = Number(results?.[0]?.meta?.changes || 0) === 1;

  return {
    created,
    reason: created ? null : "already_attributed"
  };
}
