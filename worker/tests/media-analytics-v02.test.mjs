import test from "node:test";
import assert from "node:assert/strict";
import {
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
