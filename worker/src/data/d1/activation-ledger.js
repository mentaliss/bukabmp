import {requireBotDb} from "./client.js";
import {d1ActivationLedgerEnabled} from "./mode.js";
import {createOpaqueReferralCode} from "../../features/referral.js";
import {createUserIfMissing, getUserById} from "./users.js";

async function ensureLedgerUser(env, telegramUserId) {
  const id = Number(telegramUserId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const existing = await getUserById(env, id);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const created = await createUserIfMissing(env, {
      telegramUserId: id,
      referralCode: createOpaqueReferralCode()
    });
    if (created) return created;
  }
  return null;
}

export async function getActivationLedger(env, telegramUserId) {
  if (!d1ActivationLedgerEnabled(env)) {
    return {available: false, activated: false, row: null};
  }

  const row = await requireBotDb(env)
    .prepare(
      "SELECT telegram_user_id, first_activated_at, last_activated_at, " +
      "activation_count FROM users WHERE telegram_user_id = ?1"
    )
    .bind(Number(telegramUserId))
    .first();

  return {
    available: true,
    activated: Number(row?.first_activated_at || 0) > 0,
    row: row || null
  };
}

export async function recordSuccessfulActivation(
  env,
  telegramUserId,
  now = Date.now()
) {
  if (!d1ActivationLedgerEnabled(env)) {
    return {available: false, recorded: false};
  }

  const user = await ensureLedgerUser(env, telegramUserId);
  if (!user) {
    return {available: true, recorded: false, reason: "user_unavailable"};
  }

  const at = Number(now);
  await requireBotDb(env)
    .prepare(
      "UPDATE users SET " +
      "first_activated_at = COALESCE(first_activated_at, ?2), " +
      "last_activated_at = ?2, " +
      "activation_count = COALESCE(activation_count, 0) + 1, " +
      "updated_at = ?2 " +
      "WHERE telegram_user_id = ?1"
    )
    .bind(Number(telegramUserId), at)
    .run();

  const state = await getActivationLedger(env, telegramUserId);
  return {
    available: true,
    recorded: true,
    firstActivation:
      Number(state.row?.first_activated_at || 0) === at &&
      Number(state.row?.activation_count || 0) === 1,
    row: state.row
  };
}
