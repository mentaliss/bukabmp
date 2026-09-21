import {randomToken} from "../security/crypto.js";
import {
  createOpaqueReferralCode,
  referralDeepLink,
  referralEntitlementTotalDays
} from "./referral.js";
import {createUserIfMissing, getUserById, getUserByReferralCode} from "../data/d1/users.js";
import {
  createFirstTouchReferral,
  getQualifiedReferralCount
} from "../data/d1/referral.js";

function d1Available(env) {
  return Boolean(env?.BOT_DB && typeof env.BOT_DB.prepare === "function");
}

export async function ensureReferralUser(env, telegramUserId) {
  if (!d1Available(env)) return {available: false, user: null};

  const id = Number(telegramUserId);
  if (!Number.isSafeInteger(id)) return {available: true, user: null, reason: "invalid_user_id"};

  const existing = await getUserById(env, id);
  if (existing) return {available: true, user: existing};

  for (let attempt = 0; attempt < 5; attempt++) {
    const referralCode = createOpaqueReferralCode();
    const user = await createUserIfMissing(env, {
      telegramUserId: id,
      referralCode
    });
    if (user) return {available: true, user};
  }

  return {available: true, user: null, reason: "referral_code_collision"};
}

export async function attributeReferralFromCode(env, referredUserId, referralCode) {
  if (!d1Available(env)) return {available: false, created: false};

  const referred = await ensureReferralUser(env, referredUserId);
  if (!referred.user) {
    return {
      available: true,
      created: false,
      reason: referred.reason || "user_unavailable"
    };
  }

  const referrer = await getUserByReferralCode(env, referralCode);
  if (!referrer) {
    return {available: true, created: false, reason: "invalid_referral_code"};
  }

  const result = await createFirstTouchReferral(env, {
    referralId: "ref_" + randomToken(18),
    referrerUserId: referrer.telegram_user_id,
    referredUserId: referred.user.telegram_user_id
  });

  return {available: true, ...result};
}

export async function referralHomeState(env, telegramUserId) {
  const ensured = await ensureReferralUser(env, telegramUserId);
  if (!ensured.available) return {available: false};
  if (!ensured.user) {
    return {available: true, error: ensured.reason || "user_unavailable"};
  }

  const qualifiedCount = await getQualifiedReferralCount(
    env,
    ensured.user.telegram_user_id
  );

  return {
    available: true,
    referralCode: ensured.user.referral_code,
    link: referralDeepLink(env, ensured.user.referral_code),
    qualifiedCount,
    entitlementTotalDays: referralEntitlementTotalDays(qualifiedCount)
  };
}
