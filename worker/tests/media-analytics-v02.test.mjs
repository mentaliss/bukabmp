import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsSummary,
  ingestTelemetry,
  sanitizeTelemetryEvent,
  telemetryActorHash
} from "../src/features/telemetry.js";
import {
  MEDIA_LIMITS,
  sanitizeMediaUpload,
  serveAdMedia,
  storeAdMedia
} from "../src/features/ad-media.js";
import {
  readGlobalVersionPolicy,
  resolveVersionPolicy,
  writeGlobalVersionPolicy
} from "../src/features/version-policy.js";
import {publishAllChannels} from "../src/features/control-bulk.js";
import {communityStats} from "../src/features/community-stats.js";
import {checkTelemetryRateLimit} from "../src/security/rate-limit.js";

class MemoryKV {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial).map(([k,v]) => [String(k), String(v)]));
  }
  async get(key, type) {
    const value = this.map.get(String(key));
    if (value == null) return null;
    return type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value) { this.map.set(String(key), String(value)); }
  async delete(key) { this.map.delete(String(key)); }
}

class MemoryR2 {
  constructor() { this.map = new Map(); }
  async put(key, value, options = {}) {
    this.map.set(String(key), {bytes: new Uint8Array(value), options});
  }
  async get(key, options = {}) {
    const item = this.map.get(String(key));
    if (!item) return null;
    const range = options?.range;
    const bytes = range
      ? item.bytes.slice(range.offset, range.offset + range.length)
      : item.bytes;
    return {body: bytes};
  }
  async delete(key) { this.map.delete(String(key)); }
}


class MemoryD1Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = String(sql); this.args = args; }
  bind(...args) { return new MemoryD1Statement(this.db, this.sql, args); }
  async run() { return this.db.run(this.sql, this.args); }
  async all() { return this.db.all(this.sql, this.args); }
  async first() { return this.db.first(this.sql, this.args); }
}

