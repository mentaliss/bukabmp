import {requireBotDb} from "./client.js";

export async function getUserById(env, telegramUserId) {
  return await requireBotDb(env)
    .prepare("SELECT * FROM users WHERE telegram_user_id = ?1")
    .bind(Number(telegramUserId))
    .first();
}

export async function getUserByReferralCode(env, referralCode) {
  return await requireBotDb(env)
    .prepare("SELECT * FROM users WHERE referral_code = ?1")
    .bind(String(referralCode))
    .first();
}

export async function createUserIfMissing(
  env,
  {telegramUserId, referralCode, now = Date.now()}
) {
  const db = requireBotDb(env);
  await db.prepare(
    "INSERT OR IGNORE INTO users " +
    "(telegram_user_id, created_at, referral_code, updated_at) " +
    "VALUES (?1, ?2, ?3, ?2)"
  )
    .bind(Number(telegramUserId), Number(now), String(referralCode))
    .run();

  return await getUserById(env, telegramUserId);
}
