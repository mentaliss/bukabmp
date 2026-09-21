importScripts("config.js", "cloud-surface.js");

const CFG = self.BMP_CONFIG;
const CLOUD = self.BMP_CLOUD_SURFACE;
const SOURCE_ROOT = "https://pustaka.ut.ac.id";
const VERSION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLOUD_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
const CLOUD_CACHE_KEY = "bmpCloudStateCacheV3";
const ACTIVATION_REFRESH_META_KEY = "bmpActivationRefreshMetaV110";
const ACTIVATION_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_STATE = {
  running: false,
  tabId: null,
  code: "",
  startModule: 1,
  currentModule: 1,
  maxModule: 9,
  effectiveMaxModule: 9,
  delayMs: 2500,
  maxPages: 500,
  mergeRequested: false,
  redownload: false,
  status: "IDLE",
  progress: "",
  ocrProgress: "",
  completedModules: [],
  cachedModulesAtStart: [],
  processedModules: [],
  skippedModules: [],
  detectedLastModule: null,
  mergeMessage: ""
};

let creatingOffscreen = null;
const cacheInfoMemo = new Map();

function configReady() {
  return Boolean(
    CFG &&
    /^https:\/\/.+/.test(CFG.API_BASE_URL || "") &&
    !String(CFG.API_BASE_URL).includes("__BMP_") &&
    /^https:\/\/t\.me\//.test(CFG.TELEGRAM_CHANNEL_URL || "") &&
    /^https:\/\/t\.me\//.test(CFG.TELEGRAM_GROUP_URL || "")
  );
}

async function getState() {
  const x = await chrome.storage.local.get("bmpState");
  return {...DEFAULT_STATE, ...(x.bmpState || {})};
}

async function setState(patch) {
  const current = await getState();
  const next = {...current, ...patch};
  await chrome.storage.local.set({bmpState: next});
  return next;
}

async function getCacheMetaMap() {
  const x = await chrome.storage.local.get("bmpCacheMeta");
  return x.bmpCacheMeta && typeof x.bmpCacheMeta === "object"
    ? x.bmpCacheMeta
    : {};
}

async function getCodeMeta(code) {
  const map = await getCacheMetaMap();
  return map[String(code || "").toUpperCase()] || {};
}

async function setDetectedLastModule(code, lastModule) {
  const normalized = String(code || "").toUpperCase();
  if (!normalized || !Number.isInteger(lastModule) || lastModule < 1 || lastModule > 99) {
    return null;
  }
  const map = await getCacheMetaMap();
  map[normalized] = {
    ...(map[normalized] || {}),
    detectedLastModule: lastModule,
    detectedAt: Date.now()
  };
  await chrome.storage.local.set({bmpCacheMeta: map});
  return map[normalized];
}

async function clearCodeMeta(code) {
  const normalized = String(code || "").toUpperCase();
  const map = await getCacheMetaMap();
  if (Object.prototype.hasOwnProperty.call(map, normalized)) {
    delete map[normalized];
    await chrome.storage.local.set({bmpCacheMeta: map});
  }
}

async function getInstallId() {
  const x = await chrome.storage.local.get("bmpInstallId");
  if (x.bmpInstallId) return x.bmpInstallId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({bmpInstallId: id});
  return id;
}

function b64urlToBytes(value) {
  const s = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function decodeJsonB64url(value) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(value)));
}

async function verifyCommunityToken(token) {
  try {
    if (!token || typeof token !== "string") return {ok: false, reason: "missing"};
    const parts = token.split(".");
    if (parts.length !== 3) return {ok: false, reason: "format"};

    const header = decodeJsonB64url(parts[0]);
    const payload = decodeJsonB64url(parts[1]);

    if (header.alg !== "RS256") return {ok: false, reason: "alg"};
    if (payload.iss !== CFG.TOKEN_ISSUER) return {ok: false, reason: "issuer"};
    if (payload.aud !== CFG.TOKEN_AUDIENCE) return {ok: false, reason: "audience"};

    const installId = await getInstallId();
    if (payload.install_id !== installId) return {ok: false, reason: "device"};

    const now = Math.floor(Date.now() / 1000);
    if (!Number(payload.exp) || payload.exp <= now) {
      return {ok: false, reason: "expired", payload};
    }

    const key = await crypto.subtle.importKey(
      "jwk",
      CFG.PUBLIC_SIGNING_JWK,
      {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"},
      false,
      ["verify"]
    );

    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = b64urlToBytes(parts[2]);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      sig,
      signed
    );

    return valid ? {ok: true, payload} : {ok: false, reason: "signature"};
  } catch (e) {
    return {ok: false, reason: "invalid", error: String(e)};
  }
}

async function accessStatus() {
  const store = await chrome.storage.local.get([
    "bmpCommunityToken",
    "bmpPendingPair"
  ]);
  const verified = await verifyCommunityToken(store.bmpCommunityToken);
  const scopes = verified.ok && Array.isArray(verified.payload?.scope)
    ? verified.payload.scope.map(String)
    : [];
  const refreshEligible = Boolean(
    verified.ok &&
    scopes.includes("community_access") &&
    Number(verified.payload?.token_version || 0) >= 2 &&
    /^tg:\d+$/.test(String(verified.payload?.sub || ""))
  );
  const supporterUntil = verified.ok
    ? Number(verified.payload?.supporter_until || 0) * 1000
    : 0;
  const supporterActive = Boolean(
    verified.ok &&
    verified.payload?.supporter_active === true &&
    supporterUntil > Date.now()
  );
  return {
    active: Boolean(verified.ok),
    reviewer: Boolean(verified.ok && scopes.includes("store_review")),
    expiresAt: verified.ok ? Number(verified.payload.exp) * 1000 : null,
    supporter: {
      active: supporterActive,
      until: supporterActive ? supporterUntil : null,
      label: supporterActive
        ? String(verified.payload?.supporter_label || "BMP Supporter")
        : ""
    },
    refreshEligible,
    tokenVersion: verified.ok
      ? Number(verified.payload?.token_version || 1)
      : null,
    pending: store.bmpPendingPair || null,
    configReady: configReady(),
    channelUrl: CFG.TELEGRAM_CHANNEL_URL,
    groupUrl: CFG.TELEGRAM_GROUP_URL
  };
}

