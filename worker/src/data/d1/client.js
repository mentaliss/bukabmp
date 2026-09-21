export function requireBotDb(env) {
  const db = env?.BOT_DB;
  if (!db || typeof db.prepare !== "function") {
    throw new Error("BOT_DB binding unavailable");
  }
  return db;
}
