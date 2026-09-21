import {randomToken} from "../security/crypto.js";
import {telegramBotUsername} from "../telegram/router.js";

export function createOpaqueReferralCode() {
  return randomToken(12);
}

export function parseReferralStartArg(value) {
  const match = String(value || "").trim().match(/^ref_([A-Za-z0-9_-]{12,40})$/);
  return match ? match[1] : null;
}

export function referralDeepLink(env, code) {
  const value = String(code || "").trim();
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(value)) return null;
  return "https://t.me/" + telegramBotUsername(env) + "?start=ref_" + value;
}

// Frozen Owner schedule. These are total referral-derived Supporter days,
// not additive milestone bonuses.
export function referralEntitlementTotalDays(validReferralCount) {
  const count = Math.max(0, Math.floor(Number(validReferralCount) || 0));
  if (count === 0) return 0;
  if (count === 1) return 2;
  if (count === 2) return 4;
  if (count === 3) return 7;
  if (count === 4) return 9;
  if (count < 10) return 12;
  if (count < 20) return 20;
  if (count < 30) return 40;
  if (count === 30) return 60;
  return count * 2;
}

export function referralRewardDelta(validReferralCount, alreadyCreditedTotalDays) {
  const entitlementTotalDays = referralEntitlementTotalDays(validReferralCount);
  const credited = Math.max(0, Math.floor(Number(alreadyCreditedTotalDays) || 0));
  return {
    entitlementTotalDays,
    creditedDeltaDays: Math.max(0, entitlementTotalDays - credited)
  };
}