async function requireAccess() {
  const status = await accessStatus();
  if (!status.configReady) {
    throw new Error("Build BMP Terbuka belum dikonfigurasi untuk aktivasi komunitas.");
  }
  if (!status.active) {
    throw new Error("Aktivasi komunitas diperlukan sebelum menggunakan BMP Terbuka.");
  }
}

async function api(path, options = {}) {
  if (!configReady()) throw new Error("Konfigurasi aktivasi belum lengkap.");
  const url = `${String(CFG.API_BASE_URL).replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Community API HTTP ${res.status}`);
  }
  return data;
}

function distributionChannel() {
  const value = String(CFG?.DISTRIBUTION_CHANNEL || "github").toLowerCase();
  return ["github", "cws", "edge", "android"].includes(value) ? value : "github";
}

function isStoreChannel(channel = distributionChannel()) {
  return channel === "cws" || channel === "edge";
}

async function cloudState({force = false} = {}) {
  const now = Date.now();
  const stored = await chrome.storage.local.get(CLOUD_CACHE_KEY);
  const cached = stored[CLOUD_CACHE_KEY] || null;

  if (!force && cached?.expiresAt && Number(cached.expiresAt) > now) {
    const cachedState = cached?.state?.schemaVersion === 1
      ? cached.state
      : (CLOUD?.sanitizeState(cached.state) || CLOUD.defaultState());
    return {
      ...cachedState,
      cached: true,
      unavailable: Boolean(cached.unavailable)
    };
  }

  const currentVersion = chrome.runtime.getManifest().version;
  const channel = distributionChannel();

  try {
    const data = await api(
      `/v1/extension-state?extension_version=${encodeURIComponent(currentVersion)}&distribution_channel=${encodeURIComponent(channel)}`,
      {method: "GET"}
    );
    const state = CLOUD.sanitizeState(data);
    const cache = {
      state,
      unavailable: false,
      lastAttemptAt: now,
      lastSuccessAt: now,
      expiresAt: now + state.ttlSeconds * 1000,
      error: ""
    };
    await chrome.storage.local.set({[CLOUD_CACHE_KEY]: cache});
    return {...state, cached: false, unavailable: false};
  } catch (e) {
    const cachedState = cached?.state?.schemaVersion === 1 ? cached.state : null;
    const hasLastGood = Boolean(cachedState && Number(cached?.lastSuccessAt || 0) > 0);
    const state = hasLastGood ? cachedState : CLOUD.defaultState();
    const cache = {
      state,
      unavailable: true,
      lastAttemptAt: now,
      lastSuccessAt: Number(cached?.lastSuccessAt || 0),
      expiresAt: now + (hasLastGood ? 60_000 : CLOUD_FAILURE_BACKOFF_MS),
      error: String(e?.message || e)
    };
    await chrome.storage.local.set({[CLOUD_CACHE_KEY]: cache});
    return {...state, cached: hasLastGood, unavailable: true};
  }
}

async function reportAdEvent({
  eventType,
  placement,
  campaignId,
  revision
} = {}) {
  const type = String(eventType || "").toLowerCase();
  const place = String(placement || "").toLowerCase();
  const id = String(campaignId || "").trim();
  if (!["impression", "click", "dismiss"].includes(type)) {
    return {ok: false, error: "invalid_event_type"};
  }
  if (!["card", "interstitial"].includes(place)) {
    return {ok: false, error: "invalid_placement"};
  }
  if (!/^[a-z0-9][a-z0-9_.:-]{0,63}$/i.test(id)) {
    return {ok: false, error: "invalid_campaign"};
  }

  const currentVersion = chrome.runtime.getManifest().version;
  try {
    return await api("/v1/ad-event", {
      method: "POST",
      body: JSON.stringify({
        event_type: type,
        placement: place,
        campaign_id: id,
        revision: Math.max(0, Math.floor(Number(revision) || 0)),
        distribution_channel: distributionChannel(),
        extension_version: currentVersion
      })
    });
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error).slice(0, 160)
    };
  }
}

async function executeCloudAction(rawAction) {
  const action = CLOUD.sanitizeAction(rawAction);
  if (!action) throw new Error("Aksi cloud tidak valid.");

  if (action.type === "OPEN_URL") {
    await chrome.tabs.create({url: action.url});
    return {ok: true};
  }
  if (action.type === "OPEN_CHANNEL") {
    await chrome.tabs.create({url: CFG.TELEGRAM_CHANNEL_URL});
    return {ok: true};
  }
  if (action.type === "OPEN_GROUP") {
    await chrome.tabs.create({url: CFG.TELEGRAM_GROUP_URL});
    return {ok: true};
  }
  if (action.type === "OPEN_ABOUT") {
    await chrome.tabs.create({url: chrome.runtime.getURL("about.html")});
    return {ok: true};
  }
  throw new Error("Aksi cloud tidak didukung.");
}

function versionParts(value) {
  return String(value || "")
    .split(".")
    .slice(0, 4)
    .map(x => Number.parseInt(x, 10))
    .map(x => Number.isFinite(x) ? x : 0);
}

