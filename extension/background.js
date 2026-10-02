importScripts("config.js", "cloud-surface.js", "telemetry.js", "cache-consistency.js");

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
  completedModules: [],
  cachedModulesAtStart: [],
  processedModules: [],
  skippedModules: [],
  detectedLastModule: null,
  mergeMessage: ""
};

let creatingOffscreen = null;
let installIdPromise = null;
let startJobClaimRunId = "";
let offscreenMaintenanceClaim = "";
let quizStartClaim = "";
let quizStartIdentity = null;
let quizReadyStartClaim = "";
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
  const candidate = Number(previous.lastModuleCandidate);
  const candidateAt = Number(previous.lastModuleCandidateAt || 0);
  const candidateRunId = String(previous.lastModuleCandidateRunId || "");
  const confirmsPreviousRun = (
    candidate === lastModule &&
    candidateAt > 0 &&
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
  if (Number(meta?.detectedEvidenceVersion) !== LAST_MODULE_EVIDENCE_VERSION) return null;
  const last = Number(meta?.detectedLastModule);
  const detectedAt = Number(meta?.detectedAt || 0);
  if (!Number.isInteger(last) || last < 1 || last > 99) return null;
  if (!detectedAt || now - detectedAt > DETECTED_LAST_MODULE_TTL_MS) return null;
  return last;
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
    const error = new Error(data.error || `Community API HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
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
      releaseUrl: safeHttpsUrl(data.release_url),
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
  const stored = await chrome.storage.local.get("bmpCommunityToken");
  const currentToken = typeof stored.bmpCommunityToken === "string"
    ? stored.bmpCommunityToken
    : "";
  const data = await api("/v1/pair/start", {
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
  await chrome.tabs.create({url: deepLink});
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === "offscreen") return;

  let requestRunId = "";
  (async () => {
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
      }
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
        if (current.running || startJobClaimRunId) {
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
        if (current.running || startJobClaimRunId) {
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
    if (msg.type === "GET_STATE") {
      sendResponse({ok: true, state: await recoverStaleRunningState()});
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
      if (existingJob.running) {
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
        mergeMessage: ""
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

      const meta = await getCodeMeta(code);
      const knownLast = recentDetectedLastModule(meta);
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
        mergeMessage: ""
      });
      if (!nextState) throw new Error("Proses dibatalkan sebelum persiapan selesai.");

      if (effectiveMaxModule < startModule) {
        const message = knownLast
          ? `Modul terakhir yang terdeteksi adalah M${knownLast}; rentang ini tidak perlu diproses.`
          : "Tidak ada modul pada rentang ini yang dapat diproses.";
        const done = await setStateForRun(runId, {
          running: false,
          runId: "",
          status: "DONE",
          progress: message,
          ocrProgress: ""
        });
        if (!done) {
          if (startJobClaimRunId === runId) startJobClaimRunId = "";
          sendResponse({ok: true, stale: true});
          return;
        }
        if (startJobClaimRunId === runId) startJobClaimRunId = "";
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
      await setState({
        running: false,
        runId: "",
        status: "STOPPED_BY_USER",
        progress: "Proses dihentikan.",
        ocrProgress: ""
      });
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
      const totalPages = Number(msg.totalPages || 0);
      const pageSuffix = totalPages > 0 ? ` / ${totalPages}` : "";
      const updated = await setStateForRun(state.runId, {
        status: `DOWNLOADING_M${msg.module}`,
        progress: `Modul ${msg.module} • halaman ${msg.page}${pageSuffix}`,
        ocrProgress: `Menyiapkan halaman ${msg.page}${pageSuffix}`
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
          await requireActiveRun(state.runId);
          const finalState = {...readyState, mergeMessage};
          const done = await setStateForRun(state.runId, {
            running: false,
            runId: "",
            completedModules: completed,
            processedModules: processed,
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

        const lastMod = mod - 1;
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
            status: "MISSING_UNCONFIRMED",
            progress:
              `Modul ${mod} belum terbaca. Batas modul belum disimpan karena perlu dikonfirmasi pada percobaan terpisah. Coba lagi.` +
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
          effectiveMaxModule: Math.min(Number(state.maxModule), lastMod)
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
          effectiveMaxModule: readyState.effectiveMaxModule,
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
        const done = await setStateForRun(state.runId, {
          running: false,
          runId: "",
          status: "LOGIN_REQUIRED",
          progress: "Sesi sumber meminta login ulang.",
          ocrProgress: ""
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
});
