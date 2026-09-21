export async function tg(env, method, body) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN belum diset.");
  const response = await fetch(
    "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    }
  );
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error("Telegram " + method + ": " + (data.description || response.status));
  }
  return data.result;
}