function compareVersions(a, b) {
  const x = versionParts(a);
  const y = versionParts(b);
  const n = Math.max(x.length, y.length, 3);
  for (let i = 0; i < n; i++) {
    const xa = x[i] || 0;
    const ya = y[i] || 0;
    if (xa < ya) return -1;
    if (xa > ya) return 1;
  }
  return 0;
}

function applyVersionDecision(policy, currentVersion, now = Date.now()) {
  const channel = String(policy?.channel || distributionChannel());
  const reportedLatestVersion = String(policy?.latestVersion || currentVersion);
  const reportedMinimumVersion = String(policy?.minimumVersion || "");
  const storeReady = policy?.storeReady === true;
  const mayEnforceRemoteVersion = !isStoreChannel(channel) || storeReady;
  const latestVersion = mayEnforceRemoteVersion ? reportedLatestVersion : currentVersion;
  const minimumVersion = mayEnforceRemoteVersion ? reportedMinimumVersion : "";
  const rawForceAfter = policy?.forceAfter;
  const parsedForceAfter = rawForceAfter
    ? (typeof rawForceAfter === "number" ? rawForceAfter : Date.parse(rawForceAfter))
    : null;
  return {
    ...(policy || {}),
    channel,
    storeReady,
    currentVersion,
    latestVersion,
    minimumVersion,
    updateAvailable: compareVersions(currentVersion, latestVersion) < 0,
    updateRequired: Boolean(
      minimumVersion &&
      compareVersions(currentVersion, minimumVersion) < 0 &&
      (!parsedForceAfter || Number.isNaN(parsedForceAfter) || now >= parsedForceAfter)
    )
  };
}

async function versionStatus({force = false} = {}) {
  const currentVersion = chrome.runtime.getManifest().version;
  const stored = await chrome.storage.local.get("bmpVersionPolicy");
  const cached = stored.bmpVersionPolicy || null;
  const lastAttemptAt = Number(cached?.lastAttemptAt || 0);
  const now = Date.now();

  if (!force && lastAttemptAt && now - lastAttemptAt < VERSION_CHECK_INTERVAL_MS) {
    return applyVersionDecision({...cached, cached: true}, currentVersion, now);
  }

  try {
    const channel = distributionChannel();
    const data = await api(
      `/v1/version?extension_version=${encodeURIComponent(currentVersion)}&distribution_channel=${encodeURIComponent(channel)}`,
      {method: "GET"}
    );
    const policy = applyVersionDecision({
      channel,
      storeReady: data.store_ready === true,
      latestVersion: String(data.latest_version || currentVersion),
      minimumVersion: String(data.minimum_version || ""),
      forceAfter: data.force_after || null,
      releaseUrl: String(data.release_url || ""),
      message: String(data.message || ""),
      lastAttemptAt: now,
      lastSuccessAt: now,
      error: ""
    }, currentVersion, now);
    await chrome.storage.local.set({bmpVersionPolicy: policy});
    return policy;
  } catch (e) {
    const policy = applyVersionDecision({
      ...(cached || {}),
      lastAttemptAt: now,
      error: String(e?.message || e)
    }, currentVersion, now);
    await chrome.storage.local.set({bmpVersionPolicy: policy});
    return policy;
  }
}

async function requireSupportedVersion() {
  const policy = await versionStatus();
  if (policy?.updateRequired) {
    const minimum = policy.minimumVersion || policy.latestVersion || "versi terbaru";
    throw new Error(`Versi BMP Terbuka ini sudah tidak didukung. Update ke versi ${minimum} atau lebih baru.`);
  }
  return policy;
}

async function startPairing() {
  await requireSupportedVersion();
  const installId = await getInstallId();
  const version = chrome.runtime.getManifest().version;
  const data = await api("/v1/pair/start", {
    method: "POST",
    body: JSON.stringify({
      install_id: installId,
      extension_version: version,
      distribution_channel: distributionChannel()
    })
  });
  const pending = {
    pairId: data.pair_id,
    pollSecret: data.poll_secret,
    expiresAt: data.expires_at,
    deepLink: data.deep_link,
    startedAt: Date.now(),
    lastCheckedAt: 0
  };
  await chrome.storage.local.set({bmpPendingPair: pending});
  if (data.deep_link) await chrome.tabs.create({url: data.deep_link});
  return pending;
}

async function checkPairing() {
  const x = await chrome.storage.local.get("bmpPendingPair");
  const p = x.bmpPendingPair;
  if (!p) return {status: "none"};

  if (Date.now() > Number(p.expiresAt || 0)) {
    await chrome.storage.local.remove("bmpPendingPair");
    return {status: "expired"};
  }

  const data = await api(`/v1/pair/status?pair_id=${encodeURIComponent(p.pairId)}`, {
    method: "GET",
    headers: {Authorization: `Pair ${p.pollSecret}`}
  });

  p.lastCheckedAt = Date.now();
  await chrome.storage.local.set({bmpPendingPair: p});

  if (data.status === "verified" && data.token) {
    const verified = await verifyCommunityToken(data.token);
    if (!verified.ok) throw new Error("Token aktivasi dari server tidak valid.");
    await chrome.storage.local.set({bmpCommunityToken: data.token});
    await chrome.storage.local.remove("bmpPendingPair");
    return {status: "verified", expiresAt: Number(verified.payload.exp) * 1000};
  }

  return {status: data.status || "pending"};
}

