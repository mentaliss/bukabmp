import {requireBotDb} from "./client.js";

export async function recordPaymentOnce(
  env,
  {
    paymentEventId,
    telegramChargeRef,
    userId,
    packageId,
    stars,
    status = "PROCESSED",
    processedAt = Date.now()
  }
) {
  const result = await requireBotDb(env)
    .prepare(
      "INSERT OR IGNORE INTO payments " +
      "(payment_event_id, telegram_charge_ref, user_id, package_id, stars, processed_at, status) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )
    .bind(
      String(paymentEventId),
      String(telegramChargeRef),
      Number(userId),
      String(packageId),
      Number(stars),
      Number(processedAt),
      String(status)
    )
    .run();

  return Number(result?.meta?.changes || 0) === 1;
}
