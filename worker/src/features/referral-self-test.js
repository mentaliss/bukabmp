import {envFlagEnabled} from "../data/d1/mode.js";
import {requireBotDb} from "../data/d1/client.js";
import {
  attributeReferralFromCode,
  ensureReferralUser,
  qualifyReferralAfterActivation
} from "./referral-service.js";
import {supporterEntitlementKey} from "./supporter-model.js";

// Telegram Bot API identifiers stay below 2^52. These reserved synthetic IDs
// are above that range but remain below Number.MAX_SAFE_INTEGER.
const IDS = Object.freeze([
  8000000000000001,
  8000000000000002,
  8000000000000003
]);

export const REFERRAL_SELF_TEST_CONFIRMATION = "RUN_REFERRAL_D1_SELF_TEST_V1";

function selfTestEnabled(env) {
  return envFlagEnabled(env, "BOT_V2_REFERRAL_SELF_TEST_ENABLED");
}

async function cleanup(env) {
  const db = requireBotDb(env);
  const [a, b, c] = IDS;

  await db.batch([
    db.prepare(
      "DELETE FROM supporter_events WHERE user_id IN (?1, ?2, ?3)"
    ).bind(a, b, c),
    db.prepare(
      "DELETE FROM referral_rewards WHERE user_id IN (?1, ?2, ?3)"
    ).bind(a, b, c),
    db.prepare(
      "DELETE FROM referrals WHERE referrer_user_id IN (?1, ?2, ?3) " +
      "OR referred_user_id IN (?1, ?2, ?3)"
    ).bind(a, b, c),
    db.prepare(
      "DELETE FROM supporter_state WHERE user_id IN (?1, ?2, ?3)"
    ).bind(a, b, c),
    db.prepare(
      "DELETE FROM payments WHERE user_id IN (?1, ?2, ?3)"
    ).bind(a, b, c),
    db.prepare(
      "DELETE FROM users WHERE telegram_user_id IN (?1, ?2, ?3)"
    ).bind(a, b, c)
  ]);

  if (env?.PAIRINGS?.delete) {
    for (const id of IDS) {
      await env.PAIRINGS.delete(supporterEntitlementKey(id)).catch(() => {});
    }
  }
}

async function cleanupVerified(env) {
  const db = requireBotDb(env);
  const [a, b, c] = IDS;
  const row = await db.prepare(
    "SELECT " +
      "(SELECT COUNT(*) FROM users WHERE telegram_user_id IN (?1, ?2, ?3)) AS users_left, " +
      "(SELECT COUNT(*) FROM referrals WHERE referrer_user_id IN (?1, ?2, ?3) " +
        "OR referred_user_id IN (?1, ?2, ?3)) AS referrals_left, " +
      "(SELECT COUNT(*) FROM supporter_state WHERE user_id IN (?1, ?2, ?3)) AS states_left, " +
      "(SELECT COUNT(*) FROM referral_rewards WHERE user_id IN (?1, ?2, ?3)) AS rewards_left, " +
      "(SELECT COUNT(*) FROM supporter_events WHERE user_id IN (?1, ?2, ?3)) AS events_left, " +
      "(SELECT COUNT(*) FROM payments WHERE user_id IN (?1, ?2, ?3)) AS payments_left"
  ).bind(a, b, c).first();

  const d1Clean = (
    Number(row?.users_left || 0) === 0 &&
    Number(row?.referrals_left || 0) === 0 &&
    Number(row?.states_left || 0) === 0 &&
    Number(row?.rewards_left || 0) === 0 &&
    Number(row?.events_left || 0) === 0 &&
    Number(row?.payments_left || 0) === 0
  );

  let kvClean = true;
  if (env?.PAIRINGS) {
    for (const id of IDS) {
      const value = await env.PAIRINGS.get(supporterEntitlementKey(id), "json");
      if (value) kvClean = false;
    }
  }

  return d1Clean && kvClean;
}