async function refreshActivation({force = false} = {}) {
  const store = await chrome.storage.local.get([
    "bmpCommunityToken",
    ACTIVATION_REFRESH_META_KEY
  ]);
  const currentToken = store.bmpCommunityToken;
  const verified = await verifyCommunityToken(currentToken);

  if (!verified.ok) {
    return {status: "inactive"};
  }

  const scopes = Array.isArray(verified.payload?.scope)
    ? verified.payload.scope.map(String)
    : [];
  const eligible = Boolean(
    scopes.includes("community_access") &&
    Number(verified.payload?.token_version || 0) >= 2 &&
    /^tg:\d+$/.test(String(verified.payload?.sub || ""))
  );
  if (!eligible) {
    return {
      status: "reauth_required",
      expiresAt: Number(verified.payload.exp) * 1000
    };
  }

  const now = Date.now();
  const meta = store[ACTIVATION_REFRESH_META_KEY] || {};
  const lastAttemptAt = Number(meta.lastAttemptAt || 0);
  if (
    !force &&
    lastAttemptAt > 0 &&
    now - lastAttemptAt < ACTIVATION_REFRESH_INTERVAL_MS
  ) {
    return {
      status: "throttled",
      expiresAt: Number(verified.payload.exp) * 1000,
      nextAt: lastAttemptAt + ACTIVATION_REFRESH_INTERVAL_MS
    };
  }

  await chrome.storage.local.set({
    [ACTIVATION_REFRESH_META_KEY]: {
      ...meta,
      lastAttemptAt: now,
      lastError: ""
    }
  });

  const installId = await getInstallId();
  const currentVersion = chrome.runtime.getManifest().version;

  try {
    const data = await api("/v1/token/refresh", {
      method: "POST",
      headers: {Authorization: `Bearer ${currentToken}`},
      body: JSON.stringify({
        install_id: installId,
        extension_version: currentVersion,
        distribution_channel: distributionChannel()
      })
    });

    if (!data?.token) {
      throw new Error("Layanan aktivasi tidak mengembalikan token baru.");
    }

    const next = await verifyCommunityToken(data.token);
    if (!next.ok) {
      throw new Error("Token pembaruan dari server tidak valid.");
    }

    const previousExpiry = Number(verified.payload.exp) * 1000;
    const nextExpiry = Number(next.payload.exp) * 1000;
    if (nextExpiry + 1000 < previousExpiry) {
      throw new Error("Token pembaruan tidak boleh memperpendek aktivasi.");
    }

    await chrome.storage.local.set({
      bmpCommunityToken: data.token,
      [ACTIVATION_REFRESH_META_KEY]: {
        lastAttemptAt: now,
        lastSuccessAt: Date.now(),
        lastError: ""
      }
    });

    return {
      status: "refreshed",
      changed: Boolean(data.changed || nextExpiry > previousExpiry + 1000),
      supporterBonusApplied: Boolean(data.supporter_bonus_applied),
      expiresAt: nextExpiry
    };
  } catch (error) {
    await chrome.storage.local.set({
      [ACTIVATION_REFRESH_META_KEY]: {
        ...meta,
        lastAttemptAt: now,
        lastError: String(error?.message || error)
      }
    });
    throw error;
  }
}

function viewerUrl(code, mod) {
  return `${SOURCE_ROOT}/reader/index.php?subfolder=${encodeURIComponent(code)}/&doc=M${mod}.pdf`;
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });
  if (contexts.length) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["WORKERS", "BLOBS"],
    justification: "OCR lokal dan penyusunan searchable PDF."
  });
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function askOffscreen(message) {
  await ensureOffscreen();
  return await chrome.runtime.sendMessage({...message, target: "offscreen"});
}

async function saveBlobUrl(blobUrl, filename) {
  const id = await chrome.downloads.download({
    url: blobUrl,
    filename,
    conflictAction: "overwrite",
    saveAs: false
  });
  setTimeout(() => {
    chrome.runtime.sendMessage({
      target: "offscreen",
      type: "REVOKE_BLOB_URL",
      blobUrl
    }).catch(() => {});
  }, 15000);
  return id;
}

async function runReviewerSample() {
  const access = await accessStatus();
  if (!access.reviewer) throw new Error("Mode reviewer tidak aktif untuk instalasi ini.");
  const probe = await askOffscreen({type: "OCR_ENGINE_PROBE"});
  if (!probe?.ok) throw new Error(probe?.error || "OCR lokal tidak siap.");
  const out = await askOffscreen({type: "OCR_REVIEW_SAMPLE"});
  if (!out?.ok || !out.blobUrl) throw new Error(out?.error || "Sampel reviewer gagal diproses.");
  await saveBlobUrl(
    out.blobUrl,
    "BMP Terbuka/Reviewer/BMP_Terbuka_Reviewer_Sample_Searchable.pdf"
  );
  return {ok: true, text: String(out.text || "").trim()};
}

async function startModule(tabId, state, attempt = 0) {
  if (!state.running) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "START_MODULE",
      code: state.code,
      module: state.currentModule,
      delayMs: state.delayMs,
      maxPages: state.maxPages
    });
  } catch (e) {
    const nextAttempt = attempt + 1;
    if (nextAttempt > 20) {
      await setState({
        running: false,
        status: "ERROR",
        progress:
          "Halaman modul terbuka, tetapi komponen pemrosesan belum siap. " +
          "Tutup-buka halaman reader lalu coba lagi.",
        ocrProgress: ""
      });
      return;
    }
    await setState({
      status: "WAITING_PAGE",
      progress: `Menunggu halaman siap... (${nextAttempt}/20)`
    });
    setTimeout(async () => {
      const s = await getState();
      if (s.running && s.tabId === tabId) {
        startModule(tabId, s, nextAttempt).catch(() => {});
      }
    }, 1500);
  }
}

