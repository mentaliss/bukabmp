import {supportHelpText, bugReportText} from "./help.js";
import {renderMenu} from "./ui.js";

export async function sendHelpPanel(
  env,
  chatId,
  access = null,
  userId = null,
  messageId = null
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "🆘 Bantuan",
      "",
      "Pilih jenis bantuan. Panduan penggunaan extension dipisahkan dari bantuan bot supaya lebih gampang dicari."
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{text: "📚 Penggunaan Ekstensi", callback_data: "menu:extension"}],
        [{text: "🤖 Bot & AI", callback_data: "help:bot"}],
        [{text: "🛠 Laporkan Masalah", callback_data: "help:report"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}

export async function sendBotHelpPanel(
  env,
  chatId,
  userId,
  messageId,
  access = null
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: supportHelpText(access),
    replyMarkup: {
      inline_keyboard: [
        [{text: "🤖 Tanya AI", callback_data: "menu:ai"}],
        [{text: "◀ Bantuan", callback_data: "menu:help"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}

export async function sendReportHelpPanel(
  env,
  chatId,
  userId,
  messageId
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: bugReportText(),
    replyMarkup: {
      inline_keyboard: [
        [{text: "🤖 Tanya AI", callback_data: "menu:ai"}],
        [{text: "◀ Bantuan", callback_data: "menu:help"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}
