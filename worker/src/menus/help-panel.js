import {tg} from "../telegram/api.js";
import {supportHelpText} from "./help.js";

export async function sendHelpPanel(env, chatId, access = null) {
  return await tg(env, "sendMessage", {
    chat_id: chatId,
    text: supportHelpText(access),
    reply_markup: {
      inline_keyboard: [[{text: "◀ Menu Utama", callback_data: "menu:main"}]]
    },
    disable_web_page_preview: true
  });
}