async function navigateCurrentModule() {
  const state = await getState();
  if (!state.running || !state.tabId) return;
  await setState({
    status: `OPENING_M${state.currentModule}`,
    progress: `Membuka Modul ${state.currentModule}...`,
    ocrProgress: ""
  });
  await chrome.tabs.update(state.tabId, {
    url: viewerUrl(state.code, state.currentModule)
  });

  // Edge Android does not always deliver tabs.onUpdated reliably
  // for extension-driven navigation. Kick off the content-script handoff
  // directly as well; startModule() will retry until the page is ready.
  setTimeout(async () => {
    const s = await getState();
    if (
      s.running &&
      s.tabId === state.tabId &&
      s.currentModule === state.currentModule
    ) {
      startModule(state.tabId, s, 0).catch(async e => {
        await setState({running: false, status: "ERROR", progress: String(e)});
      });
    }
  }, 1200);
}

async function finishModule(mod, pages) {
  const state = await getState();
  const out = await askOffscreen({
    type: "OCR_FINISH_MODULE",
    code: state.code,
    module: mod,
    pages
  });
  if (!out?.ok) throw new Error(out?.error || "Gagal menyusun PDF.");
  await saveBlobUrl(
    out.blobUrl,
    `BMP Terbuka/${state.code}/${state.code}_M${mod}_Searchable.pdf`
  );
  invalidateCacheInfo(state.code);
}

async function buildMergedPdf(firstModule, lastModule, {full = false} = {}) {
  const state = await getState();
  const out = await askOffscreen({
    type: firstModule === 1 ? "OCR_BUILD_FULL" : "OCR_BUILD_RANGE",
    code: state.code,
    firstModule,
    lastModule
  });
  if (!out?.ok) throw new Error(out?.error || "Gagal membuat PDF gabungan.");
  const filename = full
    ? `${state.code}_FULL_Searchable.pdf`
    : `${state.code}_M${firstModule}-M${lastModule}_Searchable.pdf`;
  await saveBlobUrl(
    out.blobUrl,
    `BMP Terbuka/${state.code}/${filename}`
  );
  return filename;
}

function invalidateCacheInfo(code) {
  cacheInfoMemo.delete(String(code || "").trim().toUpperCase());
}

async function cacheInfo(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return {modules: [], bytes: 0, totalBytes: 0, detectedLastModule: null};
  let raw = cacheInfoMemo.get(normalized) || null;
  if (!raw) {
    const out = await askOffscreen({type: "OCR_CACHE_INFO", code: normalized});
    if (!out?.ok) throw new Error(out?.error || "Penyimpanan lokal tidak dapat dibaca.");
    raw = {
      modules: normalizeModules(out.modules || [], 99),
      bytes: Number(out.bytes || 0),
      totalBytes: Number(out.totalBytes || 0)
    };
    cacheInfoMemo.set(normalized, raw);
  }
  const meta = await getCodeMeta(normalized);
  const detected = Number(meta.detectedLastModule);
  return {
    ...raw,
    detectedLastModule: Number.isInteger(detected) && detected >= 1 ? detected : null
  };
}

async function exportCachedModule(code, moduleNo) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) throw new Error("Kode BMP tidak valid.");
  if (!Number.isInteger(moduleNo) || moduleNo < 1 || moduleNo > 99) {
    throw new Error("Nomor modul tidak valid.");
  }
  const out = await askOffscreen({
    type: "OCR_EXPORT_CACHED_MODULE",
    code: normalized,
    module: moduleNo
  });
  if (!out?.ok) throw new Error(out?.error || `PDF Modul ${moduleNo} belum tersimpan.`);
  await saveBlobUrl(
    out.blobUrl,
    `BMP Terbuka/${normalized}/${normalized}_M${moduleNo}_Searchable.pdf`
  );
}

function normalizeModules(modules, maxModule = 99) {
  return Array.from(new Set(
    (Array.isArray(modules) ? modules : [])
      .map(Number)
      .filter(m => Number.isInteger(m) && m >= 1 && m <= maxModule)
  )).sort((a, b) => a - b);
}

function firstMissingModule(fromModule, toModule, completedModules) {
  const done = new Set(normalizeModules(completedModules, toModule));
  for (let m = fromModule; m <= toModule; m++) {
    if (!done.has(m)) return m;
  }
  return null;
}

function hasAllModulesThrough(lastModule, completedModules) {
  if (!Number.isInteger(lastModule) || lastModule < 1) return false;
  const done = new Set(normalizeModules(completedModules, lastModule));
  for (let m = 1; m <= lastModule; m++) {
    if (!done.has(m)) return false;
  }
  return true;
}

function modulesInRange(firstModule, lastModule) {
  const out = [];
  for (let m = firstModule; m <= lastModule; m++) out.push(m);
  return out;
}

function missingModulesInRange(firstModule, lastModule, completedModules) {
  const done = new Set(normalizeModules(completedModules, 99));
  return modulesInRange(firstModule, lastModule).filter(m => !done.has(m));
}

function effectiveLastModule(maxModule, detectedLastModule) {
  return Number.isInteger(detectedLastModule) && detectedLastModule >= 1
    ? Math.min(maxModule, detectedLastModule)
    : maxModule;
}

function mergeTarget(state, detectedLastModule = null) {
  const actualLast = Number.isInteger(detectedLastModule) && detectedLastModule >= 1
    ? detectedLastModule
    : null;
  const first = Number(state.startModule);
  const last = actualLast ? Math.min(Number(state.maxModule), actualLast) : Number(state.maxModule);
  if (!Number.isInteger(first) || !Number.isInteger(last) || last < first) return null;
  const full = Boolean(actualLast && first === 1 && Number(state.maxModule) >= actualLast);
  return {first, last, full};
}

function formatModuleList(modules) {
  return normalizeModules(modules, 99).map(m => `M${m}`).join(", ") || "-";
}

