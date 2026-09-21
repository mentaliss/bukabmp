import {referralHomeState} from "../features/referral-service.js";
import {d1ActivationLedgerEnabled} from "../data/d1/mode.js";
import {renderMenu} from "./ui.js";

const REWARD_ROWS = [
  "1 referral  → 2 hari",
  "2 referral  → 4 hari",
  "3 referral  → 7 hari",
  "4 referral  → 9 hari",
  "5–9         → 12 hari",
  "10–19       → 20 hari",
  "20–29       → 40 hari",
  "30           → 60 hari",
  ">30          → jumlah referral × 2 hari"
];

function nextReward(count) {
  if (count < 1) return "1 referral → 2 hari";
  if (count < 2) return "2 referral → 4 hari";
  if (count < 3) return "3 referral → 7 hari";
  if (count < 4) return "4 referral → 9 hari";
  if (count < 5) return "5 referral → 12 hari";
  if (count < 10) return "10 referral → 20 hari";
  if (count < 20) return "20 referral → 40 hari";
  if (count < 30) return "30 referral → 60 hari";
  return (count + 1) + " referral → " + ((count + 1) * 2) + " hari";
}

function shareUrl(link) {
  const text = "Coba BMP Terbuka lewat link referral saya.";
  return "https://t.me/share/url?url=" +
    encodeURIComponent(link) +
    "&text=" + encodeURIComponent(text);
}

export async function sendReferralMenu(
  env,
  chatId,
  userId,
  messageId = null
) {
  const state = await referralHomeState(env, userId);

  if (!state.available || state.error) {
    return await renderMenu(env, {
      chatId,
      userId,
      messageId,
      text: "👥 Referral\n\nStatus referral belum dapat dimuat.",
      replyMarkup: {
        inline_keyboard: [[{text: "◀ Menu Utama", callback_data: "menu:main"}]]
      }
    });
  }

  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "👥 Referral Saya",
      "",
      "Ajak pengguna baru BMP Terbuka dan dapatkan masa Supporter gratis.",
      "",
      "Progress",
      "Referral valid     " + state.qualifiedCount,
      "Reward saat ini    " + state.entitlementTotalDays + " hari Supporter",
      "Target berikutnya  " + nextReward(state.qualifiedCount),
      "",
      "Link referral kamu:",
      state.link,
      "",
      "Referral baru dihitung setelah user memenuhi syarat dan berhasil melakukan aktivasi yang eligible."
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{text: "🔗 Bagikan Link", url: shareUrl(state.link)}],
        [
          {text: "🎁 Daftar Reward", callback_data: "ref:rewards"},
          {text: "📋 Syarat Referral", callback_data: "ref:rules"}
        ],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}

export async function sendReferralRewards(
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
      "🎁 Reward Referral",
      "",
      "Reward adalah total entitlement referral, bukan bonus milestone yang ditumpuk satu per satu.",
      "",
      ...REWARD_ROWS,
      "",
      "Reward diberikan kepada pengundang."
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{text: "◀ Referral Saya", callback_data: "menu:referral"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}

export async function sendReferralRules(
  env,
  chatId,
  userId,
  messageId = null
) {
  const ledgerOn = d1ActivationLedgerEnabled(env);
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "📋 Syarat Referral",
      "",
      "Referral valid jika orang yang kamu ajak:",
      "1. Belum tercatat pernah melakukan aktivasi BMP.",
      "2. Membuka bot melalui link referral kamu.",
      "3. Bergabung ke Buka BMP + Group Terbuka.",
      "4. Berhasil melakukan aktivasi BMP.",
      "",
      "Aturan:",
      "• Satu akun hanya bisa terikat ke satu referrer.",
      "• Referrer pertama yang tercatat tidak bisa diganti.",
      "• Referral diri sendiri tidak berlaku.",
      "• Aktivasi ulang tidak menghasilkan referral baru.",
      "• Reward diberikan kepada pengundang.",
      "",
      ledgerOn
        ? "Registry aktivasi: aktif."
        : "Registry aktivasi baru belum aktif di environment ini; user legacy akan mulai tercatat saat registry diaktifkan dan mereka melakukan aktivasi berikutnya."
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{text: "◀ Referral Saya", callback_data: "menu:referral"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}
