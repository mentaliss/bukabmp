import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

class MemoryKV {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial).map(([k, v]) => [String(k), String(v)]));
  }
  async get(key, type) {
    const value = this.map.get(String(key));
    if (value == null) return null;
    return type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value) {
    this.map.set(String(key), String(value));
  }
  async delete(key) {
    this.map.delete(String(key));
  }
  keys() {
    return [...this.map.keys()];
  }
}

function env(overrides = {}) {
  return {
    ADMIN_SETUP_TOKEN: "owner-secret",
    PAIRINGS: new MemoryKV(),
    ...overrides
  };
}

function auth(extra = {}) {
  return {
    Authorization: "Bearer owner-secret",
    ...extra
  };
}

async function jsonResponse(path, options = {}, environment = env()) {
  const response = await worker.fetch(new Request("https://worker.test" + path, options), environment);
  const body = await response.json().catch(() => null);
  return {response, body};
}

test("Control Center shell is inert without backend admin authority", async () => {
  const disabled = await worker.fetch(new Request("https://worker.test/control"), env({
    ADMIN_SETUP_TOKEN: ""
  }));
  assert.equal(disabled.status, 503);

  const enabled = await worker.fetch(new Request("https://worker.test/control"), env());
  assert.equal(enabled.status, 200);
  const html = await enabled.text();
  assert.match(html, /BMP Terbuka Control Center/);
  assert.match(html, /Owner authentication/);
  assert.doesNotMatch(html, /owner-secret/);
  assert.match(enabled.headers.get("content-security-policy") || "", /default-src 'none'/);
  assert.match(enabled.headers.get("content-security-policy") || "", /connect-src 'self'/);
});

test("Control Center API rejects requests without the owner token", async () => {
  const environment = env();
  const response = await worker.fetch(
    new Request("https://worker.test/control/api/session"),
    environment
  );
  assert.equal(response.status, 401);

  const ok = await worker.fetch(
    new Request("https://worker.test/control/api/session", {
      headers: auth()
    }),
    environment
  );
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.ok, true);
  assert.equal(body.auth_mode, "admin_setup_token");
  assert.equal(body.history_limit, 20);
  assert.ok(body.channels.includes("edge"));
});

test("Control Center publish sanitizes state and snapshots the previous live state", async () => {
  const environment = env();
  await environment.PAIRINGS.put("extension-state:edge", JSON.stringify({
    schema_version: 1,
    status_badge: {visible: true, kind: "info", text: "Old state"},
    ads: {
      enabled: false,
      house: {
        sponsor_label: "Sponsor",
        headline: "Old house",
        cta: {label: "Contact", url: "https://t.me/bukabmp"}
      }
    }
  }));

  const {response, body} = await jsonResponse(
    "/control/api/state?distribution_channel=edge",
    {
      method: "POST",
      headers: auth({"content-type": "application/json"}),
      body: JSON.stringify({
        reason: "campaign_publish",
        state: {
          schema_version: 1,
          status_badge: {
            visible: true,
            kind: "success",
            text: " Campaign live \u0000 "
          },
          sections: [{
            id: "notice",
            visible: true,
            kind: "info",
            title: "Hello",
            text: "Realtime"
          }],
          ads: {
            enabled: true,
            campaign_id: "sep-2026",
            revision: 4,
            sponsor_label: "Sponsor",
            headline: "Campaign",
            body: "Realtime creative",
            cta: {label: "Open", url: "https://example.com/offer"},
            placements: {card: true, interstitial: true},
            interstitial: {
              enabled: true,
              delay_min_ms: 100,
              delay_max_ms: 999999
            }
          }
        }
      })
    },
    environment
  );

  assert.equal(response.status, 200);
  assert.equal(body.state.status_badge.text, "Campaign live");
  assert.equal(body.state.ads.active, true);
  assert.equal(body.state.ads.interstitial.delay_min_ms, 2000);
  assert.equal(body.state.ads.interstitial.delay_max_ms, 5000);
  assert.equal(body.history.length, 1);
  assert.match(body.history[0].reason, /^before_campaign_publish$/);

  const keys = environment.PAIRINGS.keys();
  assert.ok(keys.includes("extension-state:edge"));
  assert.ok(keys.includes("control-history-index:edge"));
  assert.ok(keys.some(key => key.startsWith("control-history:edge:")));
});

