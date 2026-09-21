import {tg} from "../telegram/api.js";

export async function sendActivationMenu(env, chatId) {
  return await tg(env, "sendMessage", {
    chat_id: chatId,
    text: [
      "🔐 Aktivasi BMP Terbuka",
      "",
      "Mulai aktivasi dari popup extension.",
      "Kalau Telegram Web tidak membawa kode aktivasi, salin kode dari popup lalu kirim ke bot ini.",
      "",
      "Verifikasi keanggotaan dan token aktivasi tetap memakai flow yang sama seperti sebelumnya."
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [[{text: "◀ Menu Utama", callback_data: "menu:main"}]]
    }
  });
}
