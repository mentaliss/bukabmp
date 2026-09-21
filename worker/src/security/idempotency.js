import {claimProcessedUpdate} from "../data/d1/idempotency.js";
import {d1ReplayEnabled} from "../data/d1/mode.js";

const TELEGRAM_UPDATE_TTL_SECONDS = 7 * 24 * 60 * 60;

export function telegramUpdateKey(updateId) {
  return "telegram-update:" + String(updateId);
}

export async function claimTelegramUpdate(env, updateId) {
  const id = Number(updateId);
  if (!Number.isSafeInteger(id) || id < 0) {
    return {process: true, tracked: false};
  }

  // Optional atomic authority. Binding alone is never enough to activate it.
  if (d1ReplayEnabled(env)) {
    const claim = await claimProcessedUpdate(env, {
      updateId: id,
      type: "telegram"
    });
    return {
      process: Boolean(claim.claimed),
      tracked: true,
      duplicate: !claim.claimed,
      authority: "d1"
    };
  }

  // Backward-compatible production path. KV prevents ordinary sequential
  // redelivery; it is intentionally not claimed to be race-atomic.
  if (!env.PAIRINGS) {
    return {process: true, tracked: false};
  }

  const key = telegramUpdateKey(id);
  const existing = await env.PAIRINGS.get(key);
  if (existing) {
    return {process: false, tracked: true, duplicate: true, authority: "kv"};
  }

  await env.PAIRINGS.put(key, "1", {
    expirationTtl: TELEGRAM_UPDATE_TTL_SECONDS
  });
  return {process: true, tracked: true, duplicate: false, authority: "kv"};
}