async function maybeBuildRequestedMerge(state, detectedLastModule = null) {
  if (!state.mergeRequested) return {made: false, message: ""};
  const target = mergeTarget(state, detectedLastModule);
  if (!target) return {made: false, message: "PDF gabungan tidak dibuat karena rentang yang dipilih tidak tersedia."};
  const missing = missingModulesInRange(target.first, target.last, state.completedModules || []);
  if (missing.length) {
    return {
      made: false,
      message: `PDF gabungan tidak dibuat karena ${missing.map(m => `Modul ${m}`).join(", ")} belum tersedia.`
    };
  }

  await setState({
    status: "BUILDING_MERGE",
    progress: target.full
      ? `Menggabungkan Modul 1–${target.last}...`
      : `Menggabungkan Modul ${target.first}–${target.last}...`,
    ocrProgress: ""
  });
  const filename = await buildMergedPdf(target.first, target.last, {full: target.full});
  return {
    made: true,
    full: target.full,
    first: target.first,
    last: target.last,
    filename,
    message: target.full
      ? `PDF gabungan FULL Modul 1–${target.last} dibuat.`
      : `PDF gabungan Modul ${target.first}–${target.last} dibuat.`
  };
}

function finalSummary(state, mergeMessage = "") {
  const lines = [
    `Diproses: ${formatModuleList(state.processedModules || [])}`,
    `Dilewati: ${formatModuleList(state.skippedModules || [])}`
  ];
  if (mergeMessage) lines.push(mergeMessage);
  return lines.join("\n");
}

