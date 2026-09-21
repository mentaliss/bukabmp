import {formatWibDateTime, supporterIsActive} from "../features/supporter-model.js";
import {supportAccessForUser} from "../features/supporter.js";
import {referralHomeState} from "../features/referral-service.js";
import {
  SUPPORT_AI_MAX_CALLS_PER_DAY,
  supportAiQuotaStatus
} from "../features/ai-support.js";
import {getActivationLedger} from "../data/d1/activation-ledger.js";
import {getUserById} from "../data/d1/users.js";
import {renderMenu} from "./ui.js";

function actorId(actor) {
  return String(actor?.id ?? actor ?? "").trim();
}

function usernameLine(actor) {
  const username = String(actor?.username || "").trim();
  return username ? "@" + username : "Tidak ada";
}

export async function sendAccountMenu(
  env,
  chatId,
  actor,
  messageId = null
) {
  const userId = actorId(actor);
  const access = await supportAccessForUser(env, userId);
  const supporter = access.supporter;
  const referral = await referralHomeState(env, userId);
  const activation = await getActivationLedger(env, userId).catch(() => ({
    available: false,
    activated: false,
    row: null
  }));
  const user = await getUserById(env, Number(userId)).catch(() => null);

  const supporterLine = supporterIsActive(supporter)
    ? "Aktif sampai " + formatWibDateTime(supporter.supporter_until)
    : "Belum aktif";

  const referralValid = referral.available && !referral.error
    ? Number(referral.qualifiedCount || 0)
    : 0;
  const referralReward = referral.available && !referral.error
    ? Number(referral.entitlementTotalDays || 0)
    : 0;

  const aiLine = access.privileged
    ? "Unlimited"
    : (() => null)();
  const quota = access.privileged
    ? null
    : await supportAiQuotaStatus(env, userId);

  let activationLines;
  if (!activation.available) {
    activationLines = [
      "Status            Belum tercatat",
      "Catatan           Akan tercatat pada aktivasi berikutnya setelah registry aktif"
    ];
  } else if (!activation.activated) {
    activationLines = [
      "Status            Belum pernah tercatat aktivasi",
      "Aktivasi pertama  —",
      "Aktivasi terakhir —"
    ];
  } else {
    activationLines = [
      "Status            Aktif/terdaftar",
      "Aktivasi pertama  " + formatWibDateTime(activation.row.first_activated_at),
      "Aktivasi terakhir " + formatWibDateTime(activation.row.last_activated_at),
      "Total aktivasi    " + Number(activation.row.activation_count || 0)
    ];
  }

  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "👤 Akun Saya",
      "",
      "User ID",
      userId,
      "",
      "Username saat ini",
      usernameLine(actor),
      "",
      "📚 Aktivasi",
      ...activationLines,
      "",
      "⭐ Supporter",
      supporterLine,
      "",
      "👥 Referral",
      "Referral valid    " + referralValid,
      "Reward referral   " + referralReward + " hari Supporter",
      "Direferensikan    " + (user?.referred_by ? "Ya" : "Tidak"),
      "",
      "🤖 AI",
      access.privileged
        ? "Kuota             " + aiLine
        : "Sisa hari ini     " + quota.remaining + "/" + SUPPORT_AI_MAX_CALLS_PER_DAY,
      "",
      "Username hanya dibaca dari update Telegram saat ini; User ID adalah identitas akun yang disimpan."
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [
          {text: "📚 Ekstensi", callback_data: "menu:extension"},
          {text: "⭐ Supporter", callback_data: "menu:supporter"}
        ],
        [
          {text: "👥 Referral", callback_data: "menu:referral"},
          {text: "🤖 Tanya AI", callback_data: "menu:ai"}
        ],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}
