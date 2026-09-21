const TELEGRAM_UPDATE_TTL_SECONDS = 7 * 24 * 60 * 60;

export function telegramUpdateKey(updateId) {
  return "telegram-update:" + String(updateId);
}

// KV-backed replay protection is intentionally a compatibility layer.
// It prevents ordinary Telegram redelivery/replay but is not a transactional
// compare-and-set. D1 will become the durable atomic authority in the D1 phase.
export async function claimTelegramUpdate(env, updateId) {
  const id = Number(updateId);
  if (!Number.isSafeInteger(id) || id < 0 || !env.PAIRINGS) {
    return {process: true, tracked: false};
  }

  const key = telegramUpdateKey(id);
  const existing = await env.PAIRINGS.get(key);
  if (existing) {
    return {process: false, tracked: true, duplicate: true};
  }

  await env.PAIRINGS.put(key, "1", {
    expirationTtl: TELEGRAM_UPDATE_TTL_SECONDS
  });
  return {process: true, tracked: true, duplicate: false};
}
