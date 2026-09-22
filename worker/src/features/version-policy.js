const KEY = "version-policy:global:v1";
const CHANNELS = ["github", "android", "cws", "edge"];

function clean(value, max = 256) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function semver(value) {
  const v = clean(value, 32);
  return /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(v) ? v : "";
}

function versionParts(value) {
  return String(value || "").split(".").map(part => Number.parseInt(part, 10) || 0);
}

function compareVersion(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const x = left[i] || 0;
    const y = right[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

function httpsUrl(value) {
  const raw = clean(value, 2048);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function sanitizeGlobalVersionPolicy(raw) {
  if (!raw || typeof raw !== "object") return null;
  const latestVersion = semver(raw.latest_version);
  const minimumGlobal = semver(raw.minimum_global);
  if (!latestVersion || !minimumGlobal) return null;
  if (compareVersion(minimumGlobal, latestVersion) > 0) return null;

  const readinessRaw = raw.readiness && typeof raw.readiness === "object" ? raw.readiness : {};
  const readiness = {};
  for (const channel of CHANNELS) readiness[channel] = readinessRaw[channel] === true;

  const forceRaw = clean(raw.force_after, 64);
  const forceAfter = forceRaw && Number.isFinite(Date.parse(forceRaw))
    ? new Date(Date.parse(forceRaw)).toISOString()
    : null;

  return {
    latest_version: latestVersion,
    minimum_global: minimumGlobal,
    force_after: forceAfter,
    release_url: httpsUrl(raw.release_url),
    message: clean(raw.message, 300),
    readiness
  };
}

export async function readGlobalVersionPolicy(env) {
  if (!env?.PAIRINGS) return null;
  const raw = await env.PAIRINGS.get(KEY, "json");
  return sanitizeGlobalVersionPolicy(raw);
}

export async function writeGlobalVersionPolicy(env, raw, now = Date.now()) {
  if (!env?.PAIRINGS) return {ok: false, reason: "policy_storage_unavailable"};
  const policy = sanitizeGlobalVersionPolicy(raw);
  if (!policy) return {ok: false, reason: "invalid_policy"};
  const stored = {...policy, updated_at: now};
  await env.PAIRINGS.put(KEY, JSON.stringify(stored));
  return {ok: true, policy: stored};
}

export async function resolveVersionPolicy(env, channel, legacy) {
  const override = await readGlobalVersionPolicy(env);
  if (!override) return {...legacy, source: "env_fallback"};
  const ready = override.readiness?.[channel] === true;
  return {
    ...legacy,
    latestVersion: override.latest_version,
    minimumVersion: ready ? override.minimum_global : "",
    forceAfter: override.force_after,
    releaseUrl: override.release_url || legacy.releaseUrl,
    message: override.message || legacy.message,
    storeReady: ready,
    source: "control_center"
  };
}

export function versionPolicyKey() {
  return KEY;
}
