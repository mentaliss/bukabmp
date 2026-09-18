importScripts("config.js");

const CFG = self.BMP_CONFIG;
const SOURCE_ROOT = "https://pustaka.ut.ac.id";
const VERSION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STATE = {
  running: false,
  tabId: null,
  code: "",
  startModule: 1,
  currentModule: 1,
  maxModule: 9,
  delayMs: 2500,
  maxPages: 500,
  buildFull: true,
  status: "IDLE",
  progress: "",
  ocrProgress: "",
  completedModules: []
};

let creatingOffscreen = null;

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
  return {
    active: Boolean(verified.ok),
    expiresAt: verified.ok ? Number(verified.payload.exp) * 1000 : null,
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
  const latestVersion = String(policy?.latestVersion || currentVersion);
  const minimumVersion = String(policy?.minimumVersion || "");
  const rawForceAfter = policy?.forceAfter;
  const parsedForceAfter = rawForceAfter
    ? (typeof rawForceAfter === "number" ? rawForceAfter : Date.parse(rawForceAfter))
    : null;
  return {
    ...(policy || {}),
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
    const data = await api(
      `/v1/version?extension_version=${encodeURIComponent(currentVersion)}`,
      {method: "GET"}
    );
    const policy = applyVersionDecision({
      latestVersion: String(data.latest_version || currentVersion),
      minimumVersion: String(data.minimum_version || ""),
      forceAfter: data.force_after || null,
      releaseUrl: String(data.release_url || CFG.TELEGRAM_CHANNEL_URL || ""),
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
    body: JSON.stringify({install_id: installId, extension_version: version})
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

  // Edge Canary Android does not always deliver tabs.onUpdated reliably
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
}

async function buildFull(lastMod, candidate = false) {
  const state = await getState();
  const out = await askOffscreen({
    type: "OCR_BUILD_FULL",
    code: state.code,
    lastModule: lastMod
  });
  if (!out?.ok) throw new Error(out?.error || "Gagal membuat PDF gabungan.");
  const suffix = candidate ? "_FULL_CANDIDATE_Searchable.pdf" : "_FULL_Searchable.pdf";
  await saveBlobUrl(
    out.blobUrl,
    `BMP Terbuka/${state.code}/${state.code}${suffix}`
  );
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
    if (msg.type === "GET_VERSION_STATUS") {
      sendResponse({ok: true, policy: await versionStatus()});
      return;
    }
    if (msg.type === "OPEN_UPDATE") {
      const policy = await versionStatus();
      const url = policy?.releaseUrl || CFG.TELEGRAM_CHANNEL_URL;
      await chrome.tabs.create({url});
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

      const probe = await askOffscreen({type: "OCR_ENGINE_PROBE"});
      if (!probe?.ok) throw new Error(probe?.error || "OCR lokal tidak siap.");

      await askOffscreen({type: "OCR_RESET_JOB", code});

      await setState({
        running: true,
        tabId,
        code,
        startModule,
        currentModule: startModule,
        maxModule,
        delayMs: 2500,
        maxPages: 500,
        buildFull: true,
        status: "STARTING",
        progress: "Menyiapkan dokumen...",
        ocrProgress: "",
        completedModules: []
      });
      await navigateCurrentModule();
      sendResponse({ok: true});
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
      await setState({
        status: `DOWNLOADING_M${msg.module}`,
        progress: `Modul ${msg.module} • halaman ${msg.page}`,
        ocrProgress: `Menyiapkan halaman ${msg.page}`
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

        const completed = Array.from(
          new Set([...(state.completedModules || []), mod])
        ).sort((a, b) => a - b);

        if (mod >= state.maxModule) {
          let finalMessage = `Modul ${mod} selesai.`;
          if (Number(state.startModule || 1) === 1) {
            await setState({
              status: "BUILDING_FULL",
              progress: `Menggabungkan Modul 1–${mod}...`,
              completedModules: completed,
              ocrProgress: ""
            });
            try {
              await buildFull(mod, false);
              finalMessage =
                `Selesai. PDF gabungan Modul 1–${mod} sudah dibuat.`;
            } catch (e) {
              finalMessage =
                `PDF per modul selesai, tetapi PDF gabungan gagal: ${String(e)}`;
            }
          }
          await setState({
            running: false,
            completedModules: completed,
            status: "DONE",
            progress: finalMessage,
            ocrProgress: ""
          });
          sendResponse({ok: true});
          return;
        }

        await setState({
          completedModules: completed,
          currentModule: mod + 1,
          status: `M${mod}_PDF_READY`,
          progress: `PDF Modul ${mod} siap. Membuka Modul ${mod + 1}...`,
          ocrProgress: ""
        });
        setTimeout(navigateCurrentModule, Math.max(1000, state.delayMs));
        sendResponse({ok: true});
        return;
      }

      if (msg.result === "missing_module") {
        const lastMod = mod - 1;
        let extra = "";
        if (lastMod >= 1 && Number(state.startModule || 1) === 1) {
          await setState({
            status: "BUILDING_FULL",
            progress: `Modul ${mod} tidak tersedia. Menggabungkan Modul 1–${lastMod}...`
          });
          try {
            await buildFull(lastMod, true);
            extra = ` PDF gabungan kandidat Modul 1–${lastMod} dibuat.`;
          } catch (e) {
            extra = ` PDF gabungan kandidat gagal: ${String(e)}`;
          }
        }
        await setState({
          running: false,
          status: "END_CANDIDATE",
          progress: `Modul ${mod} tidak tersedia. Kandidat modul terakhir: ${lastMod}.${extra}`,
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
