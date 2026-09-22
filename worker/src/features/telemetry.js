const EVENTS = new Set([
  "extension_open",
  "job_started",
  "job_completed",
  "job_failed",
  "ad_impression",
  "ad_click",
  "ad_dismiss",
  "media_render_failed"
]);
const CHANNELS = new Set(["github", "android", "cws", "edge"]);
const PLACEMENTS = new Set(["card", "interstitial"]);
const FORBIDDEN_KEYS = [
  "telegram", "member_ref", "username", "activation", "pair", "bmpinstallid",
  "bmp_code", "bmpcode", "module", "rbv", "pdf", "ocr", "document", "history"
];

function clean(value, max = 128) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function forbiddenKeyPresent(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(forbiddenKeyPresent);
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (FORBIDDEN_KEYS.some(item => normalized.includes(item))) return true;
    if (child && typeof child === "object" && forbiddenKeyPresent(child)) return true;
  }
  return false;
}

function safeCampaign(value) {
  const id = clean(value, 64);
  return /^[a-z0-9][a-z0-9_.:-]{0,63}$/i.test(id) ? id : "";
}

export function sanitizeTelemetryEvent(raw) {
  if (!raw || typeof raw !== "object" || forbiddenKeyPresent(raw)) return null;
  const actorId = clean(raw.actor_id, 80);
  const event = clean(raw.event, 40).toLowerCase();
  const extensionVersion = clean(raw.extension_version, 32);
  const channel = clean(raw.distribution_channel, 24).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)) return null;
  if (!EVENTS.has(event)) return null;
  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(extensionVersion)) return null;
  if (!CHANNELS.has(channel)) return null;

  const source = raw.dimensions && typeof raw.dimensions === "object" ? raw.dimensions : {};
  const dimensions = {};
  const durationMs = Math.floor(Number(source.duration_ms) || 0);
  if (durationMs > 0) dimensions.duration_ms = Math.min(durationMs, 24 * 60 * 60 * 1000);
  const campaignId = safeCampaign(source.campaign_id);
  if (campaignId) dimensions.campaign_id = campaignId;
  const placement = clean(source.placement, 24).toLowerCase();
  if (PLACEMENTS.has(placement)) dimensions.placement = placement;
  if (Number.isFinite(Number(source.revision))) {
    dimensions.revision = Math.max(0, Math.min(2147483647, Math.floor(Number(source.revision))));
  }
  if (source.paid_direct === true) dimensions.paid_direct = true;
  const reason = clean(source.reason, 48);
  if (reason) dimensions.reason = reason;

  if (event.startsWith("ad_") && event !== "ad_dismiss" && dimensions.paid_direct !== true) {
    return null;
  }

  return {actor_id: actorId, event, extension_version: extensionVersion, distribution_channel: channel, dimensions};
}

