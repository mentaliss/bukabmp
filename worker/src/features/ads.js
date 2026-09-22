const AD_EVENT_TYPES = new Set(["impression", "click", "dismiss"]);
const AD_PLACEMENTS = new Set(["card", "interstitial"]);
const DISTRIBUTION_CHANNELS = new Set(["github", "android", "cws", "edge"]);

function cleanText(value, max = 700) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
}

function safeHttpsUrl(value) {
  const raw = cleanText(value, 2048);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeIsoDate(value) {
  const raw = cleanText(value, 64);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function boundedInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function defaultAdsState() {
  return {
    enabled: false,
    active: false,
    campaign_id: "",
    revision: 0,
    creative_version: 1,
    sponsor_label: "Sponsor",
    advertiser: "",
    headline: "",
    body: "",
    disclaimer: "",
    image_url: "",
    cta: null,
    card: {mode: "text", asset: null},
    network: {adsonbread: false},
    house: {
      sponsor_label: "Sponsor",
      headline: "Space iklan tersedia",
      body: "",
      cta: {
        label: "Pasang iklan? Hubungi",
        url: "https://t.me/bukabmp?direct"
      }
    },
    starts_at: null,
    ends_at: null,
    placements: {
      card: false,
      interstitial: false
    },
    interstitial: {
      enabled: false,
      trigger: "job_started",
      mode: "text",
      asset: null,
      poster_asset: null,
      delay_min_ms: 2000,
      delay_max_ms: 5000
    }
  };
}

function sanitizeAsset(raw, kind) {
  if (!raw || typeof raw !== "object") return null;
  const id = cleanText(raw.id, 128);
  if (!/^[0-9a-f]{64}$/i.test(id)) return null;
  const mime = cleanText(raw.mime, 64).toLowerCase();
  const allowed = kind === "video"
    ? new Set(["video/mp4", "video/webm"])
    : new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(mime)) return null;
  const maxBytes = kind === "video" ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
  const durationMs = kind === "video"
    ? boundedInt(raw.duration_ms, 0, 0, 15000)
    : 0;
  return {
    id: id.toLowerCase(),
    mime,
    bytes: boundedInt(raw.bytes, 0, 0, maxBytes),
    width: boundedInt(raw.width, 0, 0, 8192),
    height: boundedInt(raw.height, 0, 0, 8192),
    ...(kind === "video" ? {duration_ms: durationMs} : {})
  };
}

function sanitizeCta(raw) {
  if (!raw || typeof raw !== "object") return null;
  const label = cleanText(raw.label, 48);
  const url = safeHttpsUrl(raw.url);
  return label && url ? {label, url} : null;
}

export function sanitizeAdsState(raw, nowMs = Date.now()) {
  const out = defaultAdsState();
  if (!raw || typeof raw !== "object") return out;

  out.enabled = raw.enabled === true;

  const rawCampaignId = cleanText(raw.campaign_id, 64);
  out.campaign_id = /^[a-z0-9][a-z0-9_.:-]{0,63}$/i.test(rawCampaignId)
    ? rawCampaignId
    : "";
  out.revision = boundedInt(raw.revision, 0, 0, 2147483647);
  out.creative_version = Number(raw.creative_version) === 2 ? 2 : 1;
  out.sponsor_label = cleanText(raw.sponsor_label, 32) || "Sponsor";
  out.advertiser = cleanText(raw.advertiser, 96);
  out.headline = cleanText(raw.headline, 120);
  out.body = cleanText(raw.body, 700);
  out.disclaimer = cleanText(raw.disclaimer, 220);
  out.image_url = safeHttpsUrl(raw.image_url);
  out.cta = sanitizeCta(raw.cta);

  const card = raw.card && typeof raw.card === "object" ? raw.card : {};
  const cardMode = cleanText(card.mode, 16).toLowerCase() === "banner" ? "banner" : "text";
  out.card = {
    mode: cardMode,
    asset: cardMode === "banner" ? sanitizeAsset(card.asset, "image") : null
  };
  const network = raw.network && typeof raw.network === "object" ? raw.network : {};
  out.network = {adsonbread: network.adsonbread === true};

  const house = raw.house && typeof raw.house === "object" ? raw.house : {};
  out.house = {
    sponsor_label: cleanText(house.sponsor_label, 32) || out.house.sponsor_label,
    headline: cleanText(house.headline, 120) || out.house.headline,
    body: cleanText(house.body, 420),
    cta: sanitizeCta(house.cta) || out.house.cta
  };

  out.starts_at = safeIsoDate(raw.starts_at);
  out.ends_at = safeIsoDate(raw.ends_at);

  const placements = raw.placements && typeof raw.placements === "object"
    ? raw.placements
    : {};
  out.placements = {
    card: placements.card === true,
    interstitial: placements.interstitial === true
  };

  const interstitial = raw.interstitial && typeof raw.interstitial === "object"
    ? raw.interstitial
    : {};
  const minDelay = boundedInt(interstitial.delay_min_ms, 2000, 2000, 5000);
  const maxDelay = boundedInt(interstitial.delay_max_ms, 5000, minDelay, 5000);
  const interstitialModeRaw = cleanText(interstitial.mode, 16).toLowerCase();
  const interstitialMode = ["image", "video"].includes(interstitialModeRaw)
    ? interstitialModeRaw
    : "text";
  out.interstitial = {
    enabled:
      interstitial.enabled === true &&
      out.placements.interstitial,
    trigger: "job_started",
    mode: interstitialMode,
    asset:
      interstitialMode === "video"
        ? sanitizeAsset(interstitial.asset, "video")
        : interstitialMode === "image"
          ? sanitizeAsset(interstitial.asset, "image")
          : null,
    poster_asset: interstitialMode === "video"
      ? sanitizeAsset(interstitial.poster_asset, "image")
      : null,
    delay_min_ms: minDelay,
    delay_max_ms: maxDelay
  };

  const mediaConfigured = Boolean(
    (out.card.mode === "banner" && out.card.asset) ||
    (["image", "video"].includes(out.interstitial.mode) && out.interstitial.asset)
  );
  // Media fields may be visually self-sufficient in v2, but schema_version=1
  // clients still need a text fallback. Reuse the advertiser name when the
  // operator intentionally leaves headline/body empty.
  if (
    out.creative_version === 2 &&
    mediaConfigured &&
    !out.headline &&
    !out.body &&
    out.advertiser
  ) {
    out.headline = out.advertiser;
  }

  const startsAt = out.starts_at ? Date.parse(out.starts_at) : null;
  const endsAt = out.ends_at ? Date.parse(out.ends_at) : null;
  const inWindow =
    (startsAt == null || nowMs >= startsAt) &&
    (endsAt == null || nowMs < endsAt);
  // Text remains mandatory as the schema_version=1 fallback for clients that do
  // not understand media creative v2. Media is additive and can never create a
  // blank campaign on an older extension.
  const hasCreative = Boolean(
    out.headline ||
    out.body
  );
  const hasPlacement = Boolean(
    out.placements.card ||
    (out.placements.interstitial && out.interstitial.enabled)
  );

  // Active is runtime eligibility only. Keep configured placements and
  // interstitial settings intact while a campaign is scheduled for later,
  // otherwise an admin POST would erase the future placement configuration.
  out.active = Boolean(
    out.enabled &&
    out.campaign_id &&
    hasCreative &&
    hasPlacement &&
    inWindow
  );

  return out;
}

export function sanitizeAdEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const eventType = cleanText(raw.event_type, 24).toLowerCase();
  const placement = cleanText(raw.placement, 24).toLowerCase();
  const campaignId = cleanText(raw.campaign_id, 64);
  const channel = cleanText(raw.distribution_channel, 24).toLowerCase();
  const extensionVersion = cleanText(raw.extension_version, 32);

  if (!AD_EVENT_TYPES.has(eventType)) return null;
  if (!AD_PLACEMENTS.has(placement)) return null;
  if (!/^[a-z0-9][a-z0-9_.:-]{0,63}$/i.test(campaignId)) return null;
  if (!DISTRIBUTION_CHANNELS.has(channel)) return null;
  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(extensionVersion)) return null;

  return {
    event_type: eventType,
    placement,
    campaign_id: campaignId,
    revision: boundedInt(raw.revision, 0, 0, 2147483647),
    distribution_channel: channel,
    extension_version: extensionVersion
  };
}

export async function recordAdEvent(env, raw) {
  const event = sanitizeAdEvent(raw);
  if (!event) return {ok: false, reason: "invalid_event"};

  // Intentionally contains no Telegram ID, install ID, activation token,
  // document code, or other user-specific identifier.
  console.log("ad_event", event);

  let analyticsWritten = false;
  if (env.ADS_ANALYTICS && typeof env.ADS_ANALYTICS.writeDataPoint === "function") {
    try {
      env.ADS_ANALYTICS.writeDataPoint({
        blobs: [
          event.event_type,
          event.placement,
          event.distribution_channel,
          event.extension_version
        ],
        doubles: [event.revision],
        indexes: [event.campaign_id]
      });
      analyticsWritten = true;
    } catch (error) {
      console.warn("ad_analytics_write_failed", {
        error_name: String(error?.name || "Error").slice(0, 80)
      });
    }
  }

  return {ok: true, analytics_written: analyticsWritten};
}
