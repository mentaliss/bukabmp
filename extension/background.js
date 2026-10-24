importScripts("config.js", "cloud-surface.js", "telemetry.js", "cache-consistency.js", "catalog-title.js");
importScripts("control-surface-background.js");

const CFG = self.BMP_CONFIG;
const CLOUD = self.BMP_CLOUD_SURFACE;
const TELEMETRY = self.BMP_TELEMETRY;
const CACHE_CONSISTENCY = self.BMP_CACHE_CONSISTENCY;
const SOURCE_ROOT = "https://pustaka.ut.ac.id";
const VERSION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLOUD_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
const CLOUD_CACHE_KEY = "bmpCloudStateCacheV3";
const ACTIVATION_REFRESH_META_KEY = "bmpActivationRefreshMetaV110";
const ACTIVATION_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const ACTIVATION_REFRESH_NO_SUPPORTER_INTERVAL_MS = 60 * 1000;
const ACTIVATION_REFRESH_FAILURE_BACKOFF_MS = 60 * 1000;
const DETECTED_LAST_MODULE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_MODULE_EVIDENCE_VERSION = 2;
const LAST_MODULE_CANDIDATE_TTL_MS = 30 * 60 * 1000;
const QUIZ_LIFECYCLE_KEY = "bmpQuizLifecycleV1";
const QUIZ_LIFECYCLES_KEY = "bmpQuizLifecyclesV2";
const QUIZ_LIFECYCLE_ACTIVE_TTL_MS = 10 * 60 * 1000;
const QUIZ_LIFECYCLE_TERMINAL_TTL_MS = 5 * 60 * 1000;
const QUIZ_LIFECYCLE_SLOW_GENERATION_MS = 2 * 60 * 1000;
const QUIZ_LIFECYCLE_ACTIVE_PHASES = new Set(["checking_bank", "generating_bank", "starting_round"]);
const JOB_ERROR_MESSAGE_TYPES = new Set(["START_JOB", "OCR_PAGE", "MODULE_RESULT"]);
const DEFAULT_STATE = {
  running: false,
  runId: "",
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
  pageIndex: 0,
  pageTotal: 0,
  completedModules: [],
  cachedModulesAtStart: [],
  processedModules: [],
  skippedModules: [],
  detectedLastModule: null,
  endProbeStartModule: null,
  endProbeMaxModule: null,
  mergeMessage: ""
};

let creatingOffscreen = null;
let installIdPromise = null;
let startJobClaimRunId = "";
let offscreenMaintenanceClaim = "";
let quizStartClaim = "";
let quizStartIdentity = null;
let quizReadyStartClaim = "";
const uiLocalOperationPorts = new Map();
let uiLocalOperationOwner = null;
let uiLocalTentativeClaim = "";
const uiLocalDeadTokens = new Set();
let uiLocalRecordQueue = Promise.resolve();
const serializeUiLocalRecord = fn => {
  const run=uiLocalRecordQueue.then(fn,fn);
  uiLocalRecordQueue=run.catch(()=>{});
  return run;
};
const uiLocalSender = sender => !sender?.tab && sender?.url?.split(/[?#]/)[0] === chrome.runtime.getURL("popup.html");
const uiLocalMatches = (entry, sender, token) => entry?.token === token && uiLocalSender(sender) &&
  (!entry.documentId || entry.documentId === sender.documentId);
chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=="bmp-ui-local-operation-v1" || !uiLocalSender(port.sender))return;
  const entry={port,documentId:port.sender.documentId||"",token:"",connected:true};
  port.onMessage.addListener(async message=>{
    if(message?.type!=="hello" || !/^[a-zA-Z0-9-]{16,80}$/.test(message.token||""))return;
    entry.token=message.token;
    uiLocalOperationPorts.set(entry.token,entry);
    let ok=true;
    if(message.resume){
      const stored=(await chrome.storage.local.get("bmpLocalBackupOperationV1")).bmpLocalBackupOperationV1;
      ok=entry.connected && stored?.ownerToken===entry.token &&
        (!uiLocalOperationOwner || uiLocalOperationOwner.token===entry.token) &&
        (!offscreenMaintenanceClaim || offscreenMaintenanceClaim===uiLocalTentativeClaim || offscreenMaintenanceClaim==="ui-local:"+entry.token);
      if(ok){uiLocalDeadTokens.delete(entry.token);uiLocalOperationOwner=entry;offscreenMaintenanceClaim="ui-local:"+entry.token;}
    }
    if(entry.connected)port.postMessage({type:"ready",ok});
  });
  port.onDisconnect.addListener(()=>{
    entry.connected=false;
    if(uiLocalOperationPorts.get(entry.token)===entry)uiLocalDeadTokens.add(entry.token);
    if(uiLocalOperationPorts.get(entry.token)===entry)uiLocalOperationPorts.delete(entry.token);
    if(uiLocalOperationOwner===entry){
      offscreenMaintenanceClaim="";
      uiLocalOperationOwner=null;
    }
  });
});
async function uiLocalOperationBusy(){
  const stored=await chrome.storage.local.get("bmpLocalBackupOperationV1");
  if(uiLocalOperationOwner?.connected)return true;
  const operation=stored.bmpLocalBackupOperationV1;
  if(!["backing_up","validating","restoring","verifying","staging","committing"].includes(String(operation?.phase||"")))return false;
  // Give surviving documents a chance to reconnect after a worker restart.
  await new Promise(resolve=>setTimeout(resolve,600));
  if(uiLocalOperationOwner?.connected)return true;
  if(operation.ownerDocumentId && chrome.runtime.getContexts){
    const contexts=await chrome.runtime.getContexts({documentIds:[operation.ownerDocumentId]});
    if(contexts.length)return true;
  }
  if(operation.ownerDocumentId && chrome.runtime.getContexts)return false;
  if(uiLocalDeadTokens.has(operation.ownerToken))return false;
  // No broadcast probe: first-responder semantics cannot prove owner death.
  // Old APIs without context enumeration fail closed until a known disconnect.
  return true;
}
let stateMutationQueue = Promise.resolve();
let quizLifecycleMutationQueue = Promise.resolve();
const cancelledRunIds = new Set();
const cacheInfoMemo = CACHE_CONSISTENCY.createEpochMemo();

function serializeStateMutation(fn) {
  const run = stateMutationQueue.then(fn, fn);
  stateMutationQueue = run.catch(() => {});
  return run;
}

function serializeQuizLifecycleMutation(fn) {
  const run = quizLifecycleMutationQueue.then(fn, fn);
  quizLifecycleMutationQueue = run.catch(() => {});
  return run;
}

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

const JOB_SUCCESS_STATUSES=new Set(["DONE","END_CANDIDATE"]);
const JOB_FAILURE_STATUSES=new Set(["ERROR","BLOCKED","LOGIN_REQUIRED","MISSING_GAP","MISSING_UNCONFIRMED","INTERRUPTED"]);

function reportJobStateTransition(previous,next){
  try{
    if(previous?.running!==true&&next?.running===true){
      void reportTelemetryEvent("job_started").catch(()=>{});
      return;
    }
    if(previous?.running===true&&next?.running!==true){
      const status=String(next?.status||"");
      if(JOB_SUCCESS_STATUSES.has(status))void reportTelemetryEvent("job_completed").catch(()=>{});
      else if(JOB_FAILURE_STATUSES.has(status))void reportTelemetryEvent("job_failed").catch(()=>{});
    }
  }catch(_){}
}

async function setState(patch) {
  return await serializeStateMutation(async () => {
    const current = await getState();
    const next = {...current, ...patch};
    await chrome.storage.local.set({bmpState: next});
    reportJobStateTransition(current,next);
    return next;
  });
}

async function activeRunState(runId) {
  const id = String(runId || "");
  if (!id || cancelledRunIds.has(id)) return null;
  const current = await getState();
  if (
    cancelledRunIds.has(id) ||
    !current.running ||
    String(current.runId || "") !== id
  ) return null;
  return current;
}

async function setStateForRun(runId, patch) {
  const id = String(runId || "");
  return await serializeStateMutation(async () => {
    if (!id || cancelledRunIds.has(id)) return null;
    const current = await getState();
    if (
      cancelledRunIds.has(id) ||
      !current.running ||
      String(current.runId || "") !== id
    ) return null;
    const next = {...current, ...patch};
    if (cancelledRunIds.has(id)) return null;
    await chrome.storage.local.set({bmpState: next});
    if (cancelledRunIds.has(id)) return null;
    reportJobStateTransition(current,next);
    return next;
  });
}

