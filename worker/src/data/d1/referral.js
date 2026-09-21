import {requireBotDb} from "./client.js";

export async function getReferralByReferredUser(env, referredUserId) {
  return await requireBotDb(env)
    .prepare("SELECT * FROM referrals WHERE referred_user_id = ?1")
    .bind(Number(referredUserId))
    .first();
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

  const result = await requireBotDb(env)
    .prepare(
      "INSERT OR IGNORE INTO referrals " +
      "(referral_id, referrer_user_id, referred_user_id, attributed_at, status) " +
      "VALUES (?1, ?2, ?3, ?4, 'ATTRIBUTED')"
    )
    .bind(String(referralId), referrer, referred, Number(now))
    .run();

  return {
    created: Number(result?.meta?.changes || 0) === 1,
    reason: Number(result?.meta?.changes || 0) === 1
      ? null
      : "already_attributed"
  };
}
