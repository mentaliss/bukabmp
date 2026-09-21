import {tg} from "../telegram/api.js";
import {menuDeepLink} from "./main.js";
import {telegramBotUsername} from "../telegram/router.js";

function botDeepLink(env, start) {
  return "https://t.me/" + telegramBotUsername(env) + "?start=" +
    encodeURIComponent(start);
}

export async function sendGroupBotPanel(env, message) {
  return await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: [
      "🤖 BMP Terbuka Assistant",
      "",
      "Pilih bantuan yang kamu butuhkan. Untuk pertanyaan AI di grup, kamu juga bisa langsung ketik /ask diikuti pertanyaan."
    ].join("\n"),
    reply_parameters: {message_id: message.message_id},
    reply_markup: {
      inline_keyboard: [
        [{text: "🤖 Tanya AI", callback_data: "group:ask"}],
        [{text: "📚 Bantuan Ekstensi", url: botDeepLink(env, "help_extension")}],
        [
          {text: "👤 ID Saya", callback_data: "group:id"},
          {text: "💬 Buka Bot di DM", url: menuDeepLink(env)}
        ]
      ]
    },
    disable_web_page_preview: true
  });
}