export async function runReferralSelfTest(env, confirmation) {
  if (!selfTestEnabled(env)) {
    return {ok: false, reason: "self_test_disabled"};
  }
  if (String(confirmation || "") !== REFERRAL_SELF_TEST_CONFIRMATION) {
    return {ok: false, reason: "confirmation_required"};
  }

  let result = {ok: false, reason: "self_test_failed"};
  try {
    await cleanup(env);

    const referrerA = await ensureReferralUser(env, IDS[0]);
    const referrerB = await ensureReferralUser(env, IDS[1]);
    const referred = await ensureReferralUser(env, IDS[2]);

    if (!referrerA.user || !referrerB.user || !referred.user) {
      result = {ok: false, reason: "synthetic_user_create_failed"};
    } else {
      const selfReferral = await attributeReferralFromCode(
        env,
        IDS[0],
        referrerA.user.referral_code
      );

      const firstTouch = await attributeReferralFromCode(
        env,
        IDS[2],
        referrerA.user.referral_code
      );

      const secondTouch = await attributeReferralFromCode(
        env,
        IDS[2],
        referrerB.user.referral_code
      );

      const firstQualification = await qualifyReferralAfterActivation(
        env,
        IDS[2]
      );

      const secondQualification = await qualifyReferralAfterActivation(
        env,
        IDS[2]
      );

      const db = requireBotDb(env);
      const referral = await db.prepare(
        "SELECT referrer_user_id, referred_user_id, status " +
        "FROM referrals WHERE referred_user_id = ?1"
      ).bind(IDS[2]).first();

      const rewardCount = await db.prepare(
        "SELECT COUNT(*) AS count FROM referral_rewards WHERE user_id = ?1"
      ).bind(IDS[0]).first();

      const state = await db.prepare(
        "SELECT supporter_until, referral_entitlement_total " +
        "FROM supporter_state WHERE user_id = ?1"
      ).bind(IDS[0]).first();

      const kvMirror = env?.PAIRINGS
        ? await env.PAIRINGS.get(supporterEntitlementKey(IDS[0]), "json")
        : null;

      const checks = {
        self_referral_rejected:
          selfReferral.created === false &&
          selfReferral.reason === "self_referral",
        first_touch_created: firstTouch.created === true,
        second_referrer_rejected:
          secondTouch.created === false &&
          secondTouch.reason === "already_attributed",
        winning_referrer_preserved:
          Number(referral?.referrer_user_id) === IDS[0] &&
          Number(referral?.referred_user_id) === IDS[2],
        referral_qualified: String(referral?.status || "") === "QUALIFIED",
        qualified_once:
          firstQualification.qualified === true &&
          firstQualification.validReferralCount === 1 &&
          firstQualification.entitlementTotalDays === 2 &&
          firstQualification.creditedDeltaDays === 2,
        duplicate_qualification_rejected:
          secondQualification.qualified === false &&
          secondQualification.reason === "already_qualified_or_unattributed",
        single_reward_row: Number(rewardCount?.count || 0) === 1,
        supporter_reward_applied:
          Number(state?.referral_entitlement_total || 0) === 2 &&
          Number(state?.supporter_until || 0) > Date.now(),
        kv_rollback_mirror:
          Number(kvMirror?.referral_entitlement_total || 0) === 2 &&
          Number(kvMirror?.supporter_until || 0) ===
            Number(state?.supporter_until || 0)
      };

      result = {
        ok: Object.values(checks).every(Boolean),
        checks
      };
    }
  } catch {
    result = {ok: false, reason: "self_test_failed"};
  } finally {
    let cleanupOk = false;
    try {
      await cleanup(env);
      cleanupOk = await cleanupVerified(env);
    } catch {
      cleanupOk = false;
    }

    result.cleanup_ok = cleanupOk;
    result.ok = Boolean(result.ok && cleanupOk);
    if (!cleanupOk) {
      console.error("referral_self_test_cleanup_failed");
    }
  }

  return result;
}
