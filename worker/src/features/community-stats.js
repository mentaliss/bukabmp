import {tg} from "../telegram/api.js";

const CACHE_KEY = "community-stats:v1";
const CACHE_MS = 10 * 60 * 1000;

function validCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

async function telegramCount(env, chatId) {
  if (!chatId) return null;
  const result = await tg(env, "getChatMemberCount", {chat_id: chatId});
  return validCount(result);
}

async function storeDaily(env, snapshot) {
  if (!env?.BOT_DB || typeof env.BOT_DB.prepare !== "function") return;
  const day = new Date(snapshot.captured_at).toISOString().slice(0, 10);
  await env.BOT_DB.prepare(
    "INSERT INTO community_daily(date, subscribers, members, captured_at) VALUES(?, ?, ?, ?) " +
    "ON CONFLICT(date) DO UPDATE SET subscribers = excluded.subscribers, members = excluded.members, captured_at = excluded.captured_at"
  ).bind(day, snapshot.subscribers, snapshot.members, snapshot.captured_at).run();
}

export async function communityStats(env, {force = false} = {}, now = Date.now()) {
  const cached = env?.PAIRINGS ? await env.PAIRINGS.get(CACHE_KEY, "json") : null;
  if (!force && cached?.captured_at && now - Number(cached.captured_at) < CACHE_MS) {
    return {...cached, cached: true};
  }

  const channelId = String(env?.CHANNEL_ID || "").trim();
  const groupId = String(env?.SUPPORT_GROUP_ID || env?.GROUP_ID || "").trim();
  let subscribers = null;
  let members = null;
  let error = "";

  try {
    [subscribers, members] = await Promise.all([
      telegramCount(env, channelId),
      telegramCount(env, groupId)
    ]);
  } catch (e) {
    error = String(e?.message || e).slice(0, 120);
  }

  if (subscribers == null && members == null && cached) {
    return {...cached, cached: true, stale: true, error: error || "telegram_unavailable"};
  }

  const snapshot = {
    subscribers,
    members,
    captured_at: now,
    cache_seconds: CACHE_MS / 1000,
    overlap_unknown: true,
    ...(error ? {error} : {})
  };
  if (env?.PAIRINGS) {
    await env.PAIRINGS.put(CACHE_KEY, JSON.stringify(snapshot), {expirationTtl: 24 * 60 * 60});
  }
  await storeDaily(env, snapshot).catch(() => {});
  return {...snapshot, cached: false};
}