async function requireActiveRun(runId) {
  const current = await activeRunState(runId);
  if (!current) throw new Error("Proses sudah dihentikan atau diganti.");
  return current;
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

async function setDetectedLastModuleForRun(runId, code, lastModule) {
  const id = String(runId || "");
  const normalized = String(code || "").toUpperCase();
  if (!id || !normalized || !Number.isInteger(lastModule) || lastModule < 1 || lastModule > 99) {
    return null;
  }
  const map = await getCacheMetaMap();
  if (!(await activeRunState(id))) return null;

  const now = Date.now();
  const previous = map[normalized] && typeof map[normalized] === "object"
    ? map[normalized]
    : {};
  const candidate = previous.lastModuleCandidate;
  const candidateAt = previous.lastModuleCandidateAt;
  const candidateRunId = String(previous.lastModuleCandidateRunId || "");
  const confirmsPreviousRun = (
    Number.isInteger(candidate) &&
    candidate === lastModule &&
    Number.isFinite(candidateAt) &&
    candidateAt > 0 &&
    candidateAt <= now &&
    now - candidateAt <= LAST_MODULE_CANDIDATE_TTL_MS &&
    candidateRunId &&
    candidateRunId !== id
  );

  map[normalized] = confirmsPreviousRun
    ? {
        ...previous,
        detectedLastModule: lastModule,
        detectedAt: now,
        detectedEvidenceVersion: LAST_MODULE_EVIDENCE_VERSION,
        lastModuleCandidate: null,
        lastModuleCandidateAt: 0,
        lastModuleCandidateRunId: ""
      }
    : {
        ...previous,
        detectedLastModule: null,
        detectedAt: 0,
        detectedEvidenceVersion: 0,
        lastModuleCandidate: lastModule,
        lastModuleCandidateAt: now,
        lastModuleCandidateRunId: id
      };

  if (cancelledRunIds.has(id)) return null;
  await chrome.storage.local.set({bmpCacheMeta: map});
  if (cancelledRunIds.has(id)) return null;
  return {
    confirmed: confirmsPreviousRun,
    meta: map[normalized]
  };
}

function recentDetectedLastModule(meta, now = Date.now()) {
  if (meta?.detectedEvidenceVersion !== LAST_MODULE_EVIDENCE_VERSION) return null;
  const last = meta?.detectedLastModule;
  const detectedAt = meta?.detectedAt;
  if (!Number.isInteger(last) || last < 1 || last > 99) return null;
  if (!Number.isFinite(detectedAt) || detectedAt <= 0 || detectedAt > now) return null;
  if (now - detectedAt > DETECTED_LAST_MODULE_TTL_MS) return null;
  return last;
}

async function invalidateTerminalEvidenceBelow(code, higherModule, runId = "") {
  const normalized = String(code || "").toUpperCase();
  const higher = Number(higherModule);
  const id = String(runId || "");
  if (!normalized || !Number.isInteger(higher) || higher < 1 || higher > 99) return null;
  if (id && !(await activeRunState(id))) return null;

  const map = await getCacheMetaMap();
  const previous = map[normalized] && typeof map[normalized] === "object"
    ? map[normalized]
    : {};
  const detected = Number(previous.detectedLastModule);
  const candidate = Number(previous.lastModuleCandidate);
  const invalidatesDetected = Number.isInteger(detected) && detected >= 1 && detected < higher;
  const invalidatesCandidate = Number.isInteger(candidate) && candidate >= 1 && candidate < higher;

  if (!invalidatesDetected && !invalidatesCandidate) {
    return {changed: false, meta: previous};
  }

  const next = {...previous};
  if (invalidatesDetected) {
    next.detectedLastModule = null;
    next.detectedAt = 0;
    next.detectedEvidenceVersion = 0;
  }
  if (invalidatesCandidate) {
    next.lastModuleCandidate = null;
    next.lastModuleCandidateAt = 0;
    next.lastModuleCandidateRunId = "";
  }

  map[normalized] = next;
  if (id && cancelledRunIds.has(id)) return null;
  await chrome.storage.local.set({bmpCacheMeta: map});
  if (id && cancelledRunIds.has(id)) return null;
  return {changed: true, meta: next};
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
  if (installIdPromise) return await installIdPromise;

  installIdPromise = (async () => {
    const x = await chrome.storage.local.get("bmpInstallId");
    if (x.bmpInstallId) return x.bmpInstallId;

    const id = crypto.randomUUID();
    await chrome.storage.local.set({bmpInstallId: id});

    // Read back the persisted authority so every concurrent caller observes
    // exactly the installation ID that survived storage.
    const persisted = await chrome.storage.local.get("bmpInstallId");
    return persisted.bmpInstallId || id;
  })();

  try {
    return await installIdPromise;
  } finally {
    installIdPromise = null;
  }
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

function safeHttpsUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeTelegramUrl(value) {
  const safe = safeHttpsUrl(value);
  if (!safe) return "";
  try {
    const url = new URL(safe);
    return url.hostname.toLowerCase() === "t.me" ? url.toString() : "";
  } catch {
    return "";
  }
}

async function api(path, options = {}) {
  if (!configReady()) throw new Error("Konfigurasi aktivasi belum lengkap.");
  // timeoutMs adalah opt-in per panggilan. Panggilan lambat yang sah (mis.
  // generate bank Quiz) tidak boleh kena batas waktu jalur aktivasi.
  const {timeoutMs, ...fetchOptions} = options;
  const url = `${String(CFG.API_BASE_URL).replace(/\/$/, "")}${path}`;
  const call = async (signal) => {
    const res = await fetch(url, {
      ...fetchOptions,
      ...(signal ? {signal} : {}),
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || `Community API HTTP ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  };
  return timeoutMs
    ? await withActivationTimeout(call, timeoutMs)
    : await call(null);
}

async function quizBearerToken() {
  const store = await chrome.storage.local.get("bmpCommunityToken");
  const token = typeof store.bmpCommunityToken === "string"
    ? store.bmpCommunityToken
    : "";
  const verified = await verifyCommunityToken(token);
  const scopes = verified.ok && Array.isArray(verified.payload?.scope)
    ? verified.payload.scope.map(String)
    : [];
  if (!verified.ok || !scopes.includes("community_access")) {
    throw new Error("Aktivasi komunitas diperlukan untuk Quiz.");
  }
  if (
    Number(verified.payload?.token_version || 0) < 2 ||
    !/^tg:\d+$/.test(String(verified.payload?.sub || ""))
  ) {
    throw new Error("Verifikasi ulang aktivasi diperlukan sebelum memakai Quiz.");
  }
  return token;
}

async function quizApi(path, body) {
  const token = await quizBearerToken();
  const installId = await getInstallId();
  try {
    return await api(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-BMP-Install-Id": installId
      },
      body: JSON.stringify(body || {})
    });
  } catch (error) {
    if (error?.data && typeof error.data === "object") {
      return error.data;
    }
    throw error;
  }
}

function normalizeQuizModuleIdentity(code, moduleNo) {
  const normalized = String(code || "").trim().toUpperCase();
  const mod = Number(moduleNo);
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) {
    throw new Error("Kode BMP tidak valid.");
  }
  if (!Number.isInteger(mod) || mod < 1 || mod > 99) {
    throw new Error("Nomor modul tidak valid.");
  }
  return {course_code: normalized, module_number: mod};
}

async function localQuizSourceInfo(code, moduleNo, {includeText = false} = {}) {
  const identity = normalizeQuizModuleIdentity(code, moduleNo);
  const out = await askOffscreen({
    type: includeText ? "OCR_GET_QUIZ_SOURCE" : "OCR_QUIZ_SOURCE_INFO",
    code: identity.course_code,
    module: identity.module_number
  });
  if (!out?.ok) throw new Error(out?.error || "Source quiz lokal tidak dapat dibaca.");
  return {
    ...identity,
    available: out.available === true,
    reason: String(out.reason || ""),
    content_hash: String(out.contentHash || "").toLowerCase(),
    char_count: Number(out.charCount || 0),
    page_count: Number(out.pageCount || 0) || null,
    quality: out.quality && typeof out.quality === "object" ? out.quality : null,
    ...(includeText ? {sanitized_text: String(out.sanitizedText || "")} : {})
  };
}

async function quizLocalStatus(code, moduleNo) {
  await requireAccess();
  const source = await localQuizSourceInfo(code, moduleNo);
  return {
    ok: true,
    sourceAvailable: source.available,
    sourceReason: source.reason,
    contentHash: source.content_hash,
    charCount: source.char_count,
    pageCount: source.page_count,
    quality: source.quality,
    requiresRedownload: !source.available || source.quality?.level === "invalid"
  };
}

function quizRetryHint(retryAfter) {
  const remaining = Math.max(0, Number(retryAfter || 0) - Date.now());
  if (remaining <= 0) return "sebentar";
  const seconds = Math.ceil(remaining / 1000);
  if (seconds < 60) return "sekitar " + seconds + " detik";
  return "sekitar " + Math.ceil(seconds / 60) + " menit";
}

function quizLifecycleMessage(phase, code, moduleNo, extra = {}) {
  if (phase === "checking_bank") return `Memeriksa bank soal M${moduleNo}...`;
  if (phase === "generating_bank") {
    return `Bank soal M${moduleNo} belum tersedia. Sedang menyiapkan bank soal dari materi modul. Biasanya selesai dalam 1–2 menit, tetapi pada kondisi tertentu dapat memakan waktu hingga sekitar 10 menit.`;
  }
  if (phase === "starting_round") return `✓ Bank soal M${moduleNo} siap. Membuka Quiz di Telegram...`;
  if (phase === "queued") {
    return extra.alreadyQueued
      ? `Quiz ${code} M${moduleNo} sudah menunggu di antrian #${extra.queuePosition || 1}.`
      : `Quiz ${code} M${moduleNo} masuk antrian #${extra.queuePosition || 1}. Menunggu slot Quiz kosong.`;
  }
  if (phase === "active") return "Quiz modul ini sudah sedang berjalan. Ronde yang aktif dibuka di Telegram.";
  if (phase === "started") {
    return extra.bankCreated
      ? "✓ Quiz siap. Soal baru dibuat dan ronde dibuka di Telegram."
      : "✓ Quiz siap. Soal yang sudah tersedia dipakai lagi. Ronde dibuka di Telegram.";
  }
  return String(extra.message || "");
}

function quizLifecycleMapKey(code, moduleNo) {
  const identity = normalizeQuizModuleIdentity(code, moduleNo);
  return `${identity.course_code}:M${identity.module_number}`;
}

async function readQuizLifecycleMap() {
  const stored = await chrome.storage.local.get([QUIZ_LIFECYCLES_KEY, QUIZ_LIFECYCLE_KEY]);
  const source = stored[QUIZ_LIFECYCLES_KEY];
  const now = Date.now();
  const map = {};
  if (source && typeof source === "object" && !Array.isArray(source)) {
    for (const [key, lifecycle] of Object.entries(source)) {
      if (
        lifecycle &&
        typeof lifecycle === "object" &&
        Number(lifecycle.schemaVersion || 0) === 1 &&
        Number(lifecycle.expiresAt || 0) > now
      ) {
        map[String(key)] = lifecycle;
      }
    }
  }

  // One-time compatibility path for canary installs that still have the V1
  // single-lifecycle shape. The next write migrates it into the V2 map.
  const legacy = stored[QUIZ_LIFECYCLE_KEY];
  if (
    legacy &&
    typeof legacy === "object" &&
    Number(legacy.schemaVersion || 0) === 1 &&
    Number(legacy.expiresAt || 0) > now
  ) {
    try {
      map[quizLifecycleMapKey(legacy.code, Number(legacy.module))] = legacy;
    } catch {}
  }
  return map;
}

async function setQuizLifecycle(code, moduleNo, phase, extra = {}) {
  const identity = normalizeQuizModuleIdentity(code, moduleNo);
  const now = Date.now();
  const active = QUIZ_LIFECYCLE_ACTIVE_PHASES.has(String(phase || ""));
  const lifecycle = {
    schemaVersion: 1,
    code: identity.course_code,
    module: identity.module_number,
    phase: String(phase || ""),
    active,
    message: quizLifecycleMessage(
      String(phase || ""),
      identity.course_code,
      identity.module_number,
      extra
    ),
    bankCreated: extra.bankCreated === true,
    queued: extra.queued === true,
    alreadyQueued: extra.alreadyQueued === true,
    queuePosition: Number(extra.queuePosition || 0) || null,
    alreadyActive: extra.alreadyActive === true,
    updatedAt: now,
    expiresAt: now + (active ? QUIZ_LIFECYCLE_ACTIVE_TTL_MS : QUIZ_LIFECYCLE_TERMINAL_TTL_MS)
  };

  return await serializeQuizLifecycleMutation(async () => {
    const map = await readQuizLifecycleMap();
    map[quizLifecycleMapKey(identity.course_code, identity.module_number)] = lifecycle;
    await chrome.storage.local.set({[QUIZ_LIFECYCLES_KEY]: map});
    await chrome.storage.local.remove(QUIZ_LIFECYCLE_KEY);
    return lifecycle;
  });
}

async function getQuizLifecycle(code, moduleNo) {
  const identity = normalizeQuizModuleIdentity(code, moduleNo);
  const map = await readQuizLifecycleMap();
  return map[quizLifecycleMapKey(identity.course_code, identity.module_number)] || null;
}

async function failQuizLifecycle(code, moduleNo, error) {
  const message = String(error?.message || error || "Quiz Telegram tidak dapat dimulai.");
  return await setQuizLifecycle(code, moduleNo, "error", {message});
}

function normalizeQuizGenerationCapacity(payload) {
  const raw = payload?.generation_capacity && typeof payload.generation_capacity === "object"
    ? payload.generation_capacity
    : payload;
  const capacity = Math.max(0, Number(raw?.capacity || 0));
  if (!capacity) return null;
  const activeGenerations = Math.max(
    0,
    Math.min(capacity, Number(raw?.active_generations || 0))
  );
  const availableSlots = Math.max(
    0,
    Math.min(capacity, Number(raw?.available_slots ?? (capacity - activeGenerations)))
  );
  const generationEnabled = raw?.generation_enabled !== false;
  return {
    capacity,
    activeGenerations,
    availableSlots,
    slotReady: generationEnabled && availableSlots > 0,
    full: availableSlots <= 0,
    generationEnabled,
    leaseMs: Math.max(0, Number(raw?.lease_ms || 0))
  };
}

function currentQuizDeviceGeneration() {
  if (!quizStartClaim || !quizStartIdentity) return null;
  return {
    active: true,
    code: String(quizStartIdentity.course_code || ""),
    module: Number(quizStartIdentity.module_number || 0)
  };
}

// Item 9 (keputusan Owner 2026-10-11): antrian generate bank soal per
// perangkat. FIFO persisten di storage, dedupe per kode+modul, drain seri
// oleh background begitu semua claim quiz/BMP lepas. Bank yang gagal karena
// masalah sumber lokal dibuang dari antrian; kegagalan transien (server
// sibuk, cooldown, dsb.) menahan kepala antrian dan drain dicoba ulang.
const QUIZ_GENERATE_QUEUE_KEY = "bmpQuizGenerateQueueV1";
const QUIZ_GENERATE_QUEUE_RETRY_KEY = "bmpQuizGenerateQueueRetryAtV1";
const QUIZ_GENERATE_QUEUE_RETRY_DELAY_MS = 60 * 1000;
const QUIZ_GENERATE_QUEUE_RESUME_FLOOR_MS = 1500;
// Retry antrian yang tahan service worker tidur (keputusan Owner 2026-10-24):
// `setTimeout` mati bersama SW, jadi deadline juga dipasang sebagai alarm
// ekstensi. Alarm membangunkan SW dan langsung melanjutkan drain.
const QUIZ_GENERATE_QUEUE_ALARM = "bmp-quiz-generate-queue";
let quizQueueDrainClaim = false;
let quizQueueRetryTimer = null;
let quizQueueWakeChecked = false;
let quizQueueMutation = Promise.resolve();

async function readQuizGenerateQueue() {
  const x = await chrome.storage.local.get(QUIZ_GENERATE_QUEUE_KEY);
  const list = x[QUIZ_GENERATE_QUEUE_KEY];
  return Array.isArray(list) ? list : [];
}

async function writeQuizGenerateQueue(list) {
  await chrome.storage.local.set({[QUIZ_GENERATE_QUEUE_KEY]: Array.isArray(list) ? list : []});
}

// Setiap mutasi antrian = read-modify-write ke storage. Tanpa serialisasi, drain
// yang menghapus kepala dari snapshot lama bisa menimpa entri baru yang masuk
// saat generate berlangsung (bisa menit-an) — entri itu hilang tanpa jejak.
// R2-EXT-A-002.
function serializeQuizQueueMutation(fn) {
  const run = quizQueueMutation.then(fn, fn);
  quizQueueMutation = run.catch(() => {});
  return run;
}

async function updateQuizGenerateQueue(mutator) {
  return await serializeQuizQueueMutation(async () => {
    const current = await readQuizGenerateQueue();
    const next = (await mutator(current)) || current;
    await writeQuizGenerateQueue(next);
    return next;
  });
}

// Hapus berdasarkan identitas, bukan `slice(1)` snapshot lama: entri yang
// ditambahkan selama proses berjalan harus tetap ada di antrian.
async function dropQuizGenerateQueueEntry(code, module) {
  const targetCode = String(code || "").toUpperCase();
  const targetModule = Number(module);
  return await updateQuizGenerateQueue(list => list.filter(item =>
    !(String(item?.code || "").toUpperCase() === targetCode && Number(item?.module) === targetModule)));
}

// Gagal permanen = sumber lokal bermasalah/akses ditolak; menunggu tidak
// akan mengubah hasil. Transien = sisi server; boleh dicoba ulang nanti.
function isFatalQuizGenerateError(message) {
  const m = String(message || "");
  return (
    m.includes("belum tersedia atau tidak lolos pemeriksaan") ||
    m.includes("terdeteksi tidak lengkap") ||
    m.includes("terlalu sedikit") ||
    m.includes("Hanya 1 halaman yang terbaca") ||
    m.includes("sedang dinonaktifkan") ||
    m.includes("quiz_source_hash_mismatch") ||
    m.includes("belum mendapat akses uji coba") ||
    m.includes("belum diaktifkan oleh pengelola")
  );
}

// Timer retry in-memory mati bersama service worker. Karena itu deadline retry
// ikut dipersist DAN dipasang sebagai alarm ekstensi (permission `alarms`,
// keputusan Owner 2026-10-24): alarm membangunkan SW walau browser sudah
// menidurkannya, lalu drain dilanjutkan (R2-EXT-A-003).
function scheduleQuizGenerateQueueRetry(delayMs) {
  clearTimeout(quizQueueRetryTimer);
  const wait = Math.max(1000, Number(delayMs) || QUIZ_GENERATE_QUEUE_RETRY_DELAY_MS);
  quizQueueRetryTimer = setTimeout(() => { drainQuizGenerateQueue().catch(() => {}); }, wait);
  try {
    const when = Date.now() + wait;
    Promise.resolve(chrome.alarms?.create?.(QUIZ_GENERATE_QUEUE_ALARM, {when}))
      .catch(() => {});
  } catch (_) { /* tanpa permission alarms, jatuh ke jalur resume saat SW bangun */ }
}

async function clearQuizGenerateQueueRetry() {
  clearTimeout(quizQueueRetryTimer);
  quizQueueRetryTimer = null;
  try {
    Promise.resolve(chrome.alarms?.clear?.(QUIZ_GENERATE_QUEUE_ALARM)).catch(() => {});
  } catch (_) { /* alarm mungkin tidak ada; abaikan */ }
  await chrome.storage.local.remove(QUIZ_GENERATE_QUEUE_RETRY_KEY).catch(() => {});
}

async function quizGenerateQueueRetryAt() {
  const stored = await chrome.storage.local.get(QUIZ_GENERATE_QUEUE_RETRY_KEY);
  const at = Number(stored[QUIZ_GENERATE_QUEUE_RETRY_KEY] || 0);
  return Number.isFinite(at) && at > 0 ? at : 0;
}

// Dipanggil saat SW bangun (onStartup) dan sekali pada pesan pertama setelah SW
// hidup kembali: kalau antrian masih terisi, jadwalkan drain sesuai backoff
// yang tersimpan supaya antrian tidak menggantung sampai browser di-restart.
async function resumeQuizGenerateQueue() {
  const queue = await readQuizGenerateQueue();
  if (!queue.length) {
    await clearQuizGenerateQueueRetry();
    return;
  }
  const retryAt = await quizGenerateQueueRetryAt();
  const wait = Math.max(QUIZ_GENERATE_QUEUE_RESUME_FLOOR_MS, retryAt - Date.now());
  scheduleQuizGenerateQueueRetry(wait);
}

async function resumeQuizGenerateQueueOnWake() {
  if (quizQueueWakeChecked) return;
  quizQueueWakeChecked = true;
  try {
    await resumeQuizGenerateQueue();
  } catch (_) {
    quizQueueWakeChecked = false;
  }
}

async function drainQuizGenerateQueue() {
  if (quizQueueDrainClaim) return;
  quizQueueDrainClaim = true;
  try {
    for (;;) {
      const state = await getState();
      if (state.running || startJobClaimRunId || offscreenMaintenanceClaim ||
          quizStartClaim || quizReadyStartClaim) return;
      const queue = await readQuizGenerateQueue();
      if (!queue.length) { await clearQuizGenerateQueueRetry(); return; }
      const head = queue[0];
      let identity = null;
      try {
        identity = normalizeQuizModuleIdentity(head.code, Number(head.module));
      } catch (_) {
        await dropQuizGenerateQueueEntry(head?.code, head?.module);
        continue;
      }
      const claimId = "quiz-generate-queue:" + crypto.randomUUID();
      quizStartClaim = claimId;
      quizStartIdentity = identity;
      try {
        await startTelegramQuiz(identity.course_code, identity.module_number);
        await dropQuizGenerateQueueEntry(identity.course_code, identity.module_number);
      } catch (error) {
        await failQuizLifecycle(identity.course_code, identity.module_number, error).catch(() => {});
        if (isFatalQuizGenerateError(error?.message || error)) {
          await dropQuizGenerateQueueEntry(identity.course_code, identity.module_number);
          continue;
        }
        const retryAt = Date.now() + QUIZ_GENERATE_QUEUE_RETRY_DELAY_MS;
        await chrome.storage.local.set({[QUIZ_GENERATE_QUEUE_RETRY_KEY]: retryAt}).catch(() => {});
        scheduleQuizGenerateQueueRetry(QUIZ_GENERATE_QUEUE_RETRY_DELAY_MS);
        return;
      } finally {
        if (quizStartClaim === claimId) {
          quizStartClaim = "";
          quizStartIdentity = null;
        }
      }
    }
  } finally {
    quizQueueDrainClaim = false;
  }
}

async function quizGenerationStatus() {
  await requireAccess();
  await requireSupportedVersion();
  const status = await quizApi("/v1/quiz/generation/status", {});
  if (!status?.ok) {
    return {ok: false, error: String(status?.error || "Status slot Quiz tidak dapat dibaca.")};
  }
  return {
    ok: true,
    generationCapacity: normalizeQuizGenerationCapacity(status),
    deviceGeneration: currentQuizDeviceGeneration()
  };
}

async function quizBankStatus(code, moduleNo) {
  await requireAccess();
  await requireSupportedVersion();
  const identity = normalizeQuizModuleIdentity(code, moduleNo);
  const lookup = await quizApi("/v1/quiz/bank/lookup", identity);
  if (lookup?.error && lookup?.status !== "ready" && lookup?.generation_available !== true) {
    return {ok: false, error: String(lookup.error)};
  }
  return {
    ok: true,
    ready: lookup?.status === "ready" && Boolean(lookup?.bank),
    generationAvailable: lookup?.generation_available === true,
    status: String(lookup?.status || ""),
    generationCapacity: normalizeQuizGenerationCapacity(lookup),
    deviceGeneration: currentQuizDeviceGeneration()
  };
}

async function startTelegramQuiz(code, moduleNo) {
  await requireAccess();
  await requireSupportedVersion();

  const identity = normalizeQuizModuleIdentity(code, moduleNo);
  await setQuizLifecycle(identity.course_code, identity.module_number, "checking_bank");

  // Privacy + AI-budget invariant: reusable bank lookup needs only
  // course/module metadata. Local OCR source is opened only after a true miss.
  let lookup = await quizApi("/v1/quiz/bank/lookup", identity);
  if (lookup?.status !== "ready") {
    if (lookup?.generation_available !== true) {
      throw new Error("Bank soal belum tersedia dan pembuatan bank baru sedang dinonaktifkan.");
    }

    const source = await localQuizSourceInfo(
      identity.course_code,
      identity.module_number,
      {includeText: true}
    );
    if (
      !source.available ||
      !/^[0-9a-f]{64}$/.test(source.content_hash) ||
      source.sanitized_text.length > 48000
    ) {
      throw new Error(
        `Source quiz lokal untuk M${identity.module_number} belum tersedia atau tidak lolos pemeriksaan privasi/ukuran. Download ulang modul ini sekali untuk membuat source lokal yang disanitasi.`
      );
    }
    if (source.quality?.level === "invalid") {
      const pages = Number(source.page_count || source.quality?.pageCount || 0);
      throw new Error(
        pages === 1
          ? "Hanya 1 halaman yang terbaca. Coba unduh ulang modul."
          : `Materi M${identity.module_number} terdeteksi tidak lengkap. Download ulang modul ini lalu periksa hasilnya sebelum membuat Quiz.`
      );
    }
    if (source.sanitized_text.length < 800) {
      throw new Error(
        `Materi M${identity.module_number} yang terbaca terlalu sedikit. Download ulang modul ini sebelum membuat Quiz.`
      );
    }

    await setQuizLifecycle(identity.course_code, identity.module_number, "generating_bank");
    const generated = await quizApi("/v1/quiz/bank/generate", {
      ...identity,
      content_hash: source.content_hash,
      sanitized_text: source.sanitized_text
    });
    if (generated?.status !== "ready" || !generated?.bank) {
      const reason = String(generated?.status || generated?.error || "quiz_generation_failed");
      const resourceMessage = String(generated?.resource?.message || "").trim();
      const retryHint = quizRetryHint(generated?.retry_after);
      throw new Error(
        resourceMessage ||
        (reason === "generation_in_progress"
          ? `Quiz M${identity.module_number} sedang dibuat. Tunggu sebentar lalu coba lagi.`
          : reason === "retry_cooldown"
            ? "Pembuatan bank sedang dijeda setelah gangguan sementara. Coba lagi " + retryHint + "."
            : reason === "invalid_ai_output"
              ? "Hasil pembuatan soal belum valid. Sistem sudah menandainya untuk dicoba ulang; coba lagi " + retryHint + "."
              : reason === "d1_persistence_failure"
                ? "Bank soal belum bisa disimpan karena server sedang bermasalah. Coba lagi " + retryHint + "."
                : reason === "provider_rate_limit" || reason === "provider_capacity" || reason === "provider_timeout_network"
                  ? "Server pembuat soal sedang sibuk. Coba lagi " + retryHint + "."
                  : "Bank Quiz belum siap.")
      );
    }
    lookup = generated;
  }

  await setQuizLifecycle(identity.course_code, identity.module_number, "starting_round");
  const started = await quizApi("/v1/quiz/start", identity);
  if (!started?.ok) {
    throw new Error(started?.error || "Quiz Telegram tidak dapat dimulai.");
  }

  const topicUrl = safeTelegramUrl(started.topic_url);
  const targetUrl = topicUrl || CFG.TELEGRAM_GROUP_URL;
  await chrome.tabs.create({url: targetUrl});
  const result = {
    ok: true,
    bankCreated: lookup?.created === true,
    queued: started.queued === true,
    alreadyQueued: started.already_queued === true,
    queuePosition: Number(started.queue_position || 0) || null,
    alreadyActive: started.already_active === true,
    roundId: String(started.round_id || ""),
    topicUrl: targetUrl
  };
  const terminalPhase = result.queued
    ? "queued"
    : result.alreadyActive
      ? "active"
      : "started";
  await setQuizLifecycle(identity.course_code, identity.module_number, terminalPhase, result);
  return result;
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
      `/v1/extension-state?extension_version=${encodeURIComponent(currentVersion)}&distribution_channel=${encodeURIComponent(channel)}&capabilities=${encodeURIComponent("ads_split_v2,clickable_ad_media_v1")}`,
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
  revision,
  clickTarget = ""
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
  const actorId = TELEMETRY?.ensureAnalyticsId
    ? await TELEMETRY.ensureAnalyticsId()
    : "";
  try {
    return await api("/v1/ad-event", {
      method: "POST",
      body: JSON.stringify({
        actor_id: actorId,
        event_type: type,
        placement: place,
        campaign_id: id,
        revision: Math.max(0, Math.floor(Number(revision) || 0)),
        ...(type === "click" && ["media", "cta"].includes(String(clickTarget || "").toLowerCase())
          ? {click_target: String(clickTarget).toLowerCase()}
          : {}),
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

async function reportTelemetryEvent(event, dimensions = {}) {
  if (!TELEMETRY?.emit) return {ok: false, error: "telemetry_unavailable"};
  return await TELEMETRY.emit(CFG, event, dimensions);
}

// Judul materi: katalog resmi UT (WordPress REST publik, read-only, tanpa
// kredensial). Origin sumber diizinkan di CSP connect-src (keputusan Owner
// 2026-10-17); hasil di-cache permanen di bmpCacheMeta[code].title sehingga
// katalog hanya ditanya sekali per kode. Gagal = judul kosong, UI tetap jalan.
const MATERIAL_TITLE_TIMEOUT_MS = 8000;

async function fetchMaterialTitle(code) {
  // ok=true berarti katalog menjawab dengan benar (walau kode tidak ketemu) —
  // hasilnya (termasuk "") boleh di-cache. ok=false = kegagalan jaringan/HTTP,
  // jangan di-cache supaya percobaan berikutnya bisa berhasil.
  const url = `${SOURCE_ROOT}/lib/wp-json/wp/v2/posts?search=${encodeURIComponent(code)}&per_page=5`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MATERIAL_TITLE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {method: "GET", signal: controller.signal, credentials: "omit", cache: "no-store"});
    if (!res.ok) return {ok: false, title: ""};
    const posts = await res.json().catch(() => []);
    return {ok: true, title: BMP_CATALOG_TITLE.pickCatalogTitle(code, posts)};
  } catch {
    return {ok: false, title: ""};
  } finally {
    clearTimeout(timer);
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
    await chrome.tabs.create({url: chrome.runtime.getURL("bantuan.html")});
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

// Hardening jalur aktivasi (laporan Edge Canary Android 2026-10-20): tanpa
// batas waktu, fetch pairing/versi bisa hang tanpa batas dan tombol
// "Verifikasi di Telegram" terlihat diam total. Abort diubah menjadi satu
// pesan manusiawi yang bisa ditampilkan popup.
const ACTIVATION_FETCH_TIMEOUT_MS = 20_000;
async function withActivationTimeout(run, timeoutMs = ACTIVATION_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Layanan aktivasi tidak merespons. Periksa koneksi lalu coba lagi.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchVersionPolicy(currentVersion, channel) {
  if (!configReady()) throw new Error("Konfigurasi aktivasi belum lengkap.");
  const path = `/v1/version?extension_version=${encodeURIComponent(currentVersion)}&distribution_channel=${encodeURIComponent(channel)}`;
  const url = `${String(CFG.API_BASE_URL).replace(/\/$/, "")}${path}`;
  return await withActivationTimeout(async (signal) => {
    const res = await fetch(url, {
      method: "GET",
      headers: {"Content-Type": "application/json"},
      signal
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Version API malformed response (HTTP ${res.status})`);
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`Version API malformed response (HTTP ${res.status})`);
    }

    // HTTP 426 is an authoritative version-policy response, not a transport
    // failure. It must reach applyVersionDecision() so the mandatory state can
    // be persisted before critical work starts.
    if (res.status !== 200 && res.status !== 426) {
      const error = new Error(data.error || `Community API HTTP ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return {status: res.status, data};
  });
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
    const response = await fetchVersionPolicy(currentVersion, channel);
    const data = response.data;
    const policy = applyVersionDecision({
      channel,
      httpStatus: response.status,
      code: String(data.code || ""),
      serverUpdateRequired: data.update_required === true,
      storeReady: data.store_ready === true,
      latestVersion: String(data.latest_version || currentVersion),
      minimumVersion: String(data.minimum_version || ""),
      forceAfter: data.force_after || null,
      releaseUrl: safeHttpsUrl(data.release_url),
      message: String(data.message || ""),
      lastAttemptAt: now,
      lastSuccessAt: now,
      error: ""
    }, currentVersion, now);
    await chrome.storage.local.set({bmpVersionPolicy: policy});
    return policy;
  } catch (e) {
    // Transport/backend/malformed failures keep the last authoritative policy.
    // In particular, never unlock an already-mandatory cached state merely
    // because the next refresh could not reach the server.
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
  const policy = await versionStatus({force: true});
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
  const stored = await chrome.storage.local.get("bmpCommunityToken");
  const currentToken = typeof stored.bmpCommunityToken === "string"
    ? stored.bmpCommunityToken
    : "";
  const data = await api("/v1/pair/start", {
    timeoutMs: ACTIVATION_FETCH_TIMEOUT_MS,
    method: "POST",
    body: JSON.stringify({
      install_id: installId,
      extension_version: version,
      distribution_channel: distributionChannel(),
      ...(currentToken ? {current_token: currentToken} : {})
    })
  });
  const deepLink = safeTelegramUrl(data.deep_link);
  if (!deepLink) {
    throw new Error("Tautan verifikasi Telegram dari server tidak valid.");
  }
  const pending = {
    pairId: data.pair_id,
    pollSecret: data.poll_secret,
    expiresAt: data.expires_at,
    deepLink,
    startedAt: Date.now(),
    lastCheckedAt: 0
  };
  await chrome.storage.local.set({bmpPendingPair: pending});
  try {
    await chrome.tabs.create({url: deepLink});
  } catch {
    // Contoh: Edge Android bisa menolak membuka tab baru dari konteks
    // tertentu. Sesi pairing tetap tersimpan; popup menyediakan kode
    // aktivasi + tombol "Buka Telegram" sehingga verifikasi tidak buntu.
  }
  return pending;
}

async function checkPairing() {
  const x = await chrome.storage.local.get([
    "bmpPendingPair",
    "bmpCommunityToken"
  ]);
  const p = x.bmpPendingPair;
  if (!p) return {status: "none"};

  if (Date.now() > Number(p.expiresAt || 0)) {
    await chrome.storage.local.remove("bmpPendingPair");
    return {status: "expired"};
  }

  const data = await api(`/v1/pair/status?pair_id=${encodeURIComponent(p.pairId)}`, {
    timeoutMs: ACTIVATION_FETCH_TIMEOUT_MS,
    method: "GET",
    headers: {Authorization: `Pair ${p.pollSecret}`}
  });

  p.lastCheckedAt = Date.now();
  await chrome.storage.local.set({bmpPendingPair: p});

  if (data.status === "verified" && data.token) {
    const verified = await verifyCommunityToken(data.token);
    if (!verified.ok) throw new Error("Token aktivasi dari server tidak valid.");

    const current = await verifyCommunityToken(x.bmpCommunityToken);
    const currentExpiry = current.ok ? Number(current.payload?.exp || 0) * 1000 : 0;
    const nextExpiry = Number(verified.payload?.exp || 0) * 1000;
    if (currentExpiry > Date.now() && nextExpiry + 1000 < currentExpiry) {
      throw new Error(
        "Token verifikasi baru memperpendek aktivasi aktif. Token lama tetap dipakai."
      );
    }

    await chrome.storage.local.set({bmpCommunityToken: data.token});
    await chrome.storage.local.remove("bmpPendingPair");
    return {status: "verified", expiresAt: nextExpiry};
  }

  return {status: data.status || "pending"};
}

async function refreshActivation({force = false} = {}) {
  if (force) await requireSupportedVersion();
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
  const lastSuccessAt = Number(meta.lastSuccessAt || 0);
  const lastError = String(meta.lastError || "");
  const supporterStillActive = Boolean(
    verified.payload?.supporter_active === true &&
    Number(verified.payload?.supporter_until || 0) * 1000 > now
  );
  const successIntervalMs = supporterStillActive
    ? ACTIVATION_REFRESH_INTERVAL_MS
    : ACTIVATION_REFRESH_NO_SUPPORTER_INTERVAL_MS;
  const retryAfterMs = lastError
    ? ACTIVATION_REFRESH_FAILURE_BACKOFF_MS
    : successIntervalMs;
  const throttleAnchor = lastError
    ? lastAttemptAt
    : (lastSuccessAt || lastAttemptAt);
  if (
    !force &&
    throttleAnchor > 0 &&
    now - throttleAnchor < retryAfterMs
  ) {
    return {
      status: "throttled",
      expiresAt: Number(verified.payload.exp) * 1000,
      nextAt: throttleAnchor + retryAfterMs
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
      timeoutMs: ACTIVATION_FETCH_TIMEOUT_MS,
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

// Chrome <116 tanpa getContexts: dokumen offscreen yang sudah hidup tidak selalu
// terlihat oleh fallback clients.matchAll, jadi createDocument gagal dengan
// "Only a single offscreen document may be created.". Error itu berarti
// dokumennya memang sudah ada (R2-EXT-A-001).
function isDuplicateOffscreenError(error) {
  const message = String(error?.message || error || "");
  return /single offscreen document|offscreen document.*already|already exists/i.test(message);
}

async function offscreenDocumentExists(url) {
  if (typeof chrome.runtime.getContexts === "function") {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [url]
    });
    return contexts.length > 0;
  }

  if (self.clients && typeof self.clients.matchAll === "function") {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });
    return clients.some(client => client.url === url);
  }
  return false;
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  if (await offscreenDocumentExists(url)) return;

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
  } catch (error) {
    // Chrome tanpa getContexts (<116): dokumen offscreen yang sudah hidup tidak
    // selalu terlihat oleh fallback, sehingga createDocument gagal dengan
    // "Only a single offscreen document may be created.". Itu justru bukti
    // dokumennya ada -> aman dilanjutkan, bukan menggagalkan job.
    if (!isDuplicateOffscreenError(error)) throw error;
  } finally {
    creatingOffscreen = null;
  }
}

async function askOffscreen(message) {
  await ensureOffscreen();
  return await chrome.runtime.sendMessage({...message, target: "offscreen"});
}

async function saveBlobUrl(blobUrl, filename) {
  const revoke = () => chrome.runtime.sendMessage({
    target: "offscreen",
    type: "REVOKE_BLOB_URL",
    blobUrl
  }).catch(() => {});

  try {
    const id = await chrome.downloads.download({
      url: blobUrl,
      filename,
      conflictAction: "overwrite",
      saveAs: false
    });

    let settled = false;
    let fallbackTimer = null;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      chrome.downloads.onChanged.removeListener(onChanged);
      revoke();
    };
    const onChanged = delta => {
      if (Number(delta?.id) !== Number(id)) return;
      const state = String(delta?.state?.current || "");
      if (state === "complete" || state === "interrupted") cleanup();
    };

    chrome.downloads.onChanged.addListener(onChanged);
    // Browser download completion is the primary lifetime signal. The long
    // fallback prevents a leaked object URL if the completion event is lost,
    // without prematurely revoking a large/slow PDF.
    fallbackTimer = setTimeout(cleanup, 5 * 60 * 1000);

    // Handle the small race where the download completed before the listener
    // was installed.
    try {
      const [item] = await chrome.downloads.search({id});
      if (["complete", "interrupted"].includes(String(item?.state || ""))) {
        cleanup();
      }
    } catch (_) {}

    return id;
  } catch (error) {
    revoke();
    throw error;
  }
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
  if (!state.running || !state.runId) return;
  const runId = String(state.runId);
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "START_MODULE",
      runId: state.runId,
      code: state.code,
      module: state.currentModule,
      delayMs: state.delayMs,
      maxPages: state.maxPages
    });
  } catch (e) {
    const nextAttempt = attempt + 1;
    if (nextAttempt > 20) {
      const latest = await getState();
      if (latest.running && String(latest.runId || "") === runId) {
        await setStateForRun(runId, {
          running: false,
          runId: "",
          status: "ERROR",
          progress:
            "Halaman modul terbuka, tetapi komponen pemrosesan belum siap. " +
            "Tutup-buka halaman reader lalu coba lagi.",
          ocrProgress: ""
        });
        cancelledRunIds.add(runId);
      }
      return;
    }
    const latest = await getState();
    if (!latest.running || String(latest.runId || "") !== runId) return;
    const waiting = await setStateForRun(runId, {
      status: "WAITING_PAGE",
      progress: `Menunggu halaman siap... (${nextAttempt}/20)`
    });
    if (!waiting) return;
    setTimeout(async () => {
      const s = await getState();
      if (
        s.running &&
        s.tabId === tabId &&
        String(s.runId || "") === runId
      ) {
        startModule(tabId, s, nextAttempt).catch(() => {});
      }
    }, 1500);
  }
}

async function navigateCurrentModule(expectedRunId = "") {
  const state = await getState();
  if (!state.running || !state.tabId) return;
  if (
    expectedRunId &&
    String(state.runId || "") !== String(expectedRunId)
  ) return;
  const opening = await setStateForRun(state.runId, {
    status: `OPENING_M${state.currentModule}`,
    progress: `Membuka Modul ${state.currentModule}...`,
    ocrProgress: ""
  });
  if (!opening) return;
  await requireActiveRun(state.runId);
  await chrome.tabs.update(state.tabId, {
    url: viewerUrl(state.code, state.currentModule)
  });
  // Batch 25: navigasi modul baru = baseline diam baru. Bila tab reader tidak
  // melaporkan apa pun selama JOB_SILENCE_MS (khas content script stale),
  // checkJobSilence memuat ulang tab sekali / menggagalkan run dengan jelas.
  armJobSilenceWatchdog(state.runId);

  // Edge Android does not always deliver tabs.onUpdated reliably
  // for extension-driven navigation. Kick off the content-script handoff
  // directly as well; startModule() will retry until the page is ready.
  setTimeout(async () => {
    const s = await getState();
    if (
      s.running &&
      s.tabId === state.tabId &&
      s.currentModule === state.currentModule &&
      String(s.runId || "") === String(state.runId || "")
    ) {
      startModule(state.tabId, s, 0).catch(async e => {
        const latest = await getState();
        if (
          latest.running &&
          String(latest.runId || "") === String(state.runId || "")
        ) {
          const id = String(state.runId || "");
          await setStateForRun(id, {
            running: false,
            runId: "",
            status: "ERROR",
            progress: String(e),
            ocrProgress: ""
          });
          cancelledRunIds.add(id);
        }
      });
    }
  }, 1200);
}

async function finishModule(state, mod, pages) {
  const out = await askOffscreen({
    type: "OCR_FINISH_MODULE",
    runId: state.runId,
    code: state.code,
    module: mod,
    pages
  });
  if (!out?.ok) throw new Error(out?.error || "Gagal menyusun PDF.");
  if (!(await activeRunState(state.runId))) {
    chrome.runtime.sendMessage({
      target: "offscreen",
      type: "REVOKE_BLOB_URL",
      blobUrl: out.blobUrl
    }).catch(() => {});
    throw new Error("Proses berubah sebelum PDF modul diekspor.");
  }
  await saveBlobUrl(
    out.blobUrl,
    `BMP Terbuka/${state.code}/${state.code}_M${mod}_Searchable.pdf`
  );
  await requireActiveRun(state.runId);
  invalidateCacheInfo(state.code);
}

async function buildMergedPdf(state, firstModule, lastModule, {full = false} = {}) {
  const out = await askOffscreen({
    type: firstModule === 1 ? "OCR_BUILD_FULL" : "OCR_BUILD_RANGE",
    code: state.code,
    firstModule,
    lastModule
  });
  if (!out?.ok) throw new Error(out?.error || "Gagal membuat PDF gabungan.");
  if (state.runId && !(await activeRunState(state.runId))) {
    chrome.runtime.sendMessage({
      target: "offscreen",
      type: "REVOKE_BLOB_URL",
      blobUrl: out.blobUrl
    }).catch(() => {});
    throw new Error("Proses berubah sebelum PDF gabungan diekspor.");
  }
  const filename = full
    ? `${state.code}_FULL_Searchable.pdf`
    : `${state.code}_M${firstModule}-M${lastModule}_Searchable.pdf`;
  await saveBlobUrl(
    out.blobUrl,
    `BMP Terbuka/${state.code}/${filename}`
  );
  if (state.runId) await requireActiveRun(state.runId);
  return filename;
}

function invalidateCacheInfo(code) {
  cacheInfoMemo.invalidate(String(code || "").trim().toUpperCase());
}

async function cacheInfo(code, {force = false} = {}) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return {modules: [], bytes: 0, totalBytes: 0, detectedLastModule: null};
  const raw = await cacheInfoMemo.get(
    normalized,
    async () => {
      const out = await askOffscreen({type: "OCR_CACHE_INFO", code: normalized});
      if (!out?.ok) throw new Error(out?.error || "Penyimpanan lokal tidak dapat dibaca.");
      return {
        modules: normalizeModules(out.modules || [], 99),
        bytes: Number(out.bytes || 0),
        totalBytes: Number(out.totalBytes || 0)
      };
    },
    {force}
  );
  const meta = await getCodeMeta(normalized);
  return {
    ...raw,
    detectedLastModule: recentDetectedLastModule(meta)
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
  // Keep the second parameter for call-site compatibility, but never use
  // historical terminal evidence as an absolute ceiling on explicit intent.
  void detectedLastModule;
  return maxModule;
}

function mergeTarget(
  state,
  detectedLastModule = null,
  {freshTerminal = false} = {}
) {
  const first = Number(state.startModule);
  const requestedLast = Number(state.maxModule);
  const actualLast = freshTerminal &&
    Number.isInteger(detectedLastModule) &&
    detectedLastModule >= 1
      ? detectedLastModule
      : null;
  const last = actualLast ? Math.min(requestedLast, actualLast) : requestedLast;
  if (!Number.isInteger(first) || !Number.isInteger(last) || last < first) return null;
  const full = Boolean(actualLast && first === 1 && requestedLast >= actualLast);
  return {first, last, full};
}

function formatModuleList(modules) {
  return normalizeModules(modules, 99).map(m => `M${m}`).join(", ") || "-";
}

async function maybeBuildRequestedMerge(
  state,
  detectedLastModule = null,
  options = {}
) {
  if (!state.mergeRequested) return {made: false, message: ""};
  const target = mergeTarget(state, detectedLastModule, options);
  if (!target) return {made: false, message: "PDF gabungan tidak dibuat karena rentang yang dipilih tidak tersedia."};
  const missing = missingModulesInRange(target.first, target.last, state.completedModules || []);
  if (missing.length) {
    return {
      made: false,
      message: `PDF gabungan tidak dibuat karena ${missing.map(m => `Modul ${m}`).join(", ")} belum tersedia.`
    };
  }

  if (state.runId) {
    const merging = await setStateForRun(state.runId, {
      status: "BUILDING_MERGE",
      progress: target.full
        ? `Menggabungkan Modul 1–${target.last}...`
        : `Menggabungkan Modul ${target.first}–${target.last}...`,
      ocrProgress: ""
    });
    if (!merging) throw new Error("Proses berubah sebelum PDF gabungan dibuat.");
  }
  const filename = await buildMergedPdf(state, target.first, target.last, {full: target.full});
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

async function recoverStaleRunningState({forceInterrupt = false} = {}) {
  const state = await getState();
  if (!state.running) return state;

  const interrupt = async () => await setState({
    running: false,
    runId: "",
    tabId: null,
    status: "INTERRUPTED",
    progress: "Proses sebelumnya terputus. Modul yang sudah selesai tetap tersimpan lokal.",
    ocrProgress: ""
  });

  // A browser/service-worker startup cannot prove that the old content/offscreen
  // generation is still alive. Never resurrect a persisted running flag merely
  // because the reader tab itself survived the restart.
  if (forceInterrupt) return await interrupt();

  // Cache-only merge jobs intentionally have no reader tab. If this service
  // worker still owns the START_JOB claim, the local merge is alive and popup
  // polling must not mark it interrupted just because tabId is null.
  if (
    startJobClaimRunId &&
    String(startJobClaimRunId) === String(state.runId || "")
  ) {
    return state;
  }

  const tabId = Number(state.tabId);
  if (!Number.isInteger(tabId) || tabId <= 0) return await interrupt();

  try {
    await chrome.tabs.get(tabId);
    return state;
  } catch {
    return await interrupt();
  }
}

function finalSummary(state, mergeMessage = "") {
  const lines = [
    `Diproses: ${formatModuleList(state.processedModules || [])}`,
    `Dilewati: ${formatModuleList(state.skippedModules || [])}`
  ];
  if (mergeMessage) lines.push(mergeMessage);
  return lines.join("\n");
}

chrome.runtime.onInstalled.addListener(async details => {
  const x = await chrome.storage.local.get("bmpState");
  if (!x.bmpState) {
    await chrome.storage.local.set({bmpState: DEFAULT_STATE});
  } else if (details?.reason === "update" && x.bmpState?.running) {
    await setState({
      running: false,
      runId: "",
      tabId: null,
      status: "INTERRUPTED",
      progress: "Update extension menghentikan proses sebelumnya. Modul yang sudah selesai tetap tersimpan lokal.",
      ocrProgress: ""
    });
  }
  await getInstallId();
  await TELEMETRY?.ensureAnalyticsId?.();
});

chrome.runtime.onStartup.addListener(() => {
  recoverStaleRunningState({forceInterrupt: true}).catch(() => {});
  // SW hidup kembali -> lanjutkan antrian generate yang tertunda di storage,
  // menghormati backoff yang tersimpan (R2-EXT-A-003).
  resumeQuizGenerateQueueOnWake().catch(() => {});
});

// Alarm retry antrian Quiz (permission `alarms`, keputusan Owner 2026-10-24):
// alarm membangunkan service worker yang sudah tidur, jadi antrian tidak
// menggantung sampai browser di-restart.
chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (!alarm || alarm.name !== QUIZ_GENERATE_QUEUE_ALARM) return;
  drainQuizGenerateQueue().catch(() => {});
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  const state = await getState();
  if (!state.running || state.tabId !== tabId || !state.runId) return;
  if (!tab.url || !tab.url.startsWith(`${SOURCE_ROOT}/reader/`)) return;

  const expectedRunId = String(state.runId);
  const expectedModule = Number(state.currentModule);
  setTimeout(async () => {
    const s = await getState();
    if (
      s.running &&
      s.tabId === tabId &&
      String(s.runId || "") === expectedRunId &&
      Number(s.currentModule) === expectedModule
    ) {
      startModule(tabId, s).catch(async e => {
        const latest = await getState();
        if (
          latest.running &&
          String(latest.runId || "") === String(s.runId || "")
        ) {
          const id = String(s.runId || "");
          await setStateForRun(id, {
            running: false,
            runId: "",
            status: "ERROR",
            progress: String(e),
            ocrProgress: ""
          });
          cancelledRunIds.add(id);
        }
      });
    }
  }, 900);
});

function handleRuntimeMessage(msg, sender, sendResponse) {
  let requestRunId = "";
  (async () => {
    // SW yang baru bangun kehilangan timer retry: periksa sekali per masa hidup
    // SW, lalu drain dijadwalkan dari storage oleh helper (R2-EXT-A-003).
    void resumeQuizGenerateQueueOnWake();
    if (msg.type === "LOCAL_CACHE_MUTATED") {
      cacheInfoMemo.clear();
      sendResponse({ok:true});
      return;
    }
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
      const deepLink = safeTelegramUrl(p?.deepLink);
      if (!deepLink) throw new Error("Sesi verifikasi tidak tersedia.");
      await chrome.tabs.create({url: deepLink});
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
        revision: msg.revision,
        clickTarget: msg.clickTarget
      }));
      return;
    }
    if (msg.type === "REPORT_TELEMETRY") {
      sendResponse(await reportTelemetryEvent(msg.event, msg.dimensions || {}));
      return;
    }
    if (msg.type === "EXECUTE_CLOUD_ACTION") {
      sendResponse(await executeCloudAction(msg.action));
      return;
    }
    if (msg.type === "OPEN_UPDATE") {
      const policy = await versionStatus();
      const url = safeHttpsUrl(policy?.releaseUrl);
      if (!url && isStoreChannel()) {
        sendResponse({ok: true, managedByStore: true});
        return;
      }
      await chrome.tabs.create({url: url || CFG.TELEGRAM_CHANNEL_URL});
      sendResponse({ok: true, managedByStore: false});
      return;
    }
    if (msg.type === "RUN_REVIEW_SAMPLE") {
      if (startJobClaimRunId || offscreenMaintenanceClaim) {
        sendResponse({ok: false, error: "Operasi OCR lain sedang disiapkan."});
        return;
      }
      const maintenanceId = "review:" + crypto.randomUUID();
      offscreenMaintenanceClaim = maintenanceId;
      try {
        const state = await getState();
        if (state.running) {
          sendResponse({ok: false, error: "Selesaikan atau hentikan proses BMP sebelum menjalankan sampel reviewer."});
          return;
        }
        sendResponse(await runReviewerSample());
        return;
      } finally {
        if (offscreenMaintenanceClaim === maintenanceId) offscreenMaintenanceClaim = "";
      }
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
      const current = await getState();
      const force = Boolean(
        offscreenMaintenanceClaim ||
        (current.running && String(current.code || "").trim().toUpperCase() === code)
      );
      sendResponse({ok: true, ...(await cacheInfo(code, {force}))});
      return;
    }
    if (msg.type === "GET_MATERIAL_TITLE") {
      // Judul BMP dari katalog resmi UT (sekali per kode; cache di bmpCacheMeta).
      // Jawaban {ok:true, title:""} berarti "tidak ada judul" — MyBMP fallback kode.
      const code = String(msg.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
        sendResponse({ok: true, title: ""});
        return;
      }
      const meta = await getCodeMeta(code);
      if (Object.prototype.hasOwnProperty.call(meta, "title")) {
        sendResponse({ok: true, title: String(meta.title)});
        return;
      }
      const lookup = await fetchMaterialTitle(code);
      if (lookup.ok) {
        const map = await getCacheMetaMap();
        map[code] = {...(map[code] || {}), title: lookup.title};
        await chrome.storage.local.set({bmpCacheMeta: map});
      }
      sendResponse({ok: true, title: lookup.title});
      return;
    }
    if (msg.type === "GET_CACHE_SNAPSHOT") {
      const code = String(msg.code || "").trim().toUpperCase();
      const safeCode = /^[A-Z0-9_-]{3,32}$/.test(code) ? code : "";
      const out = await askOffscreen({type: "OCR_CACHE_SNAPSHOT", code: safeCode});
      if (!out?.ok) throw new Error(out?.error || "Penyimpanan lokal tidak dapat dibaca.");
      const meta = safeCode ? await getCodeMeta(safeCode) : null;
      sendResponse({
        ok: true,
        code: safeCode,
        modules: normalizeModules(out.modules || [], 99),
        codeBytes: Number(out.codeBytes || 0),
        totalBytes: Number(out.totalBytes || 0),
        pdfCount: Number(out.pdfCount || 0),
        detectedLastModule: safeCode ? recentDetectedLastModule(meta) : null
      });
      return;
    }
    if (msg.type === "GET_STORAGE_INFO") {
      const out = await askOffscreen({type: "OCR_STORAGE_INFO"});
      if (!out?.ok) throw new Error(out?.error || "Total penyimpanan lokal tidak dapat dibaca.");
      const code = String(msg.code || "").trim().toUpperCase();
      const codeBytes = /^[A-Z0-9_-]{3,32}$/.test(code)
        ? Number(out.bytesByCode?.[code] || 0)
        : 0;
      sendResponse({
        ok: true,
        totalBytes: Number(out.totalBytes || 0),
        pdfCount: Number(out.pdfCount || 0),
        codeBytes
      });
      return;
    }
    if (msg.type === "GET_QUIZ_BANK_STATUS") {
      sendResponse(await quizBankStatus(msg.code, Number(msg.module)));
      return;
    }
    if (msg.type === "GET_QUIZ_GENERATION_STATUS") {
      sendResponse(await quizGenerationStatus());
      return;
    }
    if (msg.type === "GET_QUIZ_LIFECYCLE") {
      sendResponse({
        ok: true,
        lifecycle: await getQuizLifecycle(msg.code, Number(msg.module))
      });
      return;
    }
    if (msg.type === "GET_QUIZ_SOURCE_STATUS") {
      sendResponse(await quizLocalStatus(msg.code, Number(msg.module)));
      return;
    }
    if (msg.type === "START_TELEGRAM_QUIZ") {
      if (startJobClaimRunId || offscreenMaintenanceClaim) {
        sendResponse({ok: false, error: "Operasi lain sedang berjalan."});
        return;
      }

      const identity = normalizeQuizModuleIdentity(msg.code, Number(msg.module));
      const current = await getState();
      if (current.running || startJobClaimRunId || offscreenMaintenanceClaim) {
        throw new Error("Quiz tidak dapat dimulai saat proses BMP atau penyimpanan lokal sedang berjalan.");
      }

      // READY banks do not consume an AI-generation slot. They may open while
      // another module is still being generated on this installation.
      const bankStatus = await quizBankStatus(identity.course_code, identity.module_number);
      if (!bankStatus?.ok) {
        sendResponse({ok: false, error: bankStatus?.error || "Status bank soal tidak dapat diperiksa."});
        return;
      }

      if (bankStatus.ready) {
        if (quizReadyStartClaim) {
          sendResponse({ok: false, error: "Ronde Quiz lain sedang dibuka."});
          return;
        }
        const readyClaimId = "quiz-ready:" + crypto.randomUUID();
        quizReadyStartClaim = readyClaimId;
        try {
          sendResponse(await startTelegramQuiz(identity.course_code, identity.module_number));
          return;
        } catch (error) {
          await failQuizLifecycle(identity.course_code, identity.module_number, error).catch(() => {});
          throw error;
        } finally {
          if (quizReadyStartClaim === readyClaimId) quizReadyStartClaim = "";
          drainQuizGenerateQueue().catch(() => {});
        }
      }

      if (quizReadyStartClaim) {
        sendResponse({ok: false, error: "Ronde Quiz lain sedang dibuka."});
        return;
      }
      if (quizStartClaim) {
        sendResponse({
          ok: false,
          error: "quiz_generation_device_busy",
          activeGeneration: currentQuizDeviceGeneration()
        });
        return;
      }

      const claimId = "quiz-generate:" + crypto.randomUUID();
      quizStartClaim = claimId;
      quizStartIdentity = identity;
      try {
        sendResponse(await startTelegramQuiz(identity.course_code, identity.module_number));
        return;
      } catch (error) {
        await failQuizLifecycle(identity.course_code, identity.module_number, error).catch(() => {});
        throw error;
      } finally {
        if (quizStartClaim === claimId) {
          quizStartClaim = "";
          quizStartIdentity = null;
        }
        drainQuizGenerateQueue().catch(() => {});
      }
    }
    if (msg.type === "ENQUEUE_QUIZ_GENERATE") {
      // Item 9: pintu generate dari MyBMP. Bank siap -> langsung buka ronde
      // (pola claim sama dengan cabang ready START_TELEGRAM_QUIZ); belum siap
      // -> masuk antrian FIFO persisten, drain otomatis oleh background.
      if (startJobClaimRunId || offscreenMaintenanceClaim) {
        sendResponse({ok: false, error: "Operasi lain sedang berjalan."});
        return;
      }
      const identity = normalizeQuizModuleIdentity(msg.code, Number(msg.module));
      const current = await getState();
      if (current.running) {
        throw new Error("Quiz tidak dapat disiapkan saat proses BMP sedang berjalan.");
      }
      const bankStatus = await quizBankStatus(identity.course_code, identity.module_number);
      if (!bankStatus?.ok) {
        sendResponse({ok: false, error: bankStatus?.error || "Status bank soal tidak dapat diperiksa."});
        return;
      }
      if (bankStatus.ready) {
        if (quizReadyStartClaim) {
          sendResponse({ok: false, error: "Ronde Quiz lain sedang dibuka."});
          return;
        }
        const readyClaimId = "quiz-ready:" + crypto.randomUUID();
        quizReadyStartClaim = readyClaimId;
        try {
          sendResponse(await startTelegramQuiz(identity.course_code, identity.module_number));
          return;
        } catch (error) {
          await failQuizLifecycle(identity.course_code, identity.module_number, error).catch(() => {});
          throw error;
        } finally {
          if (quizReadyStartClaim === readyClaimId) quizReadyStartClaim = "";
          drainQuizGenerateQueue().catch(() => {});
        }
      }
      let dupIndex = -1;
      const queue = await updateQuizGenerateQueue(list => {
        dupIndex = list.findIndex(item =>
          String(item?.code || "") === identity.course_code &&
          Number(item?.module) === identity.module_number);
        if (dupIndex === -1) {
          list.push({
            code: identity.course_code,
            module: identity.module_number,
            addedAt: Date.now()
          });
        }
        return list;
      });
      const position = (dupIndex === -1 ? queue.length : dupIndex + 1);
      sendResponse({
        ok: true,
        queued: true,
        alreadyQueued: dupIndex !== -1,
        position,
        queueLength: queue.length,
        activeGeneration: currentQuizDeviceGeneration()
      });
      drainQuizGenerateQueue().catch(() => {});
      return;
    }
    if (msg.type === "GET_QUIZ_GENERATE_QUEUE") {
      sendResponse({
        ok: true,
        queue: await readQuizGenerateQueue(),
        activeGeneration: currentQuizDeviceGeneration()
      });
      return;
    }
    if (msg.type === "OPEN_READER") {
      const code = String(msg.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("Kode BMP tidak valid.");
      const moduleNo = Number(msg.module);
      if (!Number.isInteger(moduleNo) || moduleNo < 1 || moduleNo > 99) throw new Error("Modul tidak valid.");
      await chrome.tabs.create({url: viewerUrl(code, moduleNo)});
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OPEN_READER_AND_RESUME") {
      const busyState = await getState();
      if (busyState.running || await uiLocalOperationBusy()) {
        sendResponse({ok: false, error: "Proses lain masih berjalan."});
        return;
      }
      const code = String(msg.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("Kode BMP tidak valid.");
      const startModule = Number(msg.startModule || 1);
      const maxModule = Number(msg.maxModule || 9);
      if (!Number.isInteger(startModule) || !Number.isInteger(maxModule) ||
          startModule < 1 || maxModule < startModule || maxModule > 99) {
        throw new Error("Rentang modul tidak valid.");
      }
      const nextModule = Math.min(Math.max(Number(msg.nextModule || startModule), startModule), maxModule);
      // The plan lives in storage, so the popup may close before READY arrives.
      await writePendingResume({
        code,
        startModule,
        maxModule,
        redownload: Boolean(msg.redownload),
        mergeRequested: Boolean(msg.mergeRequested)
      });
      const sameCodeTab = (await chrome.tabs.query({url: `${SOURCE_ROOT}/reader/*`}))
        .find(t => {
          try {
            return String(new URL(t.url).searchParams.get("subfolder") || "")
              .trim().replace(/\/+$/, "").toUpperCase() === code;
          } catch (_) {
            return false;
          }
        });
      let tab = null;
      if (sameCodeTab?.id != null) {
        tab = sameCodeTab;
        await chrome.tabs.update(sameCodeTab.id, {active: true}).catch(() => {});
        if (sameCodeTab.windowId != null) {
          await chrome.windows.update(sameCodeTab.windowId, {focused: true}).catch(() => {});
        }
      } else {
        tab = await chrome.tabs.create({url: viewerUrl(code, nextModule)});
      }
      // Re-arm readiness: a new tab injects the content script on load, and
      // an existing tab may have already sent READY before the plan existed.
      if (tab?.id != null) {
        chrome.tabs.sendMessage(tab.id, {type: "BMP_RESET_READY"}).catch(() => {});
      }
      // Batch 25: bila 10 detik kemudian plan masih menggantung (tab tidak
      // pernah melapor READY — khas content script stale), rescue reload
      // memuat ulang tab supaya content script segar terinjeksi.
      schedulePlanRescue(code);
      sendResponse({ok: true});
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
      if (startJobClaimRunId || offscreenMaintenanceClaim) {
        sendResponse({ok: false, error: "Operasi penyimpanan lain sedang berjalan."});
        return;
      }
      const maintenanceId = "clear:" + crypto.randomUUID();
      offscreenMaintenanceClaim = maintenanceId;
      try {
        await requireAccess();
        const code = String(msg.code || "").trim().toUpperCase();
        if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("Kode BMP tidak valid.");
        const current = await getState();
        if (current.running || startJobClaimRunId || await uiLocalOperationBusy()) {
          throw new Error("Penyimpanan lokal tidak bisa dibersihkan saat proses BMP masih berjalan.");
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
      } finally {
        if (offscreenMaintenanceClaim === maintenanceId) offscreenMaintenanceClaim = "";
      }
    }
    if (msg.type === "CLEAR_ALL_CACHE") {
      if (startJobClaimRunId || offscreenMaintenanceClaim) {
        sendResponse({ok: false, error: "Operasi penyimpanan lain sedang berjalan."});
        return;
      }
      const maintenanceId = "clear-all:" + crypto.randomUUID();
      offscreenMaintenanceClaim = maintenanceId;
      try {
        await requireAccess();
        const current = await getState();
        if (current.running || startJobClaimRunId || await uiLocalOperationBusy()) {
          throw new Error("Penyimpanan lokal tidak bisa dibersihkan saat proses BMP masih berjalan.");
        }
        const out = await askOffscreen({type: "OCR_CLEAR_ALL"});
        if (!out?.ok) throw new Error(out?.error || "Penyimpanan lokal tidak dapat dibersihkan.");
        await chrome.storage.local.set({bmpCacheMeta: {}});
        cacheInfoMemo.clear();
        await setState({
          completedModules: [],
          skippedModules: [],
          detectedLastModule: null
        });
        sendResponse({ok: true});
        return;
      } finally {
        if (offscreenMaintenanceClaim === maintenanceId) offscreenMaintenanceClaim = "";
      }
    }
    if (msg.type === "BEGIN_UI_LOCAL_OPERATION") {
      if (sender.tab || sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL("popup.html")) {
        throw new Error("Operasi harus dimulai melalui UI BMP.");
      }
      if (startJobClaimRunId || offscreenMaintenanceClaim) {
        throw new Error("Proses lain sedang disiapkan atau berjalan.");
      }
      const entry=uiLocalOperationPorts.get(msg.token);
      if(!entry?.connected || !uiLocalMatches(entry,sender,msg.token))throw new Error("Port operasi UI belum tersambung.");
      const claim = "ui-local:" + msg.token;
      // Claim synchronously before awaiting state: START_JOB and cache-clear
      // already use this same exclusion guard. No new storage/restore engine.
      offscreenMaintenanceClaim = claim;
      uiLocalTentativeClaim = claim;
      try {
        if(await uiLocalOperationBusy())throw new Error("Operasi data lokal lain masih berjalan.");
        if ((await getState()).running) {
          throw new Error("Selesaikan proses BMP sebelum mengubah data lokal.");
        }
        if(!entry.connected)throw new Error("UI operasi terputus.");
        uiLocalOperationOwner=entry;
        await serializeUiLocalRecord(async()=>{
          const stored=(await chrome.storage.local.get("bmpLocalBackupOperationV1")).bmpLocalBackupOperationV1||{};
          await chrome.storage.local.set({bmpLocalBackupOperationV1:{...stored,ownerToken:entry.token,ownerDocumentId:entry.documentId}});
        });
        if(!entry.connected)throw new Error("UI operasi terputus.");
        sendResponse({ok:true, claim});
      } catch (error) {
        if (offscreenMaintenanceClaim === claim) offscreenMaintenanceClaim = "";
        if(uiLocalOperationOwner===entry)uiLocalOperationOwner=null;
        throw error;
      } finally {
        if(uiLocalTentativeClaim===claim)uiLocalTentativeClaim="";
      }
      return;
    }
    if (msg.type === "END_UI_LOCAL_OPERATION") {
      if (uiLocalMatches(uiLocalOperationOwner,sender,msg.token) && offscreenMaintenanceClaim === msg.claim) {
        offscreenMaintenanceClaim = "";
        uiLocalOperationOwner = null;
      }
      sendResponse({ok:true});
      return;
    }
    if (msg.type === "GET_UI_LOCAL_OPERATION_STATUS") {
      sendResponse({ok:true,live:await uiLocalOperationBusy()});
      return;
    }
    if (msg.type === "WRITE_UI_LOCAL_OPERATION" || msg.type === "RECOVER_UI_LOCAL_OPERATION") {
      if(!uiLocalSender(sender))throw new Error("Operasi harus dimulai melalui UI BMP.");
      const state=await serializeUiLocalRecord(async()=>{
        const current=(await chrome.storage.local.get("bmpLocalBackupOperationV1")).bmpLocalBackupOperationV1||{};
        if(msg.type==="RECOVER_UI_LOCAL_OPERATION"){
          const expected=msg.expected||{};
          if(["id","ownerToken","updatedAt"].some(key=>current[key]!==expected[key]) ||
             offscreenMaintenanceClaim || await uiLocalOperationBusy())return current;
          // BEGIN reserves exclusion synchronously; check again after liveness awaits.
          if(offscreenMaintenanceClaim || uiLocalOperationOwner?.connected)return current;
          const next={...current,phase:"error",progress:"Operasi sebelumnya terputus sebelum selesai.",lastError:"Coba ulang dari popup BMP Terbuka.",interruptedAt:Date.now(),updatedAt:Date.now()};
          await chrome.storage.local.set({bmpLocalBackupOperationV1:next});return next;
        }
        const next={...current,...msg.patch,schemaVersion:1,updatedAt:Date.now()};
        await chrome.storage.local.set({bmpLocalBackupOperationV1:next});return next;
      });
      sendResponse({ok:true,state});return;
    }
    if (msg.type === "GET_STATE") {
      sendResponse({ok: true, state: await recoverStaleRunningState(), pendingResume: await readPendingResume()});
      return;
    }
    if (msg.type === "START_JOB") {
      if (startJobClaimRunId || offscreenMaintenanceClaim) {
        sendResponse({ok: false, error: "Proses lain sedang disiapkan."});
        return;
      }

      const runId = crypto.randomUUID();
      cancelledRunIds.delete(runId);
      requestRunId = runId;
      startJobClaimRunId = runId;

      const existingJob = await getState();
      if (existingJob.running || await uiLocalOperationBusy()) {
        if (startJobClaimRunId === runId) startJobClaimRunId = "";
        sendResponse({ok: false, error: "Proses lain masih berjalan."});
        return;
      }

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

      // Claim persistent job authority before any expensive OCR/cache work.
      // STOP_JOB can now invalidate this generation while preparation is pending.
      // An explicit start supersedes any stored auto-resume plan or stale
      // login context.
      await writePendingResume(null);
      await setState({
        running: true,
        runId,
        tabId: Number.isInteger(Number(tabId)) ? Number(tabId) : null,
        code,
        startModule,
        currentModule: startModule,
        maxModule,
        effectiveMaxModule: maxModule,
        delayMs: 2500,
        maxPages: 500,
        mergeRequested,
        redownload,
        status: "PREPARING",
        progress: "Menyiapkan proses...",
        ocrProgress: "",
        processedModules: [],
        skippedModules: [],
        endProbeStartModule: null,
        endProbeMaxModule: null,
        mergeMessage: "",
        loginResume: null
      });

      const assertCurrentRun = async () => await requireActiveRun(runId);

      const probe = await askOffscreen({type: "OCR_ENGINE_PROBE"});
      if (!probe?.ok) throw new Error(probe?.error || "OCR lokal tidak siap.");
      await assertCurrentRun();

      const prepared = await askOffscreen({
        type: "OCR_PREPARE_JOB",
        runId,
        code
      });
      if (!prepared?.ok) {
        throw new Error(prepared?.error || "Penyimpanan lokal tidak dapat dibaca.");
      }
      await assertCurrentRun();

      const allCachedModules = normalizeModules(prepared.cachedModules || [], 99);
      let meta = await getCodeMeta(code);
      const highestCachedModule = allCachedModules.length
        ? allCachedModules[allCachedModules.length - 1]
        : null;
      if (highestCachedModule) {
        const reconciled = await invalidateTerminalEvidenceBelow(
          code,
          highestCachedModule,
          runId
        );
        if (!reconciled) throw new Error("Proses berubah saat metadata modul direkonsiliasi.");
        meta = reconciled.meta;
      }
      const knownLast = recentDetectedLastModule(meta);
      const effectiveMaxModule = effectiveLastModule(maxModule, knownLast);
      const selectedCached = allCachedModules.filter(
        m => m >= startModule && m <= effectiveMaxModule
      );
      const forced = redownload ? new Set(selectedCached) : new Set();
      const completedModules = allCachedModules.filter(m => !forced.has(m));
      const skippedModules = redownload ? [] : selectedCached;
      const currentModule = effectiveMaxModule >= startModule
        ? firstMissingModule(startModule, effectiveMaxModule, completedModules)
        : null;

      if (currentModule != null) {
        const numericTabId = Number(tabId);
        if (!Number.isInteger(numericTabId) || numericTabId <= 0) {
          throw new Error("Buka halaman reader BMP pada tab aktif sebelum memulai proses.");
        }
        let readerTab = null;
        try {
          readerTab = await chrome.tabs.get(numericTabId);
        } catch {
          readerTab = null;
        }
        if (!readerTab?.url || !readerTab.url.startsWith(`${SOURCE_ROOT}/reader/`)) {
          throw new Error("Tab proses bukan halaman reader BMP yang didukung.");
        }
        await assertCurrentRun();
      }

      await assertCurrentRun();
      const nextState = await setStateForRun(runId, {
        running: true,
        runId,
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
        endProbeStartModule: null,
        endProbeMaxModule: null,
        mergeMessage: ""
      });
      if (!nextState) throw new Error("Proses dibatalkan sebelum persiapan selesai.");

      if (currentModule == null) {
        let mergeMessage = "";
        try {
          const merged = await maybeBuildRequestedMerge(nextState, knownLast);
          mergeMessage = merged.message;
        } catch (e) {
          mergeMessage = `PDF gabungan gagal: ${String(e?.message || e)}`;
        }
        await requireActiveRun(runId);
        const finalState = {...nextState, mergeMessage};
        const done = await setStateForRun(runId, {
          running: false,
          runId: "",
          status: "DONE",
          progress: finalSummary(finalState, mergeMessage),
          mergeMessage,
          ocrProgress: ""
        });
        if (!done) {
          if (startJobClaimRunId === runId) startJobClaimRunId = "";
          sendResponse({ok: true, stale: true});
          return;
        }
        if (startJobClaimRunId === runId) startJobClaimRunId = "";
        sendResponse({ok: true, resumed: true, skippedModules});
        return;
      }

      if (startJobClaimRunId === runId) startJobClaimRunId = "";
      const committed = await setStateForRun(runId, {currentModule});
      if (!committed) {
        sendResponse({ok: true, stale: true});
        return;
      }
      await navigateCurrentModule(runId);
      sendResponse({
        ok: true,
        resumed: !redownload && currentModule > startModule,
        skippedModules
      });
      return;
    }
    if (msg.type === "STOP_JOB") {
      const state = await getState();
      if (state.runId) cancelledRunIds.add(String(state.runId));
      // Batch 25: stop juga menghentikan silence watchdog run ini.
      clearTimeout(jobSilenceTimer);
      if (state.runId) silenceReloadUsed.delete(String(state.runId));
      if (state.running && state.tabId) {
        chrome.tabs.sendMessage(state.tabId, {
          type: "STOP_MODULE",
          runId: state.runId
        }).catch(() => {});
      }
      if (state.runId) {
        chrome.runtime.sendMessage({
          target: "offscreen",
          type: "OCR_CANCEL_JOB",
          runId: state.runId
        }).catch(() => {});
      }
      if (startJobClaimRunId === String(state.runId || "")) startJobClaimRunId = "";
      await writePendingResume(null);
      await setState({
        running: false,
        runId: "",
        status: "STOPPED_BY_USER",
        progress: "Proses dihentikan.",
        ocrProgress: "",
        loginResume: null
      });
      drainQuizGenerateQueue().catch(() => {});
      sendResponse({ok: true});
      return;
    }
    if (msg.type === "OCR_PROGRESS") {
      const state = await getState();
      const moduleNo = Number(msg.module || 0);
      if (
        !state.running ||
        String(msg.runId || "") !== String(state.runId || "") ||
        (moduleNo > 0 && moduleNo !== Number(state.currentModule))
      ) {
        sendResponse({ok: true, stale: true});
        return;
      }
      noteJobSignal();
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
      const updated = await setStateForRun(state.runId, {
        ocrProgress: `${label}${pageLabel}${pct ? ` — ${pct}` : ""}`
      });
      sendResponse(updated ? {ok: true} : {ok: true, stale: true});
      return;
    }
    if (msg.type === "PAGE_PROGRESS") {
      const state = await getState();
      if (
        !state.running ||
        String(msg.runId || "") !== String(state.runId || "") ||
        Number(msg.module) !== Number(state.currentModule)
      ) {
        sendResponse({ok: true, stale: true});
        return;
      }
      noteJobSignal();
      const totalPages = Number(msg.totalPages || 0);
      const pageSuffix = totalPages > 0 ? ` / ${totalPages}` : "";
      const updated = await setStateForRun(state.runId, {
        status: `DOWNLOADING_M${msg.module}`,
        progress: `Modul ${msg.module} • halaman ${msg.page}${pageSuffix}`,
        ocrProgress: `Menyiapkan halaman ${msg.page}${pageSuffix}`,
        pageIndex: Number(msg.page) || 0,
        pageTotal: totalPages
      });
      sendResponse(updated ? {ok: true} : {ok: true, stale: true});
      return;
    }
    if (msg.type === "OCR_PAGE") {
      const state = await getState();
      if (!state.running) {
        sendResponse({ok: false, error: "Proses tidak aktif."});
        return;
      }
      if (String(msg.runId || "") !== String(state.runId || "")) {
        sendResponse({ok: false, stale: true, error: "Pesan OCR berasal dari proses lama."});
        return;
      }
      if (Number(msg.module) !== Number(state.currentModule)) {
        sendResponse({ok: false, stale: true, error: "Pesan OCR berasal dari modul lama."});
        return;
      }
      noteJobSignal();
      const out = await askOffscreen({
        type: "OCR_ADD_PAGE",
        runId: state.runId,
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
      if (String(msg.runId || "") !== String(state.runId || "")) {
        sendResponse({ok: true, stale: true});
        return;
      }
      if (mod !== Number(state.currentModule)) {
        sendResponse({ok: true, stale: true});
        return;
      }
      noteJobSignal();

      if (msg.result === "complete") {
        const finalizing = await setStateForRun(state.runId, {
          status: `OCR_FINALIZING_M${mod}`,
          progress: `Modul ${mod} selesai. Menyusun PDF...`
        });
        if (!finalizing) {
          sendResponse({ok: true, stale: true});
          return;
        }
        await finishModule(state, mod, msg.pages);
        await requireActiveRun(state.runId);

        const reconciledEvidence = await invalidateTerminalEvidenceBelow(
          state.code,
          mod,
          state.runId
        );
        if (!reconciledEvidence) {
          sendResponse({ok: true, stale: true});
          return;
        }
        const currentDetectedLast = recentDetectedLastModule(reconciledEvidence.meta);

        const completed = normalizeModules(
          [...(state.completedModules || []), mod],
          99
        );
        const processed = normalizeModules(
          [...(state.processedModules || []), mod],
          99
        );

        const endProbeStartModule = Number(state.endProbeStartModule);
        if (
          Number.isInteger(endProbeStartModule) &&
          endProbeStartModule >= 1 &&
          mod > endProbeStartModule
        ) {
          const gapMessage = state.mergeRequested
            ? `PDF gabungan tidak dibuat karena Modul ${endProbeStartModule} belum tersedia sementara Modul ${mod} tersedia.`
            : `Modul ${endProbeStartModule} belum tersedia sementara Modul ${mod} tersedia.`;
          const stopped = {
            ...state,
            completedModules: completed,
            processedModules: processed,
            detectedLastModule: currentDetectedLast
          };
          const done = await setStateForRun(state.runId, {
            running: false,
            runId: "",
            completedModules: completed,
            processedModules: processed,
            detectedLastModule: currentDetectedLast,
            endProbeStartModule: null,
            endProbeMaxModule: null,
            status: "MISSING_GAP",
            progress: `${gapMessage}\n${finalSummary(stopped)}`,
            mergeMessage: state.mergeRequested ? gapMessage : "",
            ocrProgress: ""
          });
          if (!done) {
            sendResponse({ok: true, stale: true});
            return;
          }
          sendResponse({ok: true});
          return;
        }

        const nextModule = firstMissingModule(
          mod + 1,
          Number(state.effectiveMaxModule || state.maxModule),
          completed
        );

        if (nextModule == null) {
          const readyState = {
            ...state,
            completedModules: completed,
            processedModules: processed,
            detectedLastModule: currentDetectedLast
          };
          let mergeMessage = "";
          try {
            const merged = await maybeBuildRequestedMerge(
              readyState,
              currentDetectedLast
            );
            mergeMessage = merged.message;
          } catch (e) {
            mergeMessage = `PDF gabungan gagal: ${String(e?.message || e)}`;
          }
          await requireActiveRun(state.runId);
          const finalState = {...readyState, mergeMessage};
          const done = await setStateForRun(state.runId, {
            running: false,
            runId: "",
            completedModules: completed,
            processedModules: processed,
            detectedLastModule: currentDetectedLast,
            status: "DONE",
            progress: finalSummary(finalState, mergeMessage),
            mergeMessage,
            ocrProgress: ""
          });
          if (!done) {
            sendResponse({ok: true, stale: true});
            return;
          }
          sendResponse({ok: true});
          return;
        }

        const advanced = await setStateForRun(state.runId, {
          completedModules: completed,
          processedModules: processed,
          detectedLastModule: currentDetectedLast,
          currentModule: nextModule,
          status: `M${mod}_PDF_READY`,
          progress: `PDF Modul ${mod} siap. Membuka Modul ${nextModule}...`,
          ocrProgress: ""
        });
        if (!advanced) {
          sendResponse({ok: true, stale: true});
          return;
        }
        const expectedRunId = String(state.runId || "");
        setTimeout(
          () => navigateCurrentModule(expectedRunId),
          Math.max(1000, state.delayMs)
        );
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
          const done = await setStateForRun(state.runId, {
            running: false,
            runId: "",
            endProbeStartModule: null,
            endProbeMaxModule: null,
            status: "MISSING_GAP",
            progress: `${gapMessage}\n${finalSummary(stopped)}`,
            mergeMessage: state.mergeRequested ? gapMessage : "",
            ocrProgress: ""
          });
          if (!done) {
            sendResponse({ok: true, stale: true});
            return;
          }
          sendResponse({ok: true});
          return;
        }

        const existingProbeStart = Number(state.endProbeStartModule);
        const existingProbeMax = Number(state.endProbeMaxModule);
        const endProbeStartModule =
          Number.isInteger(existingProbeStart) && existingProbeStart >= 1
            ? existingProbeStart
            : mod;
        const endProbeMaxModule =
          Number.isInteger(existingProbeMax) && existingProbeMax >= endProbeStartModule
            ? Math.min(existingProbeMax, Number(state.maxModule))
            : Number(state.maxModule);

        if (mod < endProbeMaxModule) {
          const nextProbeModule = mod + 1;
          const advanced = await setStateForRun(state.runId, {
            currentModule: nextProbeModule,
            endProbeStartModule,
            endProbeMaxModule,
            status: "PROBING_GAP",
            progress:
              `Modul ${endProbeStartModule} belum tersedia. Memeriksa Modul ${nextProbeModule} untuk membedakan akhir BMP dari gap...`,
            ocrProgress: ""
          });
          if (!advanced) {
            sendResponse({ok: true, stale: true});
            return;
          }
          const expectedRunId = String(state.runId || "");
          setTimeout(
            () => navigateCurrentModule(expectedRunId),
            Math.max(1000, state.delayMs)
          );
          sendResponse({ok: true, probingHigher: true});
          return;
        }

        // Every module from the first strong-missing point through the
        // user-requested upper bound was also strongly missing. Only now may
        // this run contribute terminal evidence.
        const firstMissing = endProbeStartModule;
        const lastMod = firstMissing - 1;
        const evidence = lastMod >= 1
          ? await setDetectedLastModuleForRun(state.runId, state.code, lastMod)
          : {confirmed: false};
        if (lastMod >= 1 && !evidence) {
          sendResponse({ok: true, stale: true});
          return;
        }

        await requireActiveRun(state.runId);
        if (!evidence.confirmed) {
          const stopped = {...state, completedModules: completed};
          const summary = finalSummary(stopped);
          const done = await setStateForRun(state.runId, {
            running: false,
            runId: "",
            completedModules: completed,
            detectedLastModule: null,
            effectiveMaxModule: Number(state.maxModule),
            endProbeStartModule: null,
            endProbeMaxModule: null,
            status: "MISSING_UNCONFIRMED",
            progress:
              `Modul ${firstMissing} belum terbaca dan tidak ada modul lebih tinggi pada rentang yang diminta. Batas modul belum disimpan karena perlu dikonfirmasi pada percobaan terpisah. Coba lagi.` +
              (summary ? `\n${summary}` : ""),
            mergeMessage: "",
            ocrProgress: ""
          });
          if (!done) {
            sendResponse({ok: true, stale: true});
            return;
          }
          sendResponse({ok: true});
          return;
        }

        const detectedLastModule = lastMod;
        const readyState = {
          ...state,
          completedModules: completed,
          detectedLastModule,
          effectiveMaxModule: Number(state.maxModule),
          endProbeStartModule: null,
          endProbeMaxModule: null
        };

        let mergeMessage = "";
        if (state.mergeRequested && lastMod >= 1) {
          try {
            const merged = await maybeBuildRequestedMerge(
              readyState,
              lastMod,
              {freshTerminal: true}
            );
            mergeMessage = merged.message;
          } catch (e) {
            mergeMessage = `PDF gabungan gagal: ${String(e?.message || e)}`;
          }
        }

        await requireActiveRun(state.runId);
        const detectedText = lastMod >= 1
          ? `Modul terakhir terdeteksi: M${lastMod}.`
          : "Modul 1 tidak tersedia.";
        const summary = finalSummary(readyState, mergeMessage);
        const done = await setStateForRun(state.runId, {
          running: false,
          runId: "",
          completedModules: completed,
          detectedLastModule,
          effectiveMaxModule: Number(state.maxModule),
          endProbeStartModule: null,
          endProbeMaxModule: null,
          status: "END_CANDIDATE",
          progress: `${detectedText}${summary ? `\n${summary}` : ""}`,
          mergeMessage,
          ocrProgress: ""
        });
        if (!done) {
          sendResponse({ok: true, stale: true});
          return;
        }
        sendResponse({ok: true});
        return;
      }

      if (msg.result === "login_required") {
        // Keputusan Owner 2026-10-12 (Batch 15, ditegaskan ulang 2026-10-13):
        // auto-lanjut pasca-login dibatalkan. Plan auto-resume apa pun yang
        // masih tersisa di storage WAJIB dibuang di sini — kalau tidak, READY
        // pertama setelah user login akan memicu START_JOB otomatis (jalur
        // auto yang sudah dibatalkan). Resume hanya lewat tombol manual.
        await writePendingResume(null);
        const done = await setStateForRun(state.runId, {
          running: false,
          runId: "",
          status: "LOGIN_REQUIRED",
          // JANGAN menulis pendingResume di cabang ini: handleReaderReady
          // otomatis men-resume bila pending terisi, dan itu justru jalur
          // auto yang sudah dibatalkan. Kontrak Batch 3 (redownload FALSE)
          // tetap dijaga lewat loginResume + tombol manual.
          progress: "Login diperlukan. Klik “Lanjutkan setelah login”.",
          ocrProgress: "",
          // Login-resume context survives the popup closing; the manual
          // resume button reopens the job from the first unfinished module.
          loginResume: {
            code: state.code,
            startModule: state.startModule,
            maxModule: state.maxModule,
            redownload: state.redownload,
            mergeRequested: state.mergeRequested
          }
        });
        sendResponse(done ? {ok: true} : {ok: true, stale: true});
        return;
      }

      if (msg.result === "blocked") {
        const done = await setStateForRun(state.runId, {
          running: false,
          runId: "",
          status: "BLOCKED",
          progress: "Akses ditolak oleh server. Proses dihentikan tanpa mencoba ulang.",
          ocrProgress: ""
        });
        sendResponse(done ? {ok: true} : {ok: true, stale: true});
        return;
      }

      const done = await setStateForRun(state.runId, {
        running: false,
        runId: "",
        status: "ERROR",
        progress: msg.reason || "Proses tidak dapat dilanjutkan.",
        ocrProgress: ""
      });
      sendResponse(done ? {ok: true} : {ok: true, stale: true});
      return;
    }

    if (msg.type === "READER_LOGIN_WALL") {
      // Keputusan Owner (Batch 18, 2026-10-13): login wall tidak boleh dibiarkan
      // diam. Content script menahan READY saat wall, tapi tanpa kabar plan
      // pendingResume tetap hidup dan memicu auto-resume begitu user login —
      // jalur auto yang sudah dibatalkan. Di sini plan dibuang dan state
      // dialihkan ke LOGIN_REQUIRED dengan konteks loginResume, supaya popup/
      // launcher menampilkan tombol manual "Lanjutkan setelah login".
      const wallTabId = Number(sender?.tab?.id);
      const wallTabUrl = String(sender?.tab?.url || "");
      if (!Number.isInteger(wallTabId) || wallTabId <= 0 ||
          !wallTabUrl.startsWith(`${SOURCE_ROOT}/reader/`)) {
        sendResponse({ok: true});
        return;
      }
      const wallState = await getState();
      // Job aktif punya jalur login_required sendiri lewat hasil modul;
      // jangan diinterupsi dari sini.
      if (wallState.running) {
        sendResponse({ok: true});
        return;
      }
      const wallPending = await readPendingResume();
      let wallTabCode = "";
      try {
        wallTabCode = String(new URL(wallTabUrl).searchParams.get("subfolder") || "")
          .trim().replace(/\/+$/, "").toUpperCase();
      } catch (_) {}
      if (!wallPending || wallTabCode !== String(wallPending.code || "")) {
        sendResponse({ok: true});
        return;
      }
      await writePendingResume(null);
      await setState({
        status: "LOGIN_REQUIRED",
        progress: "Login diperlukan. Klik “Lanjutkan setelah login”.",
        ocrProgress: "",
        loginResume: {
          code: String(wallPending.code || "").trim().toUpperCase(),
          startModule: Number(wallPending.startModule),
          maxModule: Number(wallPending.maxModule),
          redownload: false,
          mergeRequested: Boolean(wallPending.mergeRequested)
        }
      });
      sendResponse({ok: true});
      return;
    }

    if (msg.type === "READER_READY") {
      await handleReaderReady(sender, sendResponse);
      return;
    }

    sendResponse({ok: false, error: "Pesan tidak dikenal."});
  })().catch(async e => {
    if (requestRunId && startJobClaimRunId === requestRunId) {
      startJobClaimRunId = "";
    }
    if (JOB_ERROR_MESSAGE_TYPES.has(String(msg?.type || ""))) {
      try {
        const state = await getState();
        const messageRunId = msg?.type === "START_JOB"
          ? requestRunId
          : String(msg?.runId || "");
        const sameRun = Boolean(
          messageRunId &&
          state.running &&
          String(messageRunId) === String(state.runId || "")
        );
        if (sameRun) {
          cancelledRunIds.add(String(messageRunId));
          await setState({
            running: false,
            runId: "",
            status: "ERROR",
            progress: String(e?.message || e),
            ocrProgress: ""
          });
        }
      } catch (_) {}
    }
    sendResponse({ok: false, error: String(e?.message || e)});
  });

  return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === "offscreen") return;
  handleRuntimeMessage(msg, sender, sendResponse);
  return true;
});

// Auto-resume plumbing: state stays in storage so the popup can close.
// pendingResume holds only the user's explicit range; OCR skip-completed
// selection happens inside START_JOB as usual.
const PENDING_RESUME_KEY = "bmpPendingResumeV1";
let pendingResumeClaim = false;
let readyArmTimer = null;

async function readPendingResume() {
  const x = await chrome.storage.local.get(PENDING_RESUME_KEY);
  return x[PENDING_RESUME_KEY] || null;
}
async function writePendingResume(value) {
  await chrome.storage.local.set({[PENDING_RESUME_KEY]: value});
  // Batch 25: plan baru (atau plan yang dibuang lalu ditulis lagi) berhak
  // mendapat satu kali rescue reload lagi.
  if (value && value.code) planRescueReloaded.delete(String(value.code).toUpperCase());
}

// Batch 25 — plan watchdog. Gejala Owner: tombol "Lanjutkan setelah login"
// (dan stop->lanjut) diklik tapi tidak terjadi apa-apa. Akar masalah: tab
// reader masih memegang content script generasi lama setelah ekstensi
// di-update/reload — pesan masuk tetap tiba, tapi chrome.runtime.sendMessage
// keluar THROW ("Extension context invalidated"), sehingga READER_READY tidak
// pernah sampai dan plan menggantung selamanya. Content script tidak bisa
// menyembuhkan dirinya sendiri; satu-satunya jalan adalah memuat ulang tab
// supaya Chrome menginjeksi content script segar (load-complete ->
// handleReaderNavigated -> RESET_READY -> READY -> START_JOB).
const planRescueReloaded = new Set();

function schedulePlanRescue(code) {
  const key = String(code || "").trim().toUpperCase();
  if (!key) return;
  setTimeout(async () => {
    try {
      const pending = await readPendingResume();
      if (!pending || String(pending.code || "").toUpperCase() !== key) return;
      const state = await getState();
      if (state.running || pendingResumeClaim) return;
      if (planRescueReloaded.has(key)) return;
      const readers = await chrome.tabs.query({url: `${SOURCE_ROOT}/reader/*`});
      const sameCodeTabs = readers.filter(t => {
        try {
          return String(new URL(t.url).searchParams.get("subfolder") || "")
            .trim().replace(/\/+$/, "").toUpperCase() === key;
        } catch (_) {
          return false;
        }
      });
      if (!sameCodeTabs.length) return;
      planRescueReloaded.add(key);
      for (const t of sameCodeTabs) {
        if (Number.isInteger(t.id)) {
          chrome.tabs.reload(t.id).catch(() => {});
        }
      }
    } catch (_) {}
  }, 10000);
}

// Batch 25 — job silence watchdog. Jalur START_JOB langsung (popup Mulai
// saat tab reader yang benar sedang aktif) tidak lewat OPEN_READER_AND_RESUME.
// Bila tab itu memegang content script stale dan tabs.update menunjuk URL yang
// sama (tidak ada navigasi => tidak ada injeksi ulang), START_MODULE tetap
// tiba di listener lama, tapi kanal laporannya mati — run menggantung selamanya
// tanpa umpan balik. Run yang tidak menerima sinyal progress apa pun selama
// JOB_SILENCE_MS dianggap tab mati: muat ulang tab sekali (mesin yang sudah
// ada, onUpdated-complete -> startModule, akan mengirim ulang modul); bila
// masih diam juga, gagalkan run dengan pesan jelas alih-alih menggantung.
const JOB_SILENCE_MS = 75000;
const JOB_SILENCE_CHECK_MS = 20000;
let jobSilenceTimer = 0;
let lastJobSignalAt = 0;
const silenceReloadUsed = new Set();

function noteJobSignal() {
  lastJobSignalAt = Date.now();
}

function armJobSilenceWatchdog(runId) {
  clearTimeout(jobSilenceTimer);
  lastJobSignalAt = Date.now();
  jobSilenceTimer = setTimeout(() => {
    checkJobSilence(String(runId)).catch(() => {});
  }, JOB_SILENCE_CHECK_MS);
}

async function checkJobSilence(runId) {
  const state = await getState();
  if (!state.running || String(state.runId || "") !== runId) return;
  if (Date.now() - lastJobSignalAt < JOB_SILENCE_MS) {
    jobSilenceTimer = setTimeout(() => {
      checkJobSilence(runId).catch(() => {});
    }, JOB_SILENCE_CHECK_MS);
    return;
  }
  const tabId = Number(state.tabId);
  if (silenceReloadUsed.has(runId) || !Number.isInteger(tabId) || tabId <= 0) {
    // Pelanggaran kedua (atau tidak ada tab untuk di-reload): berhenti dengan
    // pesan jelas — run yang menggantung lebih buruk daripada error yang bisa
    // ditindaklanjuti user.
    cancelledRunIds.add(runId);
    await setStateForRun(runId, {
      running: false,
      runId: "",
      status: "ERROR",
      progress:
        "Reader tidak merespons. Muat ulang halaman reader, lalu tekan Mulai lagi.",
      ocrProgress: ""
    });
    return;
  }
  silenceReloadUsed.add(runId);
  await setStateForRun(runId, {
    status: "WAITING_PAGE",
    progress: "Reader tidak merespons; memuat ulang halaman reader..."
  });
  chrome.tabs.reload(tabId).catch(() => {});
  lastJobSignalAt = Date.now();
  jobSilenceTimer = setTimeout(() => {
    checkJobSilence(runId).catch(() => {});
  }, JOB_SILENCE_CHECK_MS);
}

async function handleReaderReady(sender, sendResponse) {
  const tabId = Number(sender?.tab?.id);
  const tabUrl = String(sender?.tab?.url || "");
  if (!Number.isInteger(tabId) || tabId <= 0 || !tabUrl.startsWith(`${SOURCE_ROOT}/reader/`)) {
    sendResponse({ok: true});
    return;
  }
  try {
    const state = await getState();
    const pending = await readPendingResume();
    if (!pending || state.running || pendingResumeClaim) {
      sendResponse({ok: true});
      return;
    }
    // Identity check: only resume when this reader tab actually shows the
    // pending code, so READY from any other reader page is ignored.
    let tabCode = "";
    try {
      tabCode = String(new URL(tabUrl).searchParams.get("subfolder") || "")
        .trim().replace(/\/+$/, "").toUpperCase();
    } catch (_) {}
    if (tabCode !== String(pending.code || "")) {
      sendResponse({ok: true});
      return;
    }
    pendingResumeClaim = true;
    sendResponse({ok: true});
    try {
      // A freshly opened tab needs its content script armed after load.
      await chrome.tabs.sendMessage(tabId, {type: "BMP_RESET_READY"}).catch(() => {});
      await handleRuntimeMessage({
        type: "START_JOB",
        tabId,
        code: pending.code,
        startModule: Number(pending.startModule),
        maxModule: Number(pending.maxModule),
        redownload: Boolean(pending.redownload),
        mergeRequested: Boolean(pending.mergeRequested)
      }, {tab: {id: tabId, url: tabUrl}}, () => {});
    } finally {
      pendingResumeClaim = false;
    }
  } catch (_) {
    pendingResumeClaim = false;
    sendResponse({ok: true});
  }
}

function handleReaderNavigated(tabId) {
  clearTimeout(readyArmTimer);
  readyArmTimer = setTimeout(() => {
    chrome.tabs.sendMessage(tabId, {type: "BMP_RESET_READY"}).catch(() => {});
  }, 700);
}
chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  chrome.tabs.get(tabId).then(tab => {
    if (String(tab?.url || "").startsWith(`${SOURCE_ROOT}/reader/`)) {
      handleReaderNavigated(tabId);
    }
  }).catch(() => {});
});

// Plan yatim: jika tab reader terakhir untuk kode pending ditutup, rencana
// auto-resume dibuang — popup tidak boleh menampilkan "Menunggu reader" untuk
// tab yang sudah tidak ada. Konteks login (loginResume) tetap hidup di state,
// jadi tekan "Mulai" lagi tetap menyiapkan resume dari awal.
chrome.tabs.onRemoved?.addListener(async tabId => {
  try {
    const pending = await readPendingResume();
    if (!pending) return;
    const code = String(pending.code || "").trim().toUpperCase();
    if (!code) return;
    const readers = await chrome.tabs.query({url: `${SOURCE_ROOT}/reader/*`});
    const sameCodeTabs = readers.filter(t => {
      try {
        return String(new URL(t.url).searchParams.get("subfolder") || "")
          .trim().replace(/\/+$/, "").toUpperCase() === code;
      } catch (_) {
        return false;
      }
    });
    if (!sameCodeTabs.length) {
      await writePendingResume(null);
    } else {
      // Tab pembaca lain masih terbuka: re-arm supaya READY bisa tiba lagi
      // (readySent tab lama mungkin sudah hangus sejak halaman selesai load).
      for (const t of sameCodeTabs) {
        if (Number.isInteger(t.id)) {
          chrome.tabs.sendMessage(t.id, {type: "BMP_RESET_READY"}).catch(() => {});
        }
      }
    }
  } catch (_) {}
});
