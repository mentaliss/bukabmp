import test from "node:test";
import assert from "node:assert/strict";

import {sanitizeAdsState} from "../src/features/ads.js";
import {checkAdEventRateLimit} from "../src/security/rate-limit.js";

test("scheduled realtime campaign preserves placements until its start time", () => {
  const now = Date.parse("2026-09-22T00:00:00Z");
  const starts = "2026-09-22T01:00:00Z";
  const raw = {
    enabled: true,
    campaign_id: "scheduled-campaign",
    revision: 7,
    headline: "Scheduled sponsor",
    starts_at: starts,
    placements: {card: true, interstitial: true},
    interstitial: {
      enabled: true,
      trigger: "job_started",
      delay_min_ms: 2000,
      delay_max_ms: 5000
    }
  };

  const stored = sanitizeAdsState(raw, now);
  assert.equal(stored.active, false);
  assert.equal(stored.placements.card, true);
  assert.equal(stored.placements.interstitial, true);
  assert.equal(stored.interstitial.enabled, true);

  const live = sanitizeAdsState(stored, Date.parse(starts) + 1);
  assert.equal(live.active, true);
  assert.equal(live.placements.card, true);
  assert.equal(live.placements.interstitial, true);
  assert.equal(live.interstitial.enabled, true);
});

test("disabled interstitial placement cannot be enabled independently", () => {
  const state = sanitizeAdsState({
    enabled: true,
    campaign_id: "card-only",
    headline: "Card only",
    placements: {card: true, interstitial: false},
    interstitial: {enabled: true}
  });
  assert.equal(state.active, true);
  assert.equal(state.placements.card, true);
  assert.equal(state.placements.interstitial, false);
  assert.equal(state.interstitial.enabled, false);
});

test("house inventory always has a safe contact fallback", () => {
  const state = sanitizeAdsState(null);
  assert.equal(state.house.sponsor_label, "Sponsor");
  assert.equal(state.house.headline, "Space iklan tersedia");
  assert.equal(state.house.cta.label, "Pasang iklan? Hubungi");
  assert.match(state.house.cta.url, /^https:\/\//);
});


test("1.1.0 interstitial delay remains inside the frozen 2-5 second window", () => {
  const state = sanitizeAdsState({
    enabled: true,
    campaign_id: "delay-clamp",
    headline: "Sponsor",
    placements: {card: false, interstitial: true},
    interstitial: {
      enabled: true,
      delay_min_ms: 1,
      delay_max_ms: 999999
    }
  });
  assert.equal(state.interstitial.delay_min_ms, 2000);
  assert.equal(state.interstitial.delay_max_ms, 5000);
});

test("image-only ad cannot activate before a first-party image renderer exists", () => {
  const state = sanitizeAdsState({
    enabled: true,
    campaign_id: "image-only",
    image_url: "https://example.com/ad.png",
    placements: {card: true, interstitial: true},
    interstitial: {enabled: true}
  });
  assert.equal(state.active, false);
});

test("public ad metric ingest is capped per hashed IP window", async () => {
  const map = new Map();
  const env = {
    MEMBER_HASH_SALT: "fixture-salt",
    PAIRINGS: {
      async get(key) { return map.get(String(key)) ?? null; },
      async put(key, value) { map.set(String(key), String(value)); }
    }
  };
  const request = new Request("https://worker.test/v1/ad-event", {
    headers: {"CF-Connecting-IP": "203.0.113.10"}
  });
  for (let i = 0; i < 60; i++) {
    assert.equal(await checkAdEventRateLimit(request, env), true);
  }
  assert.equal(await checkAdEventRateLimit(request, env), false);
});
