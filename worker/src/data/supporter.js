import {supporterEntitlementKey} from "../features/supporter-model.js";

export async function getSupporterEntitlement(env, userId) {
  if (!env.PAIRINGS || !userId) return null;
  return await env.PAIRINGS.get(supporterEntitlementKey(userId), "json");
}

export async function putSupporterEntitlement(env, userId, record) {
  if (!env.PAIRINGS || !userId) return;
  await env.PAIRINGS.put(supporterEntitlementKey(userId), JSON.stringify(record));
}
