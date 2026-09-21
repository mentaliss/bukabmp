import {telegramBotUsername} from "../telegram/router.js";
import {renderMenu} from "./ui.js";

export function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {text: "👤 Akun Saya", callback_data: "menu:account"},
        {text: "🤖 Tanya AI", callback_data: "menu:ai"}
      ],
      [
        {text: "📚 Ekstensi", callback_data: "menu:extension"},
        {text: "⭐ Supporter", callback_data: "menu:supporter"}
      ],
      [
        {text: "👥 Referral", callback_data: "menu:referral"},
        {text: "🆘 Bantuan", callback_data: "menu:help"}
      ]
    ]
  };
}

export async function sendMainMenu(
  env,
  chatId,
  userId = null,
  messageId = null
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "🏠 BMP Terbuka",
      "",
      "Pilih yang kamu butuhkan."
    ].join("\n"),
    replyMarkup: mainMenuKeyboard()
  });
}

export function menuDeepLink(env) {
  return "https://t.me/" + telegramBotUsername(env) + "?start=menu";
}