class TelemetryMemoryD1 {
  constructor() {
    this.actors = new Map();
    this.daily = new Map();
    this.dailyActors = new Map();
  }
  prepare(sql) { return new MemoryD1Statement(this, sql); }
  async batch(statements) { return await Promise.all(statements.map(statement => statement.run())); }
  dailyKey(date, metric, channel, version) { return [date, metric, channel, version].join("|"); }
  actorDayKey(date, actor, channel, version) { return [date, actor, channel, version].join("|"); }
  inRange(date, start, end) { return String(date) >= String(start) && String(date) <= String(end); }
  async run(sql, args) {
    if (sql.includes("INSERT OR IGNORE INTO telemetry_actor")) {
      const [actor, first, last] = args;
      if (this.actors.has(actor)) return {meta: {changes: 0}};
      this.actors.set(actor, {first_seen: first, last_seen: last});
      return {meta: {changes: 1}};
    }
    if (sql.includes("UPDATE telemetry_actor SET last_seen")) {
      const [last, actor] = args;
      const row = this.actors.get(actor);
      if (row) row.last_seen = last;
      return {meta: {changes: row ? 1 : 0}};
    }
    if (sql.includes("INSERT INTO telemetry_daily(")) {
      let date, metric, channel, version;
      if (sql.includes("'new_actor'")) {
        [date, channel, version] = args;
        metric = "new_actor";
      } else {
        [date, metric, channel, version] = args;
      }
      const key = this.dailyKey(date, metric, channel, version);
      this.daily.set(key, (this.daily.get(key) || 0) + 1);
      return {meta: {changes: 1}};
    }
    if (sql.includes("INSERT INTO telemetry_daily_actor")) {
      const [date, actor, channel, version, opened, jobStarted, adSeen] = args;
      const key = this.actorDayKey(date, actor, channel, version);
      const current = this.dailyActors.get(key) || {date, actor_hash: actor, channel, extension_version: version, opened: 0, job_started: 0, ad_seen: 0};
      current.opened = Math.max(current.opened, opened);
      current.job_started = Math.max(current.job_started, jobStarted);
      current.ad_seen = Math.max(current.ad_seen, adSeen);
      this.dailyActors.set(key, current);
      return {meta: {changes: 1}};
    }
    if (sql.includes("DELETE FROM telemetry_daily_actor")) {
      const [cutoff] = args;
      for (const [key, row] of this.dailyActors) if (row.date < cutoff) this.dailyActors.delete(key);
      return {meta: {changes: 0}};
    }
    if (sql.includes("DELETE FROM telemetry_daily")) {
      const [cutoff] = args;
      for (const key of [...this.daily.keys()]) if (key.split("|")[0] < cutoff) this.daily.delete(key);
      return {meta: {changes: 0}};
    }
    throw new Error("Unhandled D1 run: " + sql);
  }
  dailyRows() {
    return [...this.daily.entries()].map(([key, count]) => {
      const [date, metric, channel, extension_version] = key.split("|");
      return {date, metric, channel, extension_version, count};
    });
  }
  filteredActorDays(start, end, channel = "") {
    return [...this.dailyActors.values()].filter(row => this.inRange(row.date, start, end) && (!channel || row.channel === channel));
  }
  async all(sql, args) {
    const start = args[0], end = args[1], channel = args[2] || "";
    if (sql.includes("SELECT metric, SUM(count)")) {
      const sums = new Map();
      for (const row of this.dailyRows()) {
        if (!this.inRange(row.date, start, end) || (channel && row.channel !== channel)) continue;
        sums.set(row.metric, (sums.get(row.metric) || 0) + row.count);
      }
      return {results: [...sums].map(([metric, value]) => ({metric, value}))};
    }
    if (sql.includes("SELECT date, metric, SUM(count)")) {
      const sums = new Map();
      for (const row of this.dailyRows()) {
        if (!this.inRange(row.date, start, end) || (channel && row.channel !== channel)) continue;
        const key = row.date + "|" + row.metric;
        sums.set(key, (sums.get(key) || 0) + row.count);
      }
      return {results: [...sums].map(([key, value]) => {
        const [date, metric] = key.split("|");
        return {date, metric, value};
      })};
    }
    if (sql.includes("COUNT(DISTINCT CASE WHEN ad_seen")) {
      const grouped = new Map();
      for (const row of this.filteredActorDays(start, end, channel)) {
        const bucket = grouped.get(row.date) || {actors: new Set(), reach: new Set()};
        bucket.actors.add(row.actor_hash);
        if (row.ad_seen === 1) bucket.reach.add(row.actor_hash);
        grouped.set(row.date, bucket);
      }
      return {results: [...grouped].map(([date, bucket]) => ({date, active_users: bucket.actors.size, ad_reach: bucket.reach.size}))};
    }
    throw new Error("Unhandled D1 all: " + sql);
  }
  async first(sql, args) {
    if (sql.includes("SELECT COUNT(*) AS value FROM telemetry_actor")) return {value: this.actors.size};
    if (sql.includes("JOIN telemetry_actor")) {
      const [start, end, startEpoch, channel = ""] = args;
      const actors = new Set();
      for (const row of this.filteredActorDays(start, end, channel)) {
        const actor = this.actors.get(row.actor_hash);
        if (actor && actor.first_seen < startEpoch) actors.add(row.actor_hash);
      }
      return {value: actors.size};
    }
    if (sql.includes("COUNT(DISTINCT actor_hash)")) {
      const [start, end, channel = ""] = args;
      const rows = this.filteredActorDays(start, end, channel);
      const actors = new Set(rows.filter(row => !sql.includes("ad_seen = 1") || row.ad_seen === 1).map(row => row.actor_hash));
      return {value: actors.size};
    }
    throw new Error("Unhandled D1 first: " + sql);
  }
}

function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

