import {tg} from "../telegram/api.js";
import {isPrivateChat, telegramBotUsername} from "../telegram/router.js";
import {
  SUPPORTER_ACTIVATION_BONUS_DAYS,
  SUPPORTER_ACTIVATION_MAX_DAYS,
  formatWibDateTime,
  supporterPackage
} from "../features/supporter-model.js";
import {
  supporterStatusText,
  supporterWallText
} from "../features/supporter.js";
import {renderMenu} from "./ui.js";

export function supporterDeepLink(env) {
  return "https://t.me/" + telegramBotUsername(env) + "?start=support";
}

export function supportMenuText(access = null) {
  const status = access?.source === "supporter" && access.supporter
    ? "Aktif sampai " + formatWibDateTime(access.supporter.supporter_until)
    : "Belum aktif";

  return [
    "⭐ Supporter",
    "",
    "Status: " + status,
    "",
    "Supporter Pass adalah dukungan opsional. Semua fitur inti BMP Terbuka tetap gratis.",
    "",
    "Benefit:",
    "• DM bot + AI support unlimited",
    "• priority support",
    "• konteks troubleshooting sampai 6 turn / 6 jam",
    "• tag BMP Supporter di grup bila permission Telegram mendukung",
    "• Supporter Wall opsional",
    "• bonus target aktivasi +" + SUPPORTER_ACTIVATION_BONUS_DAYS + " hari, maksimum " + SUPPORTER_ACTIVATION_MAX_DAYS + " hari"
  ].join("\n");
}

export async function sendSupporterMenu(
  env,
  message,
  access = null,
  messageId = null
) {
  if (isPrivateChat(message)) {
    return await renderMenu(env, {
      chatId: message.chat.id,
      userId: message.from?.id,
      messageId,
      text: supportMenuText(access),
      replyMarkup: {
        inline_keyboard: [
          [{text: "⭐ Paket & Benefit", callback_data: "support:packages"}],
          [
            {text: "👤 Status Saya", callback_data: "support:status"},
            {text: "🏆 Supporter Wall", callback_data: "support:wall"}
          ],
          [
            {text: "💳 Bantuan Pembayaran", callback_data: "support:payment"},
            {text: "📄 Terms", callback_data: "support:terms"}
          ],
          [{text: "◀ Menu Utama", callback_data: "menu:main"}]
        ]
      }
    });
  }

  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: "⭐ Supporter Pass tersedia mulai 2 Stars. Status, paket, dan pembayaran dibuka lewat DM bot.",
    reply_parameters: {message_id: message.message_id},
    reply_markup: {
      inline_keyboard: [[{text: "Buka Supporter", url: supporterDeepLink(env)}]]
    },
    disable_web_page_preview: true
  });
}

export async function sendSupporterPackages(
  env,
  chatId,
  userId,
  messageId = null
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "⭐ Paket Supporter",
      "",
      "• 2 ⭐ — 1 hari",
      "• 50 ⭐ — 30 hari",
      "",
      "Pembelian one-time, bukan subscription otomatis.",
      "Tekan paket untuk melihat konfirmasi sebelum invoice dibuat."
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{text: "⭐ 2 Stars — 1 Hari", callback_data: "support:select:day"}],
        [{text: "⭐ 50 Stars — 30 Hari", callback_data: "support:select:month"}],
        [{text: "◀ Supporter", callback_data: "menu:supporter"}]
      ]
    }
  });
}

