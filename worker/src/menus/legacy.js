import {tg} from "../telegram/api.js";
import {telegramBotUsername, isPrivateChat} from "../telegram/router.js";
import {
  SUPPORTER_ACTIVATION_BONUS_DAYS,
  SUPPORTER_ACTIVATION_MAX_DAYS,
  SUPPORTER_CONTEXT_MAX_TURNS,
  formatWibDateTime,
  supporterIsActive,
  supporterPackage
} from "../features/supporter-model.js";
import {supportAccessForUser} from "../features/supporter.js";
import {referralHomeState} from "../features/referral-service.js";

export function legacyMenuDeepLink(env) {
  return "https://t.me/" + telegramBotUsername(env) + "?start=menu";
}

export function legacyMainMenuKeyboard() {
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

export async function sendLegacyMainMenu(env, chatId) {
  return await tg(env, "sendMessage", {
    chat_id: chatId,
    text: "BMP Terbuka\n\nPilih menu:",
    reply_markup: legacyMainMenuKeyboard(),
    disable_web_page_preview: true
  });
}

export async function sendLegacyAccountMenu(env, chatId, userId) {
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

export async function sendLegacyReferralMenu(env, chatId, userId) {
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

function legacySupportHelpText(access = null) {
  const privileged = Boolean(access?.privileged);
  const supporter = access?.source === "supporter";
  const accessLine = supporter
    ? "⭐ Supporter aktif: DM + Group, AI unlimited, priority support, dan konteks troubleshooting sampai " + SUPPORTER_CONTEXT_MAX_TURNS + " turn / 6 jam."
    : privileged
      ? "Akun khusus: support aktif di DM + Group Terbuka, dengan kuota AI unlimited."
      : "Support tersedia di Group Terbuka. Kuota AI support maksimal 6 pertanyaan per hari per user. Command dan FAQ yang bisa dijawab langsung tidak memakai kuota AI.";

  return [
    "🤖 BMP Terbuka Assistant",
    "",
    privileged
      ? "Kamu bisa bertanya langsung lewat DM, atau di Group Terbuka gunakan /ask, mention @bukabmp_bot, atau reply pesan bot."
      : "Di Group Terbuka gunakan /ask, mention @bukabmp_bot, atau reply pesan bot.",
    "",
    accessLine,
    "",
    "Command cepat:",
    "/bmphelp — menu bantuan bot",
    "/tutorial — cara pakai v1.0.5",
    "/install — instalasi Android/Desktop",
    "/android — Android + tutorial",
    "/desktop — Desktop + tutorial",
    "/group — cara join Group Terbuka",
    "/update — versi terbaru",
    "/fitur — fitur v1.0.5",
    "/storage — penyimpanan/resume/export",
    "/bug — format laporan kendala",
    "/quota — cek sisa kuota AI hari ini",
    "/support — Supporter Pass via Telegram Stars",
    "/supporter — status/Supporter Wall",
    "/supporters — lihat Supporter Wall",
    "/terms — terms Supporter Pass",
    "/paysupport — bantuan pembayaran",
    "",
    "Untuk rules group, ketik /rules (Rose)."
  ].join("\n");
}

export async function sendLegacyHelpPanel(env, chatId, access = null) {
  return await tg(env, "sendMessage", {
    chat_id: chatId,
    text: legacySupportHelpText(access),
    reply_markup: {
      inline_keyboard: [[{text: "◀ Menu Utama", callback_data: "menu:main"}]]
    },
    disable_web_page_preview: true
  });
}

export async function sendLegacyActivationMenu(env, chatId) {
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

export function legacySupportMenuText(access = null) {
  const lines = [
    "⭐ BMP Supporter Pass",
    "",
    "Semua fitur inti BMP Terbuka tetap gratis. Supporter Pass memberi benefit support tambahan:",
    "• DM bot + AI support unlimited",
    "• tag BMP Supporter di grup (jika bot punya izin Manage Tags)",
    "• priority support",
    "• konteks troubleshooting sampai 6 turn / 6 jam",
    "• Supporter Wall opsional",
    "• bonus masa aktivasi extension +" + SUPPORTER_ACTIVATION_BONUS_DAYS + " hari saat token aktivasi berikutnya diterbitkan, maksimum " + SUPPORTER_ACTIVATION_MAX_DAYS + " hari",
    "",
    "Paket:",
    "• 2 ⭐ — 1 hari",
    "• 50 ⭐ — 30 hari"
  ];
  if (access?.source === "supporter" && access.supporter) {
    lines.push(
      "",
      "Supporter kamu aktif sampai " +
        formatWibDateTime(access.supporter.supporter_until) + "."
    );
  }
  return lines.join("\n");
}

export async function sendLegacySupporterMenu(
  env,
  message,
  access = null
) {
  if (isPrivateChat(message)) {
    await tg(env, "sendMessage", {
      chat_id: message.chat.id,
      text: legacySupportMenuText(access),
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
      inline_keyboard: [[{
        text: "Buka Supporter Pass",
        url: "https://t.me/" + telegramBotUsername(env) + "?start=support"
      }]]
    },
    disable_web_page_preview: true
  });
}

export async function sendLegacySupporterPackageConfirmation(
  env,
  userId,
  chatId,
  packageId
) {
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
        [{
          text: "✅ Saya setuju & bayar " + pkg.stars + " ⭐",
          callback_data: "support:buy:" + pkg.id
        }],
        [{text: "◀ Supporter", callback_data: "menu:supporter"}]
      ]
    }
  });
}
