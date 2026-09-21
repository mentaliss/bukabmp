import {sha256Hex} from "./crypto.js";

export async function checkPairRateLimit(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!ip || !env.MEMBER_HASH_SALT) return true;

  const fingerprint = await sha256Hex("rate:" + ip + ":" + env.MEMBER_HASH_SALT);
  const key = "rate:" + fingerprint;
  const count = Number(await env.PAIRINGS.get(key) || 0);
  if (count >= 5) return false;

  await env.PAIRINGS.put(key, String(count + 1), {expirationTtl: 60});
  return true;
}

export async function checkActivationRefreshRateLimit(env, token) {
  if (!env?.PAIRINGS || !token) return true;

  const fingerprint = await sha256Hex(
    "activation-refresh:" +
    String(token) +
    ":" +
    String(env.MEMBER_HASH_SALT || "")
  );
  const key = "activation-refresh-rate:" + fingerprint;
  const count = Number(await env.PAIRINGS.get(key) || 0);
  if (count >= 3) return false;

  await env.PAIRINGS.put(
    key,
    String(count + 1),
    {expirationTtl: 60}
  );
  return true;
}
