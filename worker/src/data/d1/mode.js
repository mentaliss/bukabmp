export function d1BindingAvailable(env) {
  return Boolean(env?.BOT_DB && typeof env.BOT_DB.prepare === "function");
}

export function d1WritesEnabled(env) {
  if (!d1BindingAvailable(env)) return false;
  return ["1", "true", "yes", "on"].includes(
    String(env?.BOT_V2_D1_WRITE_ENABLED || "").trim().toLowerCase()
  );
}
