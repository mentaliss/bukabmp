import {tg} from "../telegram/api.js";
import {auditErrorName} from "./audit.js";
import {isNormalBotMessage, isOfficialSupportGroup} from "../telegram/router.js";

const PRIVACY_WARNING_TEXT = "Pesan tadi dihapus karena terdeteksi mengandung data pribadi atau kredensial. Kirim ulang setelah bagian sensitif disamarkan.";

function privacyText(message) {
  return [
    String(message?.text || ""),
    String(message?.caption || ""),
    String(message?.document?.file_name || "")
  ].filter(Boolean).join("\n").trim();
}

function hasContextualNumber(text, labels, minDigits, maxDigits) {
  const normalized = String(text || "").toLowerCase();
  const labelPattern = labels.map(value => value.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")).join("|");
  const lower = Math.max(0, minDigits - 2);
  const upper = maxDigits + 8;
  const re = new RegExp(
    "(?:" + labelPattern + ")\\s*(?:saya|aku|gue|gw|adalah|:|=|-)?\\s*([+]?\\d[\\d\\s().-]{" + lower + "," + upper + "}\\d)",
    "i"
  );
  const match = normalized.match(re);
  if (!match) return false;
  const digits = String(match[1] || "").replace(/\D/g, "");
  return digits.length >= minDigits && digits.length <= maxDigits;
}

export function detectSensitiveContent(message) {
  if (message?.contact) return {blocked: true, kind: "contact"};
  if (message?.location || message?.venue) return {blocked: true, kind: "location"};

  const raw = privacyText(message);
  if (!raw) return {blocked: false};
  const text = raw.normalize("NFKC");

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
    return {blocked: true, kind: "email"};
  }

  const credentialPatterns = [
    /\b(?:password|passwd|pwd|kata\s*sandi)\s*(?:saya|aku|gue|gw|adalah|:|=|-)\s*[^\s,;]{4,}/i,
    /\b(?:cookie|session(?:_?id)?|access[_ -]?token|refresh[_ -]?token|api[_ -]?key|secret[_ -]?key)\s*(?:saya|aku|gue|gw|adalah|:|=|-)\s*[^\s,;]{8,}/i,
    /\bbearer\s+[A-Za-z0-9._~+\/-]{12,}/i,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    /\b(?:otp|pin)\s*(?:saya|aku|gue|gw|adalah|:|=|-)\s*\d{4,8}\b/i
  ];
  if (credentialPatterns.some(re => re.test(text))) {
    return {blocked: true, kind: "credential"};
  }

  if (hasContextualNumber(text, ["nim", "nomor induk mahasiswa"], 6, 18)) {
    return {blocked: true, kind: "nim"};
  }
  if (hasContextualNumber(text, ["nik", "no nik", "nomor nik", "ktp", "no ktp", "nomor ktp"], 16, 16)) {
    return {blocked: true, kind: "nik"};
  }
  if (hasContextualNumber(text, ["wa", "whatsapp", "no wa", "nomor wa", "hp", "no hp", "nomor hp", "telepon", "telp", "phone"], 9, 15)) {
    return {blocked: true, kind: "phone"};
  }

  return {blocked: false};
}

export async function handlePrivacyGate(env, message) {
  if (!isOfficialSupportGroup(env, message)) return false;
  if (isNormalBotMessage(message)) return false;

  const detection = detectSensitiveContent(message);
  if (!detection.blocked) return false;

  let deleted = false;
  try {
    await tg(env, "deleteMessage", {
      chat_id: message.chat.id,
      message_id: message.message_id
    });
    deleted = true;
  } catch (error) {
    console.error("privacy_delete_failed", {
      update_message_id: message?.message_id || null,
      kind: detection.kind || "unknown",
      error_name: auditErrorName(error)
    });
  }

  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: deleted
      ? PRIVACY_WARNING_TEXT
      : "Pesan terdeteksi mengandung data pribadi atau kredensial dan tidak diproses bot. Mohon hapus pesan tersebut lalu kirim ulang setelah bagian sensitif disamarkan.",
    disable_web_page_preview: true
  }).catch(() => {});

  return true;
}
