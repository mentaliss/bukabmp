import {tg} from "../telegram/api.js";
import {formatWibDateTime, supporterIsActive} from "../features/supporter-model.js";
import {supportAccessForUser} from "../features/supporter.js";
import {referralHomeState} from "../features/referral-service.js";

export async function sendAccountMenu(env, chatId, userId) {
  const access = await supportAccessForUser(env, userId);
  const supporter = access.supporter;
  const supporterLine = supporterIsActive(supporter)
    ? "Aktif sampai " + formatWibDateTime(supporter.supporter_until)
    : "Belum aktif";

  const referral = await referralHomeState(env, userId);
  const referralLine = referral.available && !referral.error
    ? String(referral.qualifiedCount)
    : "Belum tersedia";

  return await tg(env, "sendMessage", {
    chat_id: chatId,
    text: [
      "👤 Akun Saya",
      "",
      "Supporter       " + supporterLine,
      "Referral valid  " + referralLine,
      "Aktivasi        Kelola dari extension",
      "",
      "Data akun ditampilkan hanya di DM."
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{text: "⭐ Supporter Saya", callback_data: "menu:supporter"}],
        [{text: "👥 Referral Saya", callback_data: "menu:referral"}],
        [{text: "🔐 Aktivasi", callback_data: "menu:activation"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}