export async function sendSupporterStatusPanel(
  env,
  chatId,
  userId,
  messageId = null
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: await supporterStatusText(env, userId),
    replyMarkup: {
      inline_keyboard: [
        [{text: "◀ Supporter", callback_data: "menu:supporter"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}

export async function sendSupporterWallPanel(
  env,
  chatId,
  userId,
  messageId = null
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: await supporterWallText(env),
    replyMarkup: {
      inline_keyboard: [
        [
          {text: "Public", callback_data: "support:wall:public"},
          {text: "Anonymous", callback_data: "support:wall:anonymous"},
          {text: "Private", callback_data: "support:wall:private"}
        ],
        [{text: "◀ Supporter", callback_data: "menu:supporter"}]
      ]
    }
  });
}

export async function sendSupporterPaymentPanel(
  env,
  chatId,
  userId,
  messageId = null
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "💳 Bantuan Pembayaran",
      "",
      "Kalau pembayaran Telegram Stars berhasil tetapi Supporter belum aktif, jangan bayar ulang.",
      "",
      "Kirim:",
      "/paysupport diikuti penjelasan singkat masalah.",
      "",
      "Jangan kirim password, OTP, token, cookie, atau data kartu."
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{text: "◀ Supporter", callback_data: "menu:supporter"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}

export function supporterTermsText() {
  return [
    "📄 BMP Supporter Pass — Terms",
    "",
    "1. Supporter Pass adalah dukungan digital opsional. Semua fitur inti BMP Terbuka tetap gratis.",
    "2. Paket saat ini: 2 Stars / 1 hari dan 50 Stars / 30 hari. Keduanya one-time, bukan subscription otomatis.",
    "3. Masa Supporter ditambahkan dari masa Supporter yang masih aktif, atau dari waktu pembayaran jika sebelumnya tidak aktif.",
    "4. Bonus masa aktivasi Supporter tersedia mulai BMP Terbuka v1.1.0. Setiap pembayaran memberi +" + SUPPORTER_ACTIVATION_BONUS_DAYS + " hari masa aktivasi, dengan batas maksimum " + SUPPORTER_ACTIVATION_MAX_DAYS + " hari. Pada v1.1.0 atau lebih baru, bonus dapat diterapkan melalui pembaruan aktivasi tanpa menunggu token lama kedaluwarsa.",
    "5. Benefit Supporter: DM bot + AI unlimited, priority support, konteks troubleshooting lebih panjang, tag grup bila permission Telegram mendukung, dan Supporter Wall opsional.",
    "6. Layanan AI/Telegram dapat mengalami gangguan sementara. Penyalahgunaan, spam, atau pelanggaran keamanan tetap dapat dibatasi.",
    "7. Untuk masalah transaksi atau refund, gunakan /paysupport. Telegram Support/Bot Support bukan pihak yang menangani pembelian Supporter Pass ini.",
    "",
    "Dengan menekan tombol Saya setuju & bayar, kamu mengonfirmasi telah membaca dan menyetujui terms ini."
  ].join("\n");
}

export async function sendSupporterTermsPanel(
  env,
  chatId,
  userId,
  messageId = null
) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: supporterTermsText(),
    replyMarkup: {
      inline_keyboard: [
        [{text: "◀ Supporter", callback_data: "menu:supporter"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}

export async function sendSupporterPackageConfirmation(
  env,
  userId,
  chatId,
  packageId,
  messageId = null
) {
  const pkg = supporterPackage(packageId);
  if (!pkg) return;
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "⭐ " + pkg.title,
      "",
      pkg.stars + " Stars untuk " + pkg.days + " hari Supporter Pass.",
      "Termasuk bonus masa aktivasi +" + SUPPORTER_ACTIVATION_BONUS_DAYS + " hari (maks. " + SUPPORTER_ACTIVATION_MAX_DAYS + " hari). Pembaruan token tanpa menunggu masa aktif lama tersedia mulai BMP Terbuka v1.1.0.",
      "",
      "Baca Terms sebelum melanjutkan."
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{text: "📄 Baca Terms", callback_data: "support:terms"}],
        [{text: "✅ Saya setuju & bayar " + pkg.stars + " ⭐", callback_data: "support:buy:" + pkg.id}],
        [{text: "◀ Paket Supporter", callback_data: "support:packages"}]
      ]
    }
  });
}
