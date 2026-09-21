import {supporterEntitlementKey} from "../features/supporter-model.js";
import {auditErrorName} from "../security/audit.js";
import {d1SupporterEnabled} from "./d1/mode.js";
import {
  getD1SupporterState,
  putD1SupporterState
} from "./d1/supporter-state.js";

async function getKvSupporterEntitlement(env, userId) {
  if (!env?.PAIRINGS || !userId) return null;
  return await env.PAIRINGS.get(supporterEntitlementKey(userId), "json");
}

export async function mirrorSupporterEntitlementToKv(env, userId, record) {
  if (!env?.PAIRINGS || !userId) return;
  await env.PAIRINGS.put(
    supporterEntitlementKey(userId),
    JSON.stringify(record)
  );
}

export async function getSupporterEntitlement(env, userId) {
  if (!userId) return null;

  const kvRecord = await getKvSupporterEntitlement(env, userId);
  if (!d1SupporterEnabled(env)) return kvRecord;

  try {
    const d1Record = await getD1SupporterState(env, userId);
    if (!d1Record) return kvRecord;

    return {
      ...(kvRecord && typeof kvRecord === "object" ? kvRecord : {}),
      ...d1Record,
      user_id: String(userId)
    };
  } catch (error) {
    console.warn("supporter_d1_read_fallback", {
      error_name: auditErrorName(error)
    });
    return kvRecord;
  }
}

export async function putSupporterEntitlement(env, userId, record) {
  if (!userId) return;

  if (!d1SupporterEnabled(env)) {
    await mirrorSupporterEntitlementToKv(env, userId, record);
    return;
  }

  await putD1SupporterState(env, userId, record);

  try {
    await mirrorSupporterEntitlementToKv(env, userId, record);
  } catch (error) {
    console.warn("supporter_kv_mirror_failed", {
      error_name: auditErrorName(error)
    });
  }
}