test("telemetry rejects forbidden identity/content keys and accepts only product dimensions", () => {
  const base = {
    actor_id: "9a2e4f26-5ef8-4cff-95c3-55ad55478f52",
    event: "extension_open",
    extension_version: "1.1.0",
    distribution_channel: "edge",
    dimensions: {duration_ms: 123}
  };
  assert.ok(sanitizeTelemetryEvent(base));
  for (const forbidden of [
    "telegram_id", "member_ref", "username", "activation_token", "pairing_code",
    "bmpInstallId", "bmp_code", "module_name", "rbv_url", "pdf_filename",
    "ocr_text", "document_title", "browsing_history"
  ]) {
    assert.equal(sanitizeTelemetryEvent({...base, dimensions: {...base.dimensions, [forbidden]: "x"}}), null);
  }
});

test("telemetry actor storage key is a keyed HMAC rather than the raw analytics UUID", async () => {
  const actor = "9a2e4f26-5ef8-4cff-95c3-55ad55478f52";
  const hash = await telemetryActorHash({TELEMETRY_HASH_KEY: "test-only-secret"}, actor);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, actor);
  const hash2 = await telemetryActorHash({TELEMETRY_HASH_KEY: "different-secret"}, actor);
  assert.notEqual(hash2, hash);
});

test("media validation enforces allowed MIME, magic, byte and duration bounds", () => {
  const webp = new Uint8Array(16);
  webp.set(Buffer.from("RIFF"), 0);
  webp.set(Buffer.from("WEBP"), 8);
  assert.ok(sanitizeMediaUpload({
    mime: "image/webp",
    data_base64: b64(webp),
    width: 1200,
    height: 675
  }));
  assert.equal(sanitizeMediaUpload({mime: "image/svg+xml", data_base64: b64(webp)}), null);

  const mp4 = new Uint8Array(16);
  mp4.set(Buffer.from("ftyp"), 4);
  assert.ok(sanitizeMediaUpload({
    mime: "video/mp4",
    data_base64: b64(mp4),
    width: 1080,
    height: 1080,
    duration_ms: 5000
  }));
  assert.equal(sanitizeMediaUpload({
    mime: "video/mp4",
    data_base64: b64(mp4),
    duration_ms: 15001
  }), null);
  const jpeg = new Uint8Array(16);
  jpeg.set([0xff, 0xd8, 0xff], 0);
  assert.ok(sanitizeMediaUpload({mime: "image/jpeg", data_base64: b64(jpeg), width: 333, height: 2000}));

  const png = new Uint8Array(16);
  png.set([137,80,78,71,13,10,26,10], 0);
  assert.ok(sanitizeMediaUpload({mime: "image/png", data_base64: b64(png)}));

  const webm = new Uint8Array(16);
  webm.set([0x1a,0x45,0xdf,0xa3], 0);
  assert.ok(sanitizeMediaUpload({
    mime: "video/webm",
    data_base64: b64(webm),
    duration_ms: 15000
  }));
  assert.equal(sanitizeMediaUpload({mime: "image/gif", data_base64: b64(webp)}), null);
  assert.equal(sanitizeMediaUpload({mime: "image/webp", data_base64: b64(new Uint8Array(16))}), null);
  assert.equal(sanitizeMediaUpload({mime: "video/mp4", data_base64: b64(mp4), duration_ms: 0}), null);

  const imageTooLarge = new Uint8Array(3 * 1024 * 1024 + 1);
  imageTooLarge.set([0xff, 0xd8, 0xff], 0);
  assert.equal(sanitizeMediaUpload({mime: "image/jpeg", data_base64: b64(imageTooLarge)}), null);

  const videoTooLarge = new Uint8Array(10 * 1024 * 1024 + 1);
  videoTooLarge.set(Buffer.from("ftyp"), 4);
  assert.equal(sanitizeMediaUpload({mime: "video/mp4", data_base64: b64(videoTooLarge), duration_ms: 5000}), null);

  assert.equal(MEDIA_LIMITS.image_bytes, 3 * 1024 * 1024);
  assert.equal(MEDIA_LIMITS.video_bytes, 10 * 1024 * 1024);
  assert.equal(MEDIA_LIMITS.video_duration_ms, 15000);
});