function bytesToHex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function telemetryActorHash(env, actorId) {
  const secret = String(env?.TELEMETRY_HASH_KEY || "");
  if (!secret) throw new Error("TELEMETRY_HASH_KEY_not_configured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(actorId)));
  return bytesToHex(new Uint8Array(signature));
}

async function telemetryRateAllowed(env, actorHash) {
  if (!env?.PAIRINGS) return true;
  const minute = Math.floor(Date.now() / 60000);
  const key = `telemetry-rate:${actorHash.slice(0, 24)}:${minute}`;
  const count = Number(await env.PAIRINGS.get(key) || 0);
  if (count >= 120) return false;
  await env.PAIRINGS.put(key, String(count + 1), {expirationTtl: 120});
  return true;
}

function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function metricFor(event) {
  return event;
}

export async function ingestTelemetry(env, raw, now = Date.now()) {
  const event = sanitizeTelemetryEvent(raw);
  if (!event) return {ok: false, reason: "invalid_event"};
  let actorHash;
  try {
    actorHash = await telemetryActorHash(env, event.actor_id);
  } catch {
    return {ok: false, reason: "telemetry_not_configured"};
  }
  if (!(await telemetryRateAllowed(env, actorHash))) {
    return {ok: false, reason: "rate_limited"};
  }

  if (!env?.BOT_DB || typeof env.BOT_DB.prepare !== "function") {
    return {ok: true, stored: false};
  }

  const day = utcDay(now);
  const metric = metricFor(event.event);
  const opened = event.event === "extension_open" ? 1 : 0;
  const jobStarted = event.event === "job_started" ? 1 : 0;
  const adSeen = event.event === "ad_impression" && event.dimensions.paid_direct === true ? 1 : 0;

  const actorInsert = await env.BOT_DB.prepare(
    "INSERT OR IGNORE INTO telemetry_actor(actor_hash, first_seen, last_seen) VALUES(?, ?, ?)"
  ).bind(actorHash, now, now).run();

  await env.BOT_DB.batch([
    env.BOT_DB.prepare(
      "UPDATE telemetry_actor SET last_seen = ? WHERE actor_hash = ?"
    ).bind(now, actorHash),
    env.BOT_DB.prepare(
      "INSERT INTO telemetry_daily(date, metric, channel, extension_version, count) VALUES(?, ?, ?, ?, 1) " +
      "ON CONFLICT(date, metric, channel, extension_version) DO UPDATE SET count = count + 1"
    ).bind(day, metric, event.distribution_channel, event.extension_version),
    env.BOT_DB.prepare(
      "INSERT INTO telemetry_daily_actor(date, actor_hash, channel, extension_version, opened, job_started, ad_seen) " +
      "VALUES(?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(date, actor_hash, channel, extension_version) DO UPDATE SET " +
      "opened = MAX(opened, excluded.opened), job_started = MAX(job_started, excluded.job_started), ad_seen = MAX(ad_seen, excluded.ad_seen)"
    ).bind(day, actorHash, event.distribution_channel, event.extension_version, opened, jobStarted, adSeen)
  ]);

  if (Number(actorInsert?.meta?.changes || 0) > 0) {
    await env.BOT_DB.prepare(
      "INSERT INTO telemetry_daily(date, metric, channel, extension_version, count) VALUES(?, 'new_actor', ?, ?, 1) " +
      "ON CONFLICT(date, metric, channel, extension_version) DO UPDATE SET count = count + 1"
    ).bind(day, event.distribution_channel, event.extension_version).run();
  }

  // Bounded raw-like pseudonymous activity. Aggregates remain longer.
  const activityCutoff = new Date(now - 180 * 86400000).toISOString().slice(0, 10);
  const aggregateCutoff = new Date(now - 400 * 86400000).toISOString().slice(0, 10);
  await env.BOT_DB.batch([
    env.BOT_DB.prepare("DELETE FROM telemetry_daily_actor WHERE date < ?").bind(activityCutoff),
    env.BOT_DB.prepare("DELETE FROM telemetry_daily WHERE date < ?").bind(aggregateCutoff)
  ]).catch(() => {});

  return {ok: true, stored: true};
}

function periodDays(period) {
  const p = String(period || "7d").toLowerCase();
  if (p === "24h") return 1;
  if (p === "30d") return 30;
  return 7;
}

function normalizeAnalyticsChannel(value) {
  const channel = clean(value, 24).toLowerCase();
  return CHANNELS.has(channel) ? channel : "";
}

function safeCount(row, key = "value") {
  return Math.max(0, Number(row?.[key] || 0));
}

export async function analyticsSummary(env, {period = "7d", channel = ""} = {}, now = Date.now()) {
  if (!env?.BOT_DB || typeof env.BOT_DB.prepare !== "function") {
    return {available: false, period: String(period), channel: normalizeAnalyticsChannel(channel) || "all"};
  }
  const days = periodDays(period);
  const endDay = utcDay(now);
  const startMs = now - (days - 1) * 86400000;
  const startDay = utcDay(startMs);
  const startEpoch = Date.parse(startDay + "T00:00:00.000Z");
  const filterChannel = normalizeAnalyticsChannel(channel);
  const whereChannel = filterChannel ? " AND channel = ?" : "";
  const bindRange = statement => filterChannel
    ? statement.bind(startDay, endDay, filterChannel)
    : statement.bind(startDay, endDay);

  const metricsRows = await bindRange(env.BOT_DB.prepare(
    "SELECT metric, SUM(count) AS value FROM telemetry_daily WHERE date BETWEEN ? AND ?" +
    whereChannel + " GROUP BY metric"
  )).all();
  const metrics = Object.fromEntries((metricsRows?.results || []).map(row => [row.metric, safeCount(row)]));

  const activeRow = await bindRange(env.BOT_DB.prepare(
    "SELECT COUNT(DISTINCT actor_hash) AS value FROM telemetry_daily_actor WHERE date BETWEEN ? AND ?" + whereChannel
  )).first();
  const returningStmt = env.BOT_DB.prepare(
    "SELECT COUNT(DISTINCT d.actor_hash) AS value FROM telemetry_daily_actor d " +
    "JOIN telemetry_actor a ON a.actor_hash = d.actor_hash " +
    "WHERE d.date BETWEEN ? AND ? AND a.first_seen < ?" +
    (filterChannel ? " AND d.channel = ?" : "")
  );
  const returningRow = filterChannel
    ? await returningStmt.bind(startDay, endDay, startEpoch, filterChannel).first()
    : await returningStmt.bind(startDay, endDay, startEpoch).first();

  const totalRow = await env.BOT_DB.prepare("SELECT COUNT(*) AS value FROM telemetry_actor").first();
  const reachRow = await bindRange(env.BOT_DB.prepare(
    "SELECT COUNT(DISTINCT actor_hash) AS value FROM telemetry_daily_actor WHERE date BETWEEN ? AND ? AND ad_seen = 1" + whereChannel
  )).first();

  const seriesRows = await bindRange(env.BOT_DB.prepare(
    "SELECT date, metric, SUM(count) AS value FROM telemetry_daily WHERE date BETWEEN ? AND ?" +
    whereChannel + " GROUP BY date, metric ORDER BY date ASC"
  )).all();
  const actorSeriesRows = await bindRange(env.BOT_DB.prepare(
    "SELECT date, COUNT(DISTINCT actor_hash) AS active_users, " +
    "COUNT(DISTINCT CASE WHEN ad_seen = 1 THEN actor_hash END) AS ad_reach " +
    "FROM telemetry_daily_actor WHERE date BETWEEN ? AND ?" +
    whereChannel + " GROUP BY date ORDER BY date ASC"
  )).all();
  const series = [...(seriesRows?.results || [])];
  for (const row of actorSeriesRows?.results || []) {
    series.push({date: row.date, metric: "active_users", value: safeCount(row, "active_users")});
    series.push({date: row.date, metric: "ad_reach", value: safeCount(row, "ad_reach")});
  }
  series.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.metric).localeCompare(String(b.metric)));

  const activeUsers = safeCount(activeRow);
  const returningUsers = safeCount(returningRow);
  const impressions = safeCount(metrics, "ad_impression");
  const clicks = safeCount(metrics, "ad_click");
  const completed = safeCount(metrics, "job_completed");
  const failed = safeCount(metrics, "job_failed");
  const jobs = safeCount(metrics, "job_started");
  const opens = safeCount(metrics, "extension_open");

  return {
    available: true,
    period: days === 1 ? "24h" : `${days}d`,
    channel: filterChannel || "all",
    start_date: startDay,
    end_date: endDay,
    total_users: safeCount(totalRow),
    active_users: activeUsers,
    opens,
    jobs,
    returning_percent: activeUsers ? Math.round((returningUsers / activeUsers) * 1000) / 10 : null,
    health_percent: completed + failed ? Math.round((completed / (completed + failed)) * 1000) / 10 : null,
    job_completed: completed,
    job_failed: failed,
    media_render_failed: safeCount(metrics, "media_render_failed"),
    ad_reach: safeCount(reachRow),
    impressions,
    clicks,
    ctr_percent: impressions ? Math.round((clicks / impressions) * 10000) / 100 : null,
    series
  };
}
