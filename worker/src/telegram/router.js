export function isPrivateChat(message) {
  return message?.chat?.type === "private";
}

export function isGroupChat(message) {
  return ["group", "supergroup"].includes(message?.chat?.type || "");
}

// Telegram represents messages sent by an anonymous group admin as a message
// from GroupAnonymousBot plus sender_chat. Preserve the existing routing rule.
export function isAnonymousAdminMessage(message) {
  if (!isGroupChat(message) || !message?.sender_chat) return false;
  const username = String(message?.from?.username || "").toLowerCase();
  return Boolean(
    message?.from?.is_bot &&
    (username === "groupanonymousbot" || String(message?.from?.id || "") === "1087968824")
  );
}

export function isNormalBotMessage(message) {
  return Boolean(message?.from?.is_bot && !isAnonymousAdminMessage(message));
}

export function telegramBotUsername(env) {
  return String(env.BOT_USERNAME || "bukabmp_bot").replace(/^@/, "").trim();
}

export function configuredTelegramChatMatches(message, configuredValue) {
  const configured = String(configuredValue || "").trim();
  if (!configured) return false;
  if (configured === String(message?.chat?.id || "")) return true;

  const username = String(message?.chat?.username || "").replace(/^@/, "").toLowerCase();
  if (configured.startsWith("@") && username) {
    return configured.slice(1).toLowerCase() === username;
  }
  return false;
}

export function isOfficialSupportGroup(env, message) {
  if (!isGroupChat(message)) return false;
  const configured = env.SUPPORT_GROUP_ID || env.GROUP_ID;
  if (!configured) return true;
  return configuredTelegramChatMatches(message, configured);
}

export function parseBotCommand(text, env) {
  const match = String(text || "").trim().match(/^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const addressedTo = String(match[2] || "").toLowerCase();
  const botUsername = telegramBotUsername(env).toLowerCase();
  if (addressedTo && botUsername && addressedTo !== botUsername) return null;
  return {
    command: String(match[1] || "").toLowerCase(),
    args: String(match[3] || "").trim()
  };
}

export function supportInvocation(message, env) {
  const text = String(message?.text || message?.caption || "").trim();
  const command = parseBotCommand(text, env);
  const supportCommands = new Set([
    "ask", "help", "bmphelp", "tutorial", "install", "android", "desktop", "group",
    "update", "fitur", "storage", "bug", "faq", "quota", "support",
    "supporter", "supporters", "terms", "paysupport"
  ]);
  if (command && supportCommands.has(command.command)) {
    return {invoked: true, command, query: command.args};
  }

  const botUsername = telegramBotUsername(env);
  const mention = botUsername ? "@" + botUsername : "";
  const mentioned = mention && text.toLowerCase().includes(mention.toLowerCase());
  const replyUsername = String(message?.reply_to_message?.from?.username || "");
  const repliedToBot = botUsername && replyUsername.toLowerCase() === botUsername.toLowerCase();

  if (!mentioned && !repliedToBot) return {invoked: false};

  let query = text;
  if (mention) query = query.replace(new RegExp("@" + botUsername, "ig"), " ");
  query = query.replace(/\s+/g, " ").trim();
  return {invoked: true, command: null, query};
}
