import {tg} from "../telegram/api.js";
import {isPrivateChat, telegramBotUsername} from "../telegram/router.js";
import {
  SUPPORTER_ACTIVATION_BONUS_DAYS,
  SUPPORTER_ACTIVATION_MAX_DAYS,
  formatWibDateTime,
  supporterPackage
} from "../features/supporter-model.js";

export function supporterDeepLink(env) {
  return "https://t.me/" + telegramBotUsername(env) + "?start=support";
}

export function supportMenuText(access = null) {
  const lines = [
    "⭐ BMP Supporter Pass",
    "",
    "Semua fitur inti BMP Terbuka tetap gratis. Supporter Pass memberi benefit support tambahan:",
    "• DM bot + AI support unlimited",
    "• tag BMP Supporter di grup (jika bot punya izin Manage Tags)",
    "• priority support",
    "• konteks troubleshooting sampai 6 turn / 6 jam",
    "• Supporter Wall opsional",
    "• bonus masa aktivasi extension +14 hari saat token aktivasi berikutnya diterbitkan, maksimum 60 hari",
    "",
    "Paket:",
    "• 2 ⭐ — 1 hari",
    "• 50 ⭐ — 30 hari"
  ];
  if (access?.source === "supporter" && access.supporter) {
    lines.push("", "Supporter kamu aktif sampai " + formatWibDateTime(access.supporter.supporter_until) + ".");
  }
  return lines.join("\n");
}

export async function sendSupporterMenu(env, message, access = null) {
  if (isPrivateChat(message)) {
    await tg(env, "sendMessage", {
      chat_id: message.chat.id,
      text: supportMenuText(access),
      reply_markup: {
        inline_keyboard: [
          [{text: "⭐ 2 Stars — 1 Hari", callback_data: "support:select:day"}],
          [{text: "⭐ 50 Stars — 30 Hari", callback_data: "support:select:month"}],
          [{text: "◀ Menu Utama", callback_data: "menu:main"}]
        ]
      },
      disable_web_page_preview: true
    });
    return;
  }

  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: "⭐ Supporter Pass tersedia mulai 2 Stars. Aktivasi dan pembayaran dilakukan lewat DM bot.",
    reply_parameters: {message_id: message.message_id},
    reply_markup: {
      inline_keyboard: [[{text: "Buka Supporter Pass", url: supporterDeepLink(env)}]]
    },
    disable_web_page_preview: true
  });
}

export function supporterTermsText() {
  return [
    "📄 BMP Supporter Pass — Terms",
    "",
    "1. Supporter Pass adalah dukungan digital opsional. Semua fitur inti BMP Terbuka tetap gratis.",
    "2. Paket saat ini: 2 Stars / 1 hari dan 50 Stars / 30 hari. Keduanya one-time, bukan subscription otomatis.",
    "3. Masa Supporter ditambahkan dari masa Supporter yang masih aktif, atau dari waktu pembayaran jika sebelumnya tidak aktif.",
    "4. Setiap pembayaran Supporter memberi bonus target aktivasi extension +" + SUPPORTER_ACTIVATION_BONUS_DAYS + " hari, dengan batas maksimum " + SUPPORTER_ACTIVATION_MAX_DAYS + " hari. Karena extension v1.0.5 tidak di-update, token yang sudah tersimpan di perangkat tidak berubah; bonus diterapkan saat token aktivasi/verifikasi berikutnya diterbitkan.",
    "5. Benefit Supporter: DM bot + AI unlimited, priority support, konteks troubleshooting lebih panjang, tag grup bila permission Telegram mendukung, dan Supporter Wall opsional.",
    "6. Layanan AI/Telegram dapat mengalami gangguan sementara. Penyalahgunaan, spam, atau pelanggaran keamanan tetap dapat dibatasi.",
    "7. Untuk masalah transaksi atau refund, gunakan /paysupport. Telegram Support/Bot Support bukan pihak yang menangani pembelian Supporter Pass ini.",
    "",
    "Dengan menekan tombol Saya setuju & bayar, kamu mengonfirmasi telah membaca dan menyetujui terms ini."
  ].join("\n");
}

export async function sendSupporterPackageConfirmation(env, userId, chatId, packageId) {
  const pkg = supporterPackage(packageId);
  if (!pkg) return;
  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: [
      "⭐ " + pkg.title,
      "",
      pkg.stars + " Stars untuk " + pkg.days + " hari Supporter Pass.",
      "Termasuk bonus target aktivasi +" + SUPPORTER_ACTIVATION_BONUS_DAYS + " hari (maks. " + SUPPORTER_ACTIVATION_MAX_DAYS + " hari), diterapkan pada token aktivasi berikutnya jika token lama belum dapat diperbarui.",
      "",
      "Baca /terms sebelum melanjutkan."
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{text: "📄 Baca Terms", callback_data: "support:terms"}],
        [{text: "✅ Saya setuju & bayar " + pkg.stars + " ⭐", callback_data: "support:buy:" + pkg.id}],
        [{text: "◀ Supporter", callback_data: "menu:supporter"}]
      ]
    }
  });
}
