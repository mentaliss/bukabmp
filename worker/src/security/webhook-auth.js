export function telegramWebhookAuthorized(request, env) {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  return Boolean(env.TELEGRAM_WEBHOOK_SECRET) && secret === env.TELEGRAM_WEBHOOK_SECRET;
}
