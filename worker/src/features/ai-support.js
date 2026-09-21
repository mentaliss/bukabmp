import {isAnonymousAdminMessage} from "../telegram/router.js";

const SUPPORT_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
export const SUPPORT_AI_MAX_CALLS_PER_DAY = 6;

export function supportActorId(message) {
  if (isAnonymousAdminMessage(message)) {
    return "anonymous-admin:" + String(
      message?.sender_chat?.id || message?.chat?.id || "unknown"
    );
  }
  return String(message?.from?.id || "unknown");
}

function supportDailyBucket() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return obj.year + "-" + obj.month + "-" + obj.day;
}

export async function supportAiQuotaStatus(env, userId) {
  if (!env.PAIRINGS) {
    return {count: 0, remaining: SUPPORT_AI_MAX_CALLS_PER_DAY};
  }
  const key = "support-ai-day:" + userId + ":" + supportDailyBucket();
  const count = Math.max(0, Number(await env.PAIRINGS.get(key) || 0));
  return {
    count,
    remaining: Math.max(0, SUPPORT_AI_MAX_CALLS_PER_DAY - count)
  };
}

export async function supportAiAllowed(env, userId) {
  if (!env.PAIRINGS) {
    return {allowed: true, count: 0, remaining: SUPPORT_AI_MAX_CALLS_PER_DAY};
  }
  const key = "support-ai-day:" + userId + ":" + supportDailyBucket();
  const current = await supportAiQuotaStatus(env, userId);
  if (current.count >= SUPPORT_AI_MAX_CALLS_PER_DAY) {
    return {allowed: false, count: current.count, remaining: 0};
  }
  const next = current.count + 1;
  await env.PAIRINGS.put(key, String(next), {expirationTtl: 48 * 60 * 60});
  return {
    allowed: true,
    count: next,
    remaining: Math.max(0, SUPPORT_AI_MAX_CALLS_PER_DAY - next)
  };
}

function textFromAiContent(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(part => {
      if (typeof part === "string") return part;
      if (typeof part?.text === "string") return part.text;
      if (typeof part?.content === "string") return part.content;
      return "";
    }).join("").trim();
  }
  return "";
}

function extractWorkersAiText(result) {
  if (!result) return "";
  if (typeof result === "string") return result.trim();

  const candidates = [
    result.response,
    result.text,
    result.output_text,
    result?.result?.response,
    result?.result?.text,
    result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.text,
    result?.result?.choices?.[0]?.message?.content,
    result?.result?.choices?.[0]?.text
  ];
  for (const value of candidates) {
    const text = textFromAiContent(value);
    if (text) return text;
  }
  return "";
}

export async function runSupportAi(
  env,
  {safeQuery, knowledge, priorContext = "", supporterPriority = false}
) {
  if (!env.AI || typeof env.AI.run !== "function") return "";

  const systemPrompt = [
    "Kamu adalah BMP Terbuka Assistant untuk support komunitas Telegram.",
    "Jawab dalam bahasa Indonesia yang ramah, ringkas, dan praktis ketika membahas BMP Terbuka.",
    "Jangan gunakan Markdown seperti **bold**, backtick, heading, atau tabel. Keluarkan plain text yang rapi untuk Telegram.",
    "Jangan melakukan small talk atau membahas topik di luar BMP Terbuka.",
    "Pahami maksud user walaupun bahasanya pendek, typo, slang, urutan katanya aneh, atau pertanyaannya tidak sama persis dengan judul knowledge base.",
    "Jawaban HARUS grounded pada knowledge base yang diberikan. Jangan mengarang fitur, kompatibilitas, status, atau solusi yang tidak tercantum.",
    "Gabungkan beberapa fakta jika pertanyaan menyentuh lebih dari satu hal.",
    "Kalau jawabannya sebenarnya ada di knowledge base, jawab langsung; jangan malah meminta screenshot.",
    "Minta screenshot + versi + platform + Kode BMP + modul hanya jika masalah spesifik memang belum bisa didiagnosis dari informasi user.",
    "Untuk pertanyaan ya/tidak, jawab ya/tidak dulu lalu beri penjelasan singkat.",
    "Jangan pernah meminta password, NIM, cookie, session/token, credential, atau materi privat.",
    "Jangan memberi instruksi bypass WAF/blokir, stealth, spoofing, penghapusan watermark, atau pelanggaran akses.",
    "Jangan mengaku sebagai admin manusia.",
    "Jika tutorial video bertanda v1.0.4, jangan menyebutnya sebagai tutorial v1.0.5.",
    "Untuk pertanyaan tentang resmi, afiliasi, kepemilikan, atau perwakilan, jangan menyebut atau mengulang nama instansi, perusahaan, organisasi, marketplace, kampus, brand, atau pihak lain yang disebut user. Jawab generik bahwa BMP Terbuka adalah proyek komunitas independen dan bukan produk resmi atau perwakilan pihak lain.",
    "Pengecualian: nama tools atau platform yang memang relevan secara teknis untuk menggunakan BMP Terbuka boleh disebut bila diperlukan, misalnya Chrome, Edge, Telegram, GitHub, dan Rose.",
    supporterPriority
      ? "User ini Supporter. Gunakan konteks troubleshooting sebelumnya bila relevan dan prioritaskan diagnosis yang nyambung, tanpa mengarang."
      : ""
  ].filter(Boolean).join("\n");

  const userPrompt = [
    "MODE_KB=" + knowledge.mode,
    "KNOWLEDGE BASE:",
    knowledge.text,
    priorContext ? "\nKONTEKS TROUBLESHOOTING SUPPORTER:\n" + priorContext : "",
    "",
    "PERTANYAAN USER:",
    safeQuery
  ].join("\n");

  const result = await env.AI.run(SUPPORT_AI_MODEL, {
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: userPrompt}
    ],
    reasoning_effort: null,
    chat_template_kwargs: {enable_thinking: false},
    max_completion_tokens: supporterPriority ? 650 : 500,
    temperature: 0.2
  });

  const answer = extractWorkersAiText(result).slice(
    0,
    supporterPriority ? 4500 : 3500
  );
  if (!answer) {
    console.warn("support_ai_empty_result", {
      model: SUPPORT_AI_MODEL,
      kb_mode: knowledge.mode,
      keys: result && typeof result === "object"
        ? Object.keys(result).slice(0, 12)
        : []
    });
  }
  return answer;
}