test("Control Center validate never mutates the live channel state", async () => {
  const environment = env({
    PAIRINGS: new MemoryKV({
      "extension-state:edge": JSON.stringify({
        schema_version: 1,
        status_badge: {visible: true, kind: "info", text: "Keep me"}
      })
    })
  });

  const {response, body} = await jsonResponse(
    "/control/api/validate?distribution_channel=edge",
    {
      method: "POST",
      headers: auth({"content-type": "application/json"}),
      body: JSON.stringify({
        schema_version: 1,
        status_badge: {visible: true, kind: "warning", text: "Preview only"}
      })
    },
    environment
  );
  assert.equal(response.status, 200);
  assert.equal(body.state.status_badge.text, "Preview only");

  const live = await environment.PAIRINGS.get("extension-state:edge", "json");
  assert.equal(live.status_badge.text, "Keep me");
  assert.equal(environment.PAIRINGS.keys().some(key => key.startsWith("control-history:")), false);
});

test("Control Center emergency pause disables paid ads but preserves house inventory", async () => {
  const environment = env({
    PAIRINGS: new MemoryKV({
      "extension-state:edge": JSON.stringify({
        schema_version: 1,
        ads: {
          enabled: true,
          campaign_id: "active-campaign",
          revision: 1,
          headline: "Paid",
          body: "Creative",
          house: {
            sponsor_label: "Sponsor",
            headline: "Space iklan tersedia",
            cta: {label: "Hubungi", url: "https://t.me/bukabmp"}
          },
          placements: {card: true, interstitial: true},
          interstitial: {enabled: true, delay_min_ms: 2000, delay_max_ms: 5000}
        }
      })
    })
  });

  const {response, body} = await jsonResponse(
    "/control/api/pause-ads",
    {
      method: "POST",
      headers: auth({"content-type": "application/json"}),
      body: JSON.stringify({distribution_channel: "edge"})
    },
    environment
  );
  assert.equal(response.status, 200);
  assert.equal(body.state.ads.enabled, false);
  assert.equal(body.state.ads.active, false);
  assert.equal(body.state.ads.campaign_id, "active-campaign");
  assert.equal(body.state.ads.house.headline, "Space iklan tersedia");
  assert.equal(body.history.length, 1);
});

test("Control Center rollback restores a snapshot and snapshots the state being replaced", async () => {
  const environment = env();
  await environment.PAIRINGS.put("extension-state:edge", JSON.stringify({
    schema_version: 1,
    status_badge: {visible: true, kind: "info", text: "Version A"}
  }));

  let result = await jsonResponse(
    "/control/api/state?distribution_channel=edge",
    {
      method: "POST",
      headers: auth({"content-type": "application/json"}),
      body: JSON.stringify({
        reason: "to_b",
        state: {
          schema_version: 1,
          status_badge: {visible: true, kind: "success", text: "Version B"}
        }
      })
    },
    environment
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.body.state.status_badge.text, "Version B");
  const snapshotId = result.body.history[0].id;

  result = await jsonResponse(
    "/control/api/rollback",
    {
      method: "POST",
      headers: auth({"content-type": "application/json"}),
      body: JSON.stringify({
        distribution_channel: "edge",
        history_id: snapshotId
      })
    },
    environment
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.body.restored_from, snapshotId);
  assert.equal(result.body.state.status_badge.text, "Version A");
  assert.equal(result.body.history.length, 2);
  assert.equal(result.body.history[0].reason, "before_rollback");
});
