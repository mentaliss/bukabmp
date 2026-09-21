import {supportAccessForUser} from "../features/supporter.js";
import {
  SUPPORT_AI_MAX_CALLS_PER_DAY,
  supportAiQuotaStatus
} from "../features/ai-support.js";
import {SUPPORT_GROUP_JOIN_URL} from "./help.js";
import {renderMenu} from "./ui.js";

function actorId(actor) {
  return String(actor?.id ?? actor ?? "").trim();
}

async function aiState(env, actor) {
  const userId = actorId(actor);
  const access = await supportAccessForUser(env, userId);
  const unlimited = Boolean(access.privileged);
  const quota = unlimited
    ? null
    : await supportAiQuotaStatus(env, userId);
  return {userId, access, unlimited, quota};
}

function aiKeyboard(unlimited) {
  const rows = [];
  if (unlimited) {
    rows.push([{text: "💬 Cara Tanya di DM", callback_data: "ai:prompt"}]);
  } else {
    rows.push([{text: "💬 Tanya di Group Terbuka", url: SUPPORT_GROUP_JOIN_URL}]);
  }
  rows.push([{text: "📊 Cek Kuota AI", callback_data: "ai:quota"}]);
  rows.push([{text: "◀ Menu Utama", callback_data: "menu:main"}]);
  return {inline_keyboard: rows};
}

export async function sendAiMenu(env, chatId, actor, messageId = null) {
  const state = await aiState(env, actor);
  const accessText = state.unlimited
    ? state.access.source === "supporter"
      ? "Akses kamu: unlimited selama Supporter aktif."
      : "Akses kamu: unlimited."
    : "Akses reguler: AI digunakan di Group Terbuka, maksimal " +
      SUPPORT_AI_MAX_CALLS_PER_DAY + " pertanyaan AI per hari.";

  return await renderMenu(env, {
    chatId,
    userId: state.userId,
    messageId,
    text: [
      "🤖 Tanya AI",
      "",
      "Gunakan AI untuk kendala penggunaan BMP Terbuka: OCR, modul, PDF, resume, storage, instalasi, aktivasi, dan troubleshooting.",
      "",
      accessText,
      "",
      "Contoh pertanyaan:",
      "• Kenapa proses berhenti di M4?",
      "• PDF M3 hilang, perlu OCR ulang?",
      "• Cara merge M2–M7?",
      "• Kode BMP ambil dari mana?"
    ].join("\n"),
    replyMarkup: aiKeyboard(state.unlimited)
  });
}

export async function sendAiPrompt(env, chatId, actor, messageId = null) {
  const state = await aiState(env, actor);
  if (!state.unlimited) {
    return await sendAiMenu(env, chatId, actor, messageId);
  }

  return await renderMenu(env, {
    chatId,
    userId: state.userId,
    messageId,
    text: [
      "🤖 Tanya AI di DM",
      "",
      "Kirim pertanyaan kamu sebagai pesan berikutnya.",
      "Boleh sertakan screenshot + penjelasan singkat kalau sedang troubleshooting.",
      "",
      "Jangan kirim password, NIM, cookie, token, OTP, atau credential lain.",
      "",
      "Shortcut tetap tersedia: /ask pertanyaan"
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{text: "📊 Cek Kuota AI", callback_data: "ai:quota"}],
        [{text: "◀ Tanya AI", callback_data: "menu:ai"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}

export async function sendAiQuotaPanel(env, chatId, actor, messageId = null) {
  const state = await aiState(env, actor);
  const text = state.unlimited
    ? "📊 Kuota AI\n\nKuota AI kamu: unlimited."
    : [
        "📊 Kuota AI",
        "",
        "Terpakai hari ini: " + state.quota.count + "/" + SUPPORT_AI_MAX_CALLS_PER_DAY,
        "Sisa: " + state.quota.remaining,
        "",
        "Jawaban FAQ yang bisa dijawab langsung dari basis pengetahuan tidak selalu memakai kuota AI."
      ].join("\n");

  return await renderMenu(env, {
    chatId,
    userId: state.userId,
    messageId,
    text,
    replyMarkup: {
      inline_keyboard: [
        [{text: "◀ Tanya AI", callback_data: "menu:ai"}],
        [{text: "◀ Menu Utama", callback_data: "menu:main"}]
      ]
    }
  });
}
