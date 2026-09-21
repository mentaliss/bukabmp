import {tg} from "../telegram/api.js";
import {referralHomeState} from "../features/referral-service.js";

export async function sendReferralMenu(env, chatId, userId) {
  const state = await referralHomeState(env, userId);

  if (!state.available) {
    return await tg(env, "sendMessage", {
      chat_id: chatId,
      text: "👥 Referral\n\nReferral belum diaktifkan di environment ini.",
      reply_markup: {
        inline_keyboard: [[{text: "◀ Menu Utama", callback_data: "menu:main"}]]
      }
    });
  }

  if (state.error) {
    return await tg(env, "sendMessage", {
      chat_id: chatId,
      text: "👥 Referral\n\nStatus referral belum dapat dimuat.",
      reply_markup: {
        inline_keyboard: [[{text: "◀ Menu Utama", callback_data: "menu:main"}]]
      }
    });
  }

  return await tg(env, "sendMessage", {
    chat_id: chatId,
    text: [
      "👥 Referral",
      "",
      "Referral valid: " + state.qualifiedCount,
      "Total reward referral: " + state.entitlementTotalDays + " hari Supporter",
      "",
      "Link kamu:",
      state.link,
      "",
      "Referral baru dihitung valid setelah user memenuhi syarat komunitas dan berhasil aktivasi BMP."
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [[{text: "◀ Menu Utama", callback_data: "menu:main"}]]
    },
    disable_web_page_preview: true
  });
}
