import {requireBotDb} from "./client.js";

const DAY_MS = 86400000;

function validUserId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function qualifyReferralForActivatedUser(
  env,
  {
    referredUserId,
    qualificationRef,
    rewardEventId,
    supporterEventId,
    now = Date.now()
  }
) {
  const referred = validUserId(referredUserId);
  if (!referred) return {qualified: false, reason: "invalid_user_id"};

  const db = requireBotDb(env);
  const at = Number(now);
  const qref = String(qualificationRef);
  const rewardId = String(rewardEventId);
  const supporterId = String(supporterEventId);

  const qualify = db.prepare(
    "UPDATE referrals SET status = 'QUALIFIED', qualified_at = ?2, qualification_ref = ?3 " +
    "WHERE referred_user_id = ?1 AND status = 'ATTRIBUTED'"
  ).bind(referred, at, qref);

  const reward = db.prepare(
    "WITH stats AS (" +
      "SELECT r.referrer_user_id AS user_id, r.referral_id AS referral_id, " +
      "(SELECT COUNT(*) FROM referrals q " +
        "WHERE q.referrer_user_id = r.referrer_user_id AND q.status = 'QUALIFIED') AS valid_count, " +
      "COALESCE((SELECT referral_entitlement_total FROM supporter_state s " +
        "WHERE s.user_id = r.referrer_user_id), 0) AS prior_total " +
      "FROM referrals r " +
      "WHERE r.referred_user_id = ?1 AND r.qualification_ref = ?2 AND r.status = 'QUALIFIED'" +
    "), calc AS (" +
      "SELECT user_id, referral_id, valid_count, prior_total, " +
      "CASE " +
        "WHEN valid_count = 1 THEN 2 " +
        "WHEN valid_count = 2 THEN 4 " +
        "WHEN valid_count = 3 THEN 7 " +
        "WHEN valid_count = 4 THEN 9 " +
        "WHEN valid_count BETWEEN 5 AND 9 THEN 12 " +
        "WHEN valid_count BETWEEN 10 AND 19 THEN 20 " +
        "WHEN valid_count BETWEEN 20 AND 29 THEN 40 " +
        "WHEN valid_count = 30 THEN 60 " +
        "WHEN valid_count > 30 THEN valid_count * 2 " +
        "ELSE 0 END AS total_days " +
      "FROM stats" +
    ") " +
    "INSERT INTO referral_rewards " +
    "(reward_event_id, user_id, valid_referral_count, entitlement_total_days, " +
      "credited_delta_days, source_ref, created_at) " +
    "SELECT ?3, user_id, valid_count, total_days, " +
      "MAX(0, total_days - prior_total), 'referral:' || referral_id, ?4 " +
    "FROM calc"
  ).bind(referred, qref, rewardId, at);

  const ensureState = db.prepare(
    "INSERT OR IGNORE INTO supporter_state (user_id, updated_at) " +
    "SELECT user_id, ?2 FROM referral_rewards WHERE reward_event_id = ?1"
  ).bind(rewardId, at);

  const applyReward = db.prepare(
    "UPDATE supporter_state SET " +
      "supporter_until = CASE " +
        "WHEN COALESCE((SELECT credited_delta_days FROM referral_rewards " +
          "WHERE reward_event_id = ?1), 0) > 0 " +
        "THEN MAX(?2, supporter_until) + " +
          "COALESCE((SELECT credited_delta_days FROM referral_rewards " +
            "WHERE reward_event_id = ?1), 0) * ?3 " +
        "ELSE supporter_until END, " +
      "referral_entitlement_total = COALESCE(" +
        "(SELECT entitlement_total_days FROM referral_rewards WHERE reward_event_id = ?1), " +
        "referral_entitlement_total), " +
      "updated_at = ?2 " +
    "WHERE user_id = (SELECT user_id FROM referral_rewards WHERE reward_event_id = ?1)"
  ).bind(rewardId, at, DAY_MS);

  const auditEvent = db.prepare(
    "INSERT INTO supporter_events " +
    "(event_id, user_id, source, days_delta, source_ref, created_at) " +
    "SELECT ?1, user_id, 'referral', credited_delta_days, source_ref, ?3 " +
    "FROM referral_rewards WHERE reward_event_id = ?2"
  ).bind(supporterId, rewardId, at);

  const results = await db.batch([
    qualify,
    reward,
    ensureState,
    applyReward,
    auditEvent
  ]);

  const qualified = Number(results?.[0]?.meta?.changes || 0) === 1;
  if (!qualified) {
    return {qualified: false, reason: "already_qualified_or_unattributed"};
  }

  const row = await db.prepare(
    "SELECT user_id, valid_referral_count, entitlement_total_days, credited_delta_days " +
    "FROM referral_rewards WHERE reward_event_id = ?1"
  ).bind(rewardId).first();

  return {
    qualified: true,
    referrerUserId: Number(row?.user_id || 0) || null,
    validReferralCount: Math.max(0, Number(row?.valid_referral_count || 0)),
    entitlementTotalDays: Math.max(0, Number(row?.entitlement_total_days || 0)),
    creditedDeltaDays: Math.max(0, Number(row?.credited_delta_days || 0))
  };
}
