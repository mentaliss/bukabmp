export const SUPPORTER_ACTIVATION_BONUS_DAYS = 14;
export const SUPPORTER_ACTIVATION_MAX_DAYS = 60;
export const SUPPORTER_CONTEXT_TTL_SECONDS = 6 * 60 * 60;
export const SUPPORTER_CONTEXT_MAX_TURNS = 6;
export const SUPPORTER_MEMBER_TAG = "BMP Supporter";

const SUPPORTER_PACKAGES = Object.freeze({
  day: Object.freeze({id: "day", stars: 2, days: 1, title: "Supporter Pass — 1 Hari"}),
  month: Object.freeze({id: "month", stars: 50, days: 30, title: "Supporter Pass — 30 Hari"})
});

export function supporterEntitlementKey(userId) {
  return "supporter:user:" + String(userId);
}

export function supporterInvoiceKey(nonce) {
  return "supporter-invoice:" + String(nonce);
}

export function supporterPaymentKey(chargeIdHash) {
  return "supporter-payment:" + String(chargeIdHash);
}

export function supporterContextKey(userId, chatId) {
  return "supporter-context:" + String(userId) + ":" + String(chatId);
}

export function supporterWallKey(userId) {
  return "supporter-wall:" + String(userId);
}

export function supporterPackage(packageId) {
  return SUPPORTER_PACKAGES[String(packageId || "").trim()] || null;
}

export function formatWibDateTime(ms) {
  if (!Number.isFinite(Number(ms)) || Number(ms) <= 0) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(Number(ms))) + " WIB";
}

export function supporterIsActive(record, now = Date.now()) {
  return Boolean(record && Number(record.supporter_until || 0) > now);
}

export function parseSupportInvoicePayload(payload) {
  const match = String(payload || "").match(/^support:v1:(day|month):(\d+):([A-Za-z0-9_-]{8,40})$/);
  if (!match) return null;
  return {package_id: match[1], user_id: match[2], nonce: match[3]};
}
