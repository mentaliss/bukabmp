import test from "node:test";
import assert from "node:assert/strict";

import {sanitizeAdsState} from "../src/features/ads.js";

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
