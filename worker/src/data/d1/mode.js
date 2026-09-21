export function envFlagEnabled(env, name) {
  return ["1", "true", "yes", "on"].includes(
    String(env?.[name] || "").trim().toLowerCase()
  );
}

export function d1BindingAvailable(env) {
  return Boolean(env?.BOT_DB && typeof env.BOT_DB.prepare === "function");
}

export function d1WritesEnabled(env) {
  if (!d1BindingAvailable(env)) return false;
  return envFlagEnabled(env, "BOT_V2_D1_WRITE_ENABLED");
}

export function d1ReplayEnabled(env) {
  return d1BindingAvailable(env) &&
    envFlagEnabled(env, "BOT_V2_D1_REPLAY_ENABLED");
}

export function d1MigrationEnabled(env) {
  return d1BindingAvailable(env) &&
    envFlagEnabled(env, "BOT_V2_D1_MIGRATION_ENABLED");
}

export function d1SupporterEnabled(env) {
  return d1BindingAvailable(env) &&
    envFlagEnabled(env, "BOT_V2_SUPPORTER_D1_ENABLED");
}

export function d1PaymentEnabled(env) {
  return d1SupporterEnabled(env) &&
    envFlagEnabled(env, "BOT_V2_PAYMENT_D1_ENABLED");
}

export function d1ReferralEnabled(env) {
  return d1SupporterEnabled(env) &&
    envFlagEnabled(env, "BOT_V2_REFERRAL_D1_ENABLED");
}

export function d1ReferralSelfTestEnabled(env) {
  return d1ReferralEnabled(env) &&
    envFlagEnabled(env, "BOT_V2_REFERRAL_SELF_TEST_ENABLED");
}

export async function d1ReadProbe(env) {
  if (!d1BindingAvailable(env)) {
    return {bound: false, readable: false};
  }
  try {
    const row = await env.BOT_DB.prepare("SELECT 1 AS ok").first();
    return {bound: true, readable: Number(row?.ok || 0) === 1};
  } catch {
    return {bound: true, readable: false};
  }
}
