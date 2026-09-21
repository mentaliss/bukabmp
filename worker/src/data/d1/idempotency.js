import {requireBotDb} from "./client.js";

export async function claimProcessedUpdate(
  env,
  {updateId, type = "telegram", processedAt = Date.now()}
) {
  const id = Number(updateId);
  if (!Number.isSafeInteger(id) || id < 0) {
    return {claimed: false, reason: "invalid_update_id"};
  }

  const result = await requireBotDb(env)
    .prepare(
      "INSERT OR IGNORE INTO processed_updates " +
      "(update_id, type, processed_at) VALUES (?1, ?2, ?3)"
    )
    .bind(id, String(type), Number(processedAt))
    .run();

  return {
    claimed: Number(result?.meta?.changes || 0) === 1,
    reason: Number(result?.meta?.changes || 0) === 1
      ? null
      : "duplicate"
  };
}