test("first-party media stores immutable content hash IDs and serves video byte ranges", async () => {
  const kv = new MemoryKV();
  const r2 = new MemoryR2();
  const mp4 = new Uint8Array(32);
  mp4.set(Buffer.from("ftyp"), 4);
  for (let i = 8; i < mp4.length; i++) mp4[i] = i;
  const stored = await storeAdMedia({PAIRINGS: kv, AD_MEDIA: r2}, {
    mime: "video/mp4",
    data_base64: b64(mp4),
    width: 1080,
    height: 1080,
    duration_ms: 5000
  }, 1);
  assert.equal(stored.ok, true);
  assert.match(stored.asset.id, /^[0-9a-f]{64}$/);
  assert.match(stored.asset.key, /^ads\/[0-9a-f]{64}\.mp4$/);

  const response = await serveAdMedia(
    new Request("https://worker.test/v1/media/" + stored.asset.id, {headers: {Range: "bytes=4-11"}}),
    {PAIRINGS: kv, AD_MEDIA: r2},
    stored.asset.id
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-range"), "bytes 4-11/32");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [...mp4.slice(4, 12)]);
});

test("global version policy enforces minimum only on channels explicitly marked ready", async () => {
  const env = {PAIRINGS: new MemoryKV()};
  const write = await writeGlobalVersionPolicy(env, {
    latest_version: "1.1.0",
    minimum_global: "1.1.0",
    release_url: "https://example.com/release",
    readiness: {github: true, android: true, edge: true, cws: false}
  }, 1);
  assert.equal(write.ok, true);
  assert.equal((await readGlobalVersionPolicy(env)).minimum_global, "1.1.0");

  const legacy = {
    channel: "cws",
    latestVersion: "1.0.5",
    minimumVersion: "",
    forceAfter: null,
    releaseUrl: "https://example.com/old",
    message: "",
    storeReady: false
  };
  const cws = await resolveVersionPolicy(env, "cws", legacy);
  const edge = await resolveVersionPolicy(env, "edge", {...legacy, channel: "edge"});
  assert.equal(cws.minimumVersion, "");
  assert.equal(cws.storeReady, false);
  assert.equal(edge.minimumVersion, "1.1.0");
  assert.equal(edge.storeReady, true);
});

test("ALL target rolls back already written channels after a middle-channel failure", async () => {
  const channels = ["github", "android", "cws", "edge"];
  const store = new Map(channels.map(channel => [channel, {value: "old-" + channel}]));
  const snapshots = [];
  let fail = true;

  await assert.rejects(
    publishAllChannels({
      channels,
      incoming: {value: "new"},
      reason: "test",
      sanitize: value => ({...value}),
      read: async channel => ({...store.get(channel)}),
      snapshot: async (channel, value) => { snapshots.push([channel, value.value]); },
      write: async (channel, value) => {
        if (channel === "cws" && fail) {
          fail = false;
          throw new Error("simulated_middle_failure");
        }
        store.set(channel, {...value});
      },
      verify: async (channel, expected) => JSON.stringify(store.get(channel)) === JSON.stringify(expected)
    }),
    /simulated_middle_failure/
  );

  assert.equal(store.get("github").value, "old-github");
  assert.equal(store.get("android").value, "old-android");
  assert.equal(store.get("cws").value, "old-cws");
  assert.equal(store.get("edge").value, "old-edge");
  assert.equal(snapshots.length, 4);
});

test("community stats can serve a fresh cached aggregate without retrieving member lists", async () => {
  const cached = {subscribers: 123, members: 45, captured_at: Date.now(), cache_seconds: 600, overlap_unknown: true};
  const env = {PAIRINGS: new MemoryKV({"community-stats:v1": JSON.stringify(cached)})};
  const result = await communityStats(env);
  assert.equal(result.cached, true);
  assert.equal(result.subscribers, 123);
  assert.equal(result.members, 45);
  assert.equal(result.overlap_unknown, true);
});


test("community stats preserves the successful Telegram count when the sibling lookup fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    if (body.chat_id === "channel-test") {
      return new Response(JSON.stringify({ok: false, description: "channel denied"}), {
        status: 403,
        headers: {"content-type": "application/json"}
      });
    }
    return new Response(JSON.stringify({ok: true, result: 55}), {
      status: 200,
      headers: {"content-type": "application/json"}
    });
  };
  try {
    const cached = {
      subscribers: 120,
      members: 40,
      captured_at: 1,
      cache_seconds: 600,
      overlap_unknown: true
    };
    const env = {
      PAIRINGS: new MemoryKV({"community-stats:v1": JSON.stringify(cached)}),
      TELEGRAM_BOT_TOKEN: "test-token",
      CHANNEL_ID: "channel-test",
      SUPPORT_GROUP_ID: "group-test"
    };
    const result = await communityStats(env, {force: true}, 123456789);
    assert.equal(result.subscribers, 120);
    assert.equal(result.members, 55);
    assert.equal(result.stale, true);
    assert.deepEqual(result.stale_fields, ["subscribers"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("ALL target rolls back a channel even if its write mutates and then throws", async () => {
  const channels = ["github", "android", "cws", "edge"];
  const store = new Map(channels.map(channel => [channel, {value: "old-" + channel}]));
  let failed = false;
  await assert.rejects(
    publishAllChannels({
      channels,
      incoming: {value: "new"},
      reason: "partial-write",
      sanitize: value => ({...value}),
      read: async channel => ({...store.get(channel)}),
      snapshot: async () => {},
      write: async (channel, value) => {
        store.set(channel, {...value});
        if (channel === "cws" && !failed) {
          failed = true;
          throw new Error("mutated_then_failed");
        }
      },
      verify: async (channel, expected) => JSON.stringify(store.get(channel)) === JSON.stringify(expected)
    }),
    /mutated_then_failed/
  );
  for (const channel of channels) assert.equal(store.get(channel).value, "old-" + channel);
});

test("global version policy rejects contradictory versions and unsafe release URLs", async () => {
  const env = {PAIRINGS: new MemoryKV()};
  assert.equal((await writeGlobalVersionPolicy(env, {
    latest_version: "1.0.5",
    minimum_global: "1.1.0",
    readiness: {}
  })).ok, false);
  assert.equal((await writeGlobalVersionPolicy(env, {
    latest_version: "1.1.0",
    minimum_global: "1.0.5",
    release_url: "http://example.com/release",
    readiness: {}
  })).ok, false);
  assert.equal((await writeGlobalVersionPolicy(env, {
    latest_version: "1.1.0",
    minimum_global: "1.0.5",
    force_after: "not-a-date",
    readiness: {}
  })).ok, false);
});


class AnalyticsDbFixture {
  prepare(sql) {
    const query = String(sql);
    const statement = {
      bind() { return statement; },
      async all() {
        if (query.includes("COUNT(DISTINCT CASE WHEN ad_seen")) {
          return {results: [{date: "2026-09-22", active_users: 2, ad_reach: 1}]};
        }
        if (query.includes("SELECT date, metric")) {
          return {results: [
            {date: "2026-09-22", metric: "extension_open", value: 3},
            {date: "2026-09-22", metric: "job_started", value: 2},
            {date: "2026-09-22", metric: "ad_impression", value: 2},
            {date: "2026-09-22", metric: "ad_click", value: 1}
          ]};
        }
        if (query.includes("SELECT metric, SUM(count)")) return {results: []};
        return {results: []};
      },
      async first() { return {value: 0}; }
    };
    return statement;
  }
}

test("analytics has no fake 100% health with zero jobs and includes blueprint chart series", async () => {
  const result = await analyticsSummary({BOT_DB: new AnalyticsDbFixture()}, {period: "7d"}, Date.parse("2026-09-22T12:00:00Z"));
  assert.equal(result.health_percent, null);
  assert.equal(result.returning_percent, null);
  assert.equal(result.ctr_percent, null);
  assert.ok(result.series.some(row => row.metric === "active_users" && row.value === 2));
  assert.ok(result.series.some(row => row.metric === "ad_reach" && row.value === 1));
  assert.ok(result.series.some(row => row.metric === "extension_open"));
  assert.ok(result.series.some(row => row.metric === "job_started"));
});


test("telemetry reason is allowlisted instead of accepting arbitrary text", () => {
  const base = {
    actor_id: "9a2e4f26-5ef8-4cff-95c3-55ad55478f52",
    event: "media_render_failed",
    extension_version: "1.1.0",
    distribution_channel: "edge"
  };
  const safe = sanitizeTelemetryEvent({...base, dimensions: {reason: "image_load_failed"}});
  assert.equal(safe.dimensions.reason, "image_load_failed");
  const arbitrary = sanitizeTelemetryEvent({...base, dimensions: {reason: "private document title.pdf"}});
  assert.equal(Object.hasOwn(arbitrary.dimensions, "reason"), false);
});

test("telemetry request rate limit uses only a hashed ephemeral IP key", async () => {
  const kv = new MemoryKV();
  const env = {PAIRINGS: kv, TELEMETRY_HASH_KEY: "test-secret"};
  const request = new Request("https://worker.test/v1/telemetry", {
    headers: {"CF-Connecting-IP": "203.0.113.44"}
  });
  for (let i = 0; i < 180; i++) assert.equal(await checkTelemetryRateLimit(request, env), true);
  assert.equal(await checkTelemetryRateLimit(request, env), false);
  const keys = [...kv.map.keys()];
  assert.equal(keys.length, 1);
  assert.doesNotMatch(keys[0], /203\.0\.113\.44/);
});


test("analytics acceptance matrix counts opens, jobs, returning, reach and CTR correctly", async () => {
  const db = new TelemetryMemoryD1();
  const env = {BOT_DB: db, PAIRINGS: new MemoryKV(), TELEMETRY_HASH_KEY: "analytics-acceptance-secret"};
  const actorA = "9a2e4f26-5ef8-4cff-95c3-55ad55478f52";
  const actorB = "c0a80121-1234-4abc-8def-1234567890ab";
  const old = Date.parse("2026-09-01T12:00:00Z");
  const now = Date.parse("2026-09-22T12:00:00Z");
  const event = (actor, type, dimensions = {}) => ({
    actor_id: actor,
    event: type,
    extension_version: "1.1.0",
    distribution_channel: "edge",
    dimensions
  });

  assert.equal((await ingestTelemetry(env, event(actorA, "extension_open"), old)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorA, "extension_open"), now)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorB, "extension_open"), now)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorB, "extension_open"), now + 1)).ok, true);

  assert.equal((await ingestTelemetry(env, event(actorA, "job_started"), now + 2)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorA, "job_completed"), now + 3)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorB, "job_started"), now + 4)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorB, "job_failed"), now + 5)).ok, true);

  const paid = (campaign, placement = "card") => ({campaign_id: campaign, placement, revision: 1, paid_direct: true});
  assert.equal((await ingestTelemetry(env, event(actorA, "ad_impression", paid("campaign-live")), now + 6)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorA, "ad_impression", paid("campaign-live")), now + 7)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorB, "ad_impression", paid("campaign-live")), now + 8)).ok, true);
  assert.equal((await ingestTelemetry(env, event(actorA, "ad_click", paid("campaign-live")), now + 9)).ok, true);

  const house = await ingestTelemetry(env, event(actorA, "ad_impression", {placement: "card"}), now + 10);
  assert.equal(house.ok, false);
  assert.equal(house.reason, "invalid_event");

  const summary = await analyticsSummary(env, {period: "7d", channel: "edge"}, now + 11);
  assert.equal(summary.total_users, 2);
  assert.equal(summary.active_users, 2);
  assert.equal(summary.opens, 3);
  assert.equal(summary.jobs, 2);
  assert.equal(summary.returning_percent, 50);
  assert.equal(summary.health_percent, 50);
  assert.equal(summary.impressions, 3);
  assert.equal(summary.ad_reach, 2);
  assert.equal(summary.clicks, 1);
  assert.equal(summary.ctr_percent, 33.33);
});
