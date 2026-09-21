import {tg} from "../telegram/api.js";
import {telegramBotUsername} from "../telegram/router.js";

export function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{text: "👤 Akun Saya", callback_data: "menu:account"}],
      [
        {text: "⭐ Supporter", callback_data: "menu:supporter"},
        {text: "👥 Referral", callback_data: "menu:referral"}
      ],
      [
        {text: "🔐 Aktivasi", callback_data: "menu:activation"},
        {text: "📘 Bantuan", callback_data: "menu:help"}
      ]
    ]
  };
}

export async function sendMainMenu(env, chatId) {
  return await tg(env, "sendMessage", {
    chat_id: chatId,
    text: "BMP Terbuka\n\nPilih menu:",
    reply_markup: mainMenuKeyboard(),
    disable_web_page_preview: true
  });
}

export function menuDeepLink(env) {
  return "https://t.me/" + telegramBotUsername(env) + "?start=menu";
}