chrome.runtime.onInstalled.addListener(async () => {
  const x = await chrome.storage.local.get("bmpState");
  if (!x.bmpState) await chrome.storage.local.set({bmpState: DEFAULT_STATE});
  await getInstallId();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  const state = await getState();
  if (!state.running || state.tabId !== tabId) return;
  if (!tab.url || !tab.url.startsWith(`${SOURCE_ROOT}/reader/`)) return;

  setTimeout(async () => {
    const s = await getState();
    if (s.running && s.tabId === tabId) {
      startModule(tabId, s).catch(async e => {
        await setState({running: false, status: "ERROR", progress: String(e)});
      });
    }
  }, 900);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === "offscreen") return;

  (async () => {
    if (msg.type === "GET_ACCESS_STATUS") {
      sendResponse({ok: true, ...(await accessStatus())});
      return;
    }
    if (msg.type === "OPEN_CHANNEL") {
      await chrome.tabs.create({url: CFG.TELEGRAM_CHANNEL_URL});
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OPEN_GROUP") {
      await chrome.tabs.create({url: CFG.TELEGRAM_GROUP_URL});
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "RESET_PAIRING") {
      await chrome.storage.local.remove("bmpPendingPair");
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OPEN_PENDING_TELEGRAM") {
      const x = await chrome.storage.local.get("bmpPendingPair");
      const p = x.bmpPendingPair;
      if (!p?.deepLink) throw new Error("Sesi verifikasi tidak tersedia.");
      await chrome.tabs.create({url: p.deepLink});
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "START_PAIRING") {
      await chrome.storage.local.remove("bmpPendingPair");
      sendResponse({ok: true, pending: await startPairing()});
      return;
    }
    if (msg.type === "CHECK_PAIRING") {
      sendResponse({ok: true, result: await checkPairing()});
      return;
    }
    if (msg.type === "REFRESH_ACTIVATION") {
      sendResponse({
        ok: true,
        result: await refreshActivation({force: Boolean(msg.force)})
      });
      return;
    }
    if (msg.type === "GET_VERSION_STATUS") {
      sendResponse({ok: true, policy: await versionStatus()});
      return;
    }
    if (msg.type === "GET_CLOUD_STATE") {
      sendResponse({ok: true, state: await cloudState({force: Boolean(msg.force)})});
      return;
    }
    if (msg.type === "REPORT_AD_EVENT") {
      sendResponse(await reportAdEvent({
        eventType: msg.eventType,
        placement: msg.placement,
        campaignId: msg.campaignId,
        revision: msg.revision
      }));
      return;
    }
    if (msg.type === "EXECUTE_CLOUD_ACTION") {
      sendResponse(await executeCloudAction(msg.action));
      return;
    }
    if (msg.type === "OPEN_UPDATE") {
      const policy = await versionStatus();
      const url = String(policy?.releaseUrl || "");
      if (!url && isStoreChannel()) {
        sendResponse({ok: true, managedByStore: true});
        return;
      }
      await chrome.tabs.create({url: url || CFG.TELEGRAM_CHANNEL_URL});
      sendResponse({ok: true, managedByStore: false});
      return;
    }
    if (msg.type === "RUN_REVIEW_SAMPLE") {
      sendResponse(await runReviewerSample());
      return;
    }
    if (msg.type === "GET_CACHE_INFO") {
      const code = String(msg.code || "").trim().toUpperCase();
      if (!code) {
        sendResponse({ok: true, modules: [], bytes: 0, totalBytes: 0, detectedLastModule: null});
        return;
      }
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
        sendResponse({ok: true, modules: [], bytes: 0, totalBytes: 0, detectedLastModule: null});
        return;
      }
      sendResponse({ok: true, ...(await cacheInfo(code))});
      return;
    }
    if (msg.type === "EXPORT_CACHED_MODULE") {
      await requireAccess();
      const code = String(msg.code || "").trim().toUpperCase();
      const moduleNo = Number(msg.module);
      await exportCachedModule(code, moduleNo);
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "CLEAR_CACHE_CODE") {
      await requireAccess();
      const code = String(msg.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("Kode BMP tidak valid.");
      const current = await getState();
      if (current.running && current.code === code) {
        throw new Error("Penyimpanan BMP yang sedang diproses tidak bisa dibersihkan.");
      }
      const out = await askOffscreen({type: "OCR_CLEAR_CODE", code});
      if (!out?.ok) throw new Error(out?.error || "Penyimpanan lokal tidak dapat dibersihkan.");
      await clearCodeMeta(code);
      invalidateCacheInfo(code);
      if (current.code === code) {
        await setState({completedModules: [], detectedLastModule: null});
      }
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "GET_STATE") {
      sendResponse({ok: true, state: await getState()});
      return;
    }
    if (msg.type === "START_JOB") {
      await requireAccess();
      await requireSupportedVersion();

      const tabId = msg.tabId;
      const code = String(msg.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
        throw new Error("Kode BMP tidak valid.");
      }

      const startModule = Number(msg.startModule || 1);
      const maxModule = Number(msg.maxModule || 9);
      if (!Number.isInteger(startModule) || !Number.isInteger(maxModule) ||
          startModule < 1 || maxModule < startModule || maxModule > 99) {
        throw new Error("Rentang modul tidak valid.");
      }

      const redownload = Boolean(msg.redownload);
      const mergeRequested = Boolean(msg.mergeRequested);

      const probe = await askOffscreen({type: "OCR_ENGINE_PROBE"});
      if (!probe?.ok) throw new Error(probe?.error || "OCR lokal tidak siap.");

      const prepared = await askOffscreen({type: "OCR_PREPARE_JOB", code});
      if (!prepared?.ok) {
        throw new Error(prepared?.error || "Penyimpanan lokal tidak dapat dibaca.");
      }

      const meta = await getCodeMeta(code);
      const detectedLastModule = Number(meta.detectedLastModule);
      const knownLast = Number.isInteger(detectedLastModule) && detectedLastModule >= 1
        ? detectedLastModule
        : null;
      const effectiveMaxModule = effectiveLastModule(maxModule, knownLast);
      const allCachedModules = normalizeModules(prepared.cachedModules || [], 99);
      const selectedCached = effectiveMaxModule >= startModule
        ? allCachedModules.filter(m => m >= startModule && m <= effectiveMaxModule)
        : [];
      const forced = redownload ? new Set(selectedCached) : new Set();
      const completedModules = allCachedModules.filter(m => !forced.has(m));
      const skippedModules = redownload ? [] : selectedCached;
      const currentModule = effectiveMaxModule >= startModule
        ? firstMissingModule(startModule, effectiveMaxModule, completedModules)
        : null;

      const nextState = await setState({
        running: true,
        tabId,
        code,
        startModule,
        currentModule: currentModule ?? startModule,
        maxModule,
        effectiveMaxModule,
        delayMs: 2500,
        maxPages: 500,
        mergeRequested,
        redownload,
        status: "STARTING",
        progress: currentModule == null
          ? "Rentang yang dipilih sudah tersedia di penyimpanan lokal."
          : currentModule > startModule
            ? `Melanjutkan dari Modul ${currentModule}; modul yang sudah tersimpan dilewati.`
            : redownload
              ? "Menyiapkan download ulang modul yang dipilih..."
              : "Menyiapkan dokumen...",
        ocrProgress: "",
        completedModules,
        cachedModulesAtStart: allCachedModules,
        processedModules: [],
        skippedModules,
        detectedLastModule: knownLast,
        mergeMessage: ""
      });

      if (effectiveMaxModule < startModule) {
        const message = knownLast
          ? `Modul terakhir yang terdeteksi adalah M${knownLast}; rentang ini tidak perlu diproses.`
          : "Tidak ada modul pada rentang ini yang dapat diproses.";
        await setState({running: false, status: "DONE", progress: message, ocrProgress: ""});
        sendResponse({ok: true, resumed: true, skippedModules: []});
        return;
      }

      if (currentModule == null) {
        let mergeMessage = "";
        try {
          const merged = await maybeBuildRequestedMerge(nextState, knownLast);
          mergeMessage = merged.message;
        } catch (e) {
          mergeMessage = `PDF gabungan gagal: ${String(e?.message || e)}`;
        }
        const finalState = {...nextState, mergeMessage};
        await setState({
          running: false,
          status: "DONE",
          progress: finalSummary(finalState, mergeMessage),
          mergeMessage,
          ocrProgress: ""
        });
        sendResponse({ok: true, resumed: true, skippedModules});
        return;
      }

      await setState({currentModule});
      await navigateCurrentModule();
      sendResponse({
        ok: true,
        resumed: !redownload && currentModule > startModule,
        skippedModules
      });
      return;
    }
    if (msg.type === "STOP_JOB") {
      await setState({
        running: false,
        status: "STOPPED_BY_USER",
        progress: "Proses dihentikan.",
        ocrProgress: ""
      });
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_PROGRESS") {
      const pct = Number.isFinite(msg.progress)
        ? `${Math.round(msg.progress * 100)}%`
        : "";
      const raw = String(msg.status || "").toLowerCase();
      let label = "Memproses teks";
      if (raw.includes("recognizing")) label = "Membaca teks";
      else if (raw.includes("loading language")) label = "Menyiapkan bahasa OCR";
      else if (raw.includes("loading tesseract") || raw.includes("initializing"))
        label = "Menyiapkan OCR";
      const pageLabel = Number(msg.page) > 0 ? ` halaman ${msg.page}` : "";
      await setState({
        ocrProgress: `${label}${pageLabel}${pct ? ` — ${pct}` : ""}`
      });
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "PAGE_PROGRESS") {
      const totalPages = Number(msg.totalPages || 0);
      const pageSuffix = totalPages > 0 ? ` / ${totalPages}` : "";
      await setState({
        status: `DOWNLOADING_M${msg.module}`,
        progress: `Modul ${msg.module} • halaman ${msg.page}${pageSuffix}`,
        ocrProgress: `Menyiapkan halaman ${msg.page}${pageSuffix}`
      });
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_PAGE") {
      const state = await getState();
      if (!state.running) {
        sendResponse({ok: false, error: "Proses tidak aktif."});
        return;
      }
      const out = await askOffscreen({
        type: "OCR_ADD_PAGE",
        code: state.code,
        module: msg.module,
        page: msg.page,
        dataUrl: msg.dataUrl
      });
      if (!out?.ok) throw new Error(out?.error || "OCR halaman gagal.");
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "MODULE_RESULT") {
      const state = await getState();
      if (!state.running) {
        sendResponse({ok: true});
        return;
      }

      const mod = Number(msg.module);

      if (msg.result === "complete") {
        await setState({
          status: `OCR_FINALIZING_M${mod}`,
          progress: `Modul ${mod} selesai. Menyusun PDF...`
        });
        await finishModule(mod, msg.pages);

        const completed = normalizeModules(
          [...(state.completedModules || []), mod],
          99
        );
        const processed = normalizeModules(
          [...(state.processedModules || []), mod],
          99
        );
        const nextModule = firstMissingModule(
          mod + 1,
          Number(state.effectiveMaxModule || state.maxModule),
          completed
        );

        if (nextModule == null) {
          const readyState = {...state, completedModules: completed, processedModules: processed};
          let mergeMessage = "";
          try {
            const merged = await maybeBuildRequestedMerge(
              readyState,
              Number.isInteger(Number(state.detectedLastModule))
                ? Number(state.detectedLastModule)
                : null
            );
            mergeMessage = merged.message;
          } catch (e) {
            mergeMessage = `PDF gabungan gagal: ${String(e?.message || e)}`;
          }
          const finalState = {...readyState, mergeMessage};
          await setState({
            running: false,
            completedModules: completed,
            processedModules: processed,
            status: "DONE",
            progress: finalSummary(finalState, mergeMessage),
            mergeMessage,
            ocrProgress: ""
          });
          sendResponse({ok: true});
          return;
        }

        await setState({
          completedModules: completed,
          processedModules: processed,
          currentModule: nextModule,
          status: `M${mod}_PDF_READY`,
          progress: `PDF Modul ${mod} siap. Membuka Modul ${nextModule}...`,
          ocrProgress: ""
        });
        setTimeout(navigateCurrentModule, Math.max(1000, state.delayMs));
        sendResponse({ok: true});
        return;
      }

      if (msg.result === "missing_module") {
        const completed = normalizeModules(state.completedModules || [], 99);
        const knownLast = Number(state.detectedLastModule);
        const cachedAtStart = normalizeModules(state.cachedModulesAtStart || [], 99);
        const hasHigherEvidence = completed.some(m => m > mod) ||
          cachedAtStart.some(m => m > mod) ||
          (Number.isInteger(knownLast) && knownLast > mod);

        if (hasHigherEvidence) {
          const gapMessage = state.mergeRequested
            ? `PDF gabungan tidak dibuat karena Modul ${mod} belum tersedia.`
            : `Modul ${mod} belum tersedia.`;
          const stopped = {...state, completedModules: completed};
          await setState({
            running: false,
            status: "MISSING_GAP",
            progress: `${gapMessage}\n${finalSummary(stopped)}`,
            mergeMessage: state.mergeRequested ? gapMessage : "",
            ocrProgress: ""
          });
          sendResponse({ok: true});
          return;
        }

        const lastMod = mod - 1;
        if (lastMod >= 1) await setDetectedLastModule(state.code, lastMod);
        const detectedLastModule = lastMod >= 1 ? lastMod : null;
        const readyState = {
          ...state,
          completedModules: completed,
          detectedLastModule,
          effectiveMaxModule: lastMod >= 1
            ? Math.min(Number(state.maxModule), lastMod)
            : 0
        };

        let mergeMessage = "";
        if (state.mergeRequested && lastMod >= 1) {
          try {
            const merged = await maybeBuildRequestedMerge(readyState, lastMod);
            mergeMessage = merged.message;
          } catch (e) {
            mergeMessage = `PDF gabungan gagal: ${String(e?.message || e)}`;
          }
        }

        const detectedText = lastMod >= 1
          ? `Modul terakhir terdeteksi: M${lastMod}.`
          : "Modul 1 tidak tersedia.";
        const summary = finalSummary(readyState, mergeMessage);
        await setState({
          running: false,
          completedModules: completed,
          detectedLastModule,
          effectiveMaxModule: readyState.effectiveMaxModule,
          status: "END_CANDIDATE",
          progress: `${detectedText}${summary ? `\n${summary}` : ""}`,
          mergeMessage,
          ocrProgress: ""
        });
        sendResponse({ok: true});
        return;
      }

      if (msg.result === "login_required") {
        await setState({
          running: false,
          status: "LOGIN_REQUIRED",
          progress: "Sesi sumber meminta login ulang.",
          ocrProgress: ""
        });
        sendResponse({ok: true});
        return;
      }

      if (msg.result === "blocked") {
        await setState({
          running: false,
          status: "BLOCKED",
          progress: "Akses ditolak oleh server. Proses dihentikan tanpa mencoba ulang.",
          ocrProgress: ""
        });
        sendResponse({ok: true});
        return;
      }

      await setState({
        running: false,
        status: "ERROR",
        progress: msg.reason || "Proses tidak dapat dilanjutkan.",
        ocrProgress: ""
      });
      sendResponse({ok: true});
      return;
    }

    sendResponse({ok: false, error: "Pesan tidak dikenal."});
  })().catch(async e => {
    try {
      await setState({
        running: false,
        status: "ERROR",
        progress: String(e?.message || e),
        ocrProgress: ""
      });
    } catch (_) {}
    sendResponse({ok: false, error: String(e?.message || e)});
  });

  return true;
});
