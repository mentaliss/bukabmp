import {tg} from "./telegram/api.js";
import {
  configuredTelegramChatMatches,
  isAnonymousAdminMessage,
  isGroupChat,
  isNormalBotMessage,
  isOfficialSupportGroup,
  isPrivateChat,
  parseBotCommand,
  supportInvocation,
  telegramBotUsername
} from "./telegram/router.js";
import {parseTelegramCallback} from "./telegram/callbacks.js";
import {supportPrivilegedUserIds} from "./security/permissions.js";
import {b64url, b64urlJson, importSigningKey, randomToken, sha256Hex} from "./security/crypto.js";
import {checkPairRateLimit} from "./security/rate-limit.js";
import {telegramWebhookAuthorized} from "./security/webhook-auth.js";
import {claimTelegramUpdate} from "./security/idempotency.js";
import {handlePrivacyGate} from "./security/privacy-gate.js";
import {
  SUPPORT_GROUP_JOIN_URL,
  androidHelpText,
  bugReportText,
  desktopHelpText,
  featuresText,
  groupHelpText,
  installText,
  storageText,
  supportHelpText,
  tutorialText,
  updateHelpText
} from "./menus/help.js";
import {
  sendSupporterMenu,
  sendSupporterPackageConfirmation,
  supporterDeepLink,
  supporterTermsText
} from "./menus/supporter.js";
import {
  SUPPORTER_ACTIVATION_BONUS_DAYS,
  SUPPORTER_ACTIVATION_MAX_DAYS,
  SUPPORTER_CONTEXT_MAX_TURNS,
  SUPPORTER_CONTEXT_TTL_SECONDS,
  SUPPORTER_MEMBER_TAG,
  formatWibDateTime,
  parseSupportInvoicePayload,
  supporterContextKey,
  supporterEntitlementKey,
  supporterInvoiceKey,
  supporterIsActive,
  supporterPackage,
  supporterPaymentKey,
  supporterWallKey
} from "./features/supporter-model.js";
import {getSupporterEntitlement, putSupporterEntitlement} from "./data/supporter.js";
import {PAIR_TTL_SECONDS, TOKEN_TTL_DAYS, verifyPairForUser} from "./features/activation.js";
import {
  applySuccessfulSupporterPayment,
  handleSupporterPreCheckout,
  reconcileSupporterTagOnMessage,
  sendSupporterInvoice
} from "./features/payment.js";

const APP_VERSION = "1.0.5-support-bot-v12-sponsor-surface";
const TOKEN_ISSUER = "bmp-terbuka-community";
const TOKEN_AUDIENCE = "bmp-terbuka-extension";
const VERSION_CHECK_AFTER_SECONDS = 24 * 60 * 60;
const REVIEWER_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const CLOUD_STATE_DEFAULT_TTL_SECONDS = 5 * 60;
const DISTRIBUTION_CHANNELS = Object.freeze(["github", "android", "cws", "edge"]);
const SUPPORT_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const SUPPORT_AI_MAX_INPUT_CHARS = 1400;
const SUPPORT_AI_MAX_CALLS_PER_DAY = 6;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra
    }
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

async function supportAccessForUser(env, userId) {
  const id = String(userId || "").trim();
  if (!id) return {privileged: false, source: null, supporter: null};
  if (supportPrivilegedUserIds(env).has(id)) {
    return {privileged: true, source: "allowlist", supporter: await getSupporterEntitlement(env, id)};
  }
  const supporter = await getSupporterEntitlement(env, id);
  if (supporterIsActive(supporter)) {
    return {privileged: true, source: "supporter", supporter};
  }
  return {privileged: false, source: null, supporter};
}

async function supportPrivilegeForMessage(env, message) {
  if (isAnonymousAdminMessage(message)) {
    return {privileged: false, source: null, supporter: null};
  }
  return await supportAccessForUser(env, message?.from?.id);
}

async function handlePaymentSupportCommand(env, message, details = "") {
  if (!isPrivateChat(message)) {
    await sendSupportReply(env, message, "Untuk masalah pembayaran Supporter Pass, kirim /paysupport lewat DM bot supaya detail transaksi tidak dibahas di grup.");
    return;
  }
  const clean = redactSensitiveSupportText(String(details || "").trim()).slice(0, 1800);
  if (!clean) {
    await tg(env, "sendMessage", {
      chat_id: message.chat.id,
      text: [
        "💳 Payment Support",
        "",
        "Kirim /paysupport diikuti penjelasan masalah pembayaran. Contoh:",
        "/paysupport pembayaran berhasil tapi Supporter belum aktif",
        "",
        "Jangan kirim password, OTP, token, cookie, atau data kartu. Telegram Support/Bot Support tidak menangani transaksi Supporter Pass ini; pengelola BMP Terbuka yang memprosesnya."
      ].join("\n")
    });
    return;
  }

  const ownerIds = [...supportPrivilegedUserIds(env)].slice(0, 3);
  let delivered = 0;
  for (const ownerId of ownerIds) {
    try {
      await tg(env, "sendMessage", {
        chat_id: Number(ownerId),
        text: [
          "💳 Supporter Payment Support",
          `User ID: ${message.from?.id}`,
          message.from?.username ? `Username: @${message.from.username}` : "",
          "",
          clean
        ].filter(Boolean).join("\n")
      });
      delivered++;
    } catch {}
  }
  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: delivered
      ? "✅ Laporan payment support sudah diteruskan ke pengelola BMP Terbuka."
      : "⚠️ Kontak payment support belum terkonfigurasi. Gunakan Group Terbuka untuk menghubungi pengelola tanpa membagikan detail transaksi sensitif."
  });
}

async function supporterContext(env, userId, chatId) {
  if (!env.PAIRINGS || !userId || !chatId) return [];
  const record = await env.PAIRINGS.get(supporterContextKey(userId, chatId), "json");
  return Array.isArray(record?.turns) ? record.turns.slice(-SUPPORTER_CONTEXT_MAX_TURNS) : [];
}

async function rememberSupporterTurn(env, userId, chatId, query, answer) {
  if (!env.PAIRINGS || !userId || !chatId || !query || !answer) return;
  const turns = await supporterContext(env, userId, chatId);
  turns.push({
    q: redactSensitiveSupportText(String(query)).slice(0, 1200),
    a: redactSensitiveSupportText(String(answer)).slice(0, 2500),
    at: Date.now()
  });
  await env.PAIRINGS.put(supporterContextKey(userId, chatId), JSON.stringify({turns: turns.slice(-SUPPORTER_CONTEXT_MAX_TURNS)}), {
    expirationTtl: SUPPORTER_CONTEXT_TTL_SECONDS
  });
}

function formatSupporterContext(turns) {
  if (!Array.isArray(turns) || !turns.length) return "";
  return turns.map((t, i) => `Turn ${i + 1}\nUser: ${t.q}\nBot: ${t.a}`).join("\n\n").slice(-6000);
}

async function supporterStatusText(env, userId) {
  const access = await supportAccessForUser(env, userId);
  if (access.source === "allowlist" && !supporterIsActive(access.supporter)) {
    return "Akun khusus aktif: DM + Group + AI unlimited. Supporter Pass berbayar belum aktif.";
  }
  const record = access.supporter;
  if (!supporterIsActive(record)) {
    return "Supporter Pass belum aktif. Ketik /support untuk melihat paket 2 ⭐ / 1 hari atau 50 ⭐ / 30 hari.";
  }
  return [
    "⭐ BMP Supporter aktif",
    `Berlaku sampai: ${formatWibDateTime(record.supporter_until)}`,
    "DM + AI unlimited: aktif",
    "Priority support: aktif",
    `Konteks troubleshooting: ${SUPPORTER_CONTEXT_MAX_TURNS} turn / 6 jam`,
    `Supporter Wall: ${record.wall_mode || "private"}`,
    Number(record.activation_until || 0) > Date.now()
      ? `Target aktivasi extension: ${formatWibDateTime(record.activation_until)}`
      : Number(record.activation_bonus_pending_days || 0) > 0
        ? `Bonus aktivasi tertunda: +${record.activation_bonus_pending_days} hari` 
        : "Bonus aktivasi tertunda: tidak ada"
  ].join("\n");
}

async function setSupporterWallMode(env, message, mode) {
  const userId = String(message?.from?.id || "");
  const record = await getSupporterEntitlement(env, userId);
  if (!supporterIsActive(record)) {
    await sendSupportReply(env, message, "Supporter Pass belum aktif. Ketik /support untuk melihat paket.");
    return;
  }
  const normalized = ["public", "anonymous", "private"].includes(mode) ? mode : "private";
  record.wall_mode = normalized;
  record.username = String(message?.from?.username || record.username || "");
  record.first_name = String(message?.from?.first_name || record.first_name || "");
  await putSupporterEntitlement(env, userId, record);
  if (normalized === "private") {
    if (env.PAIRINGS.delete) await env.PAIRINGS.delete(supporterWallKey(userId)).catch(() => {});
  } else {
    await env.PAIRINGS.put(supporterWallKey(userId), JSON.stringify({
      user_id: userId,
      mode: normalized,
      username: record.username || "",
      first_name: record.first_name || "",
      supporter_until: record.supporter_until
    }));
  }
  await sendSupportReply(env, message, `Supporter Wall diatur ke: ${normalized}.`);
}

async function supporterWallText(env) {
  if (!env.PAIRINGS?.list) return "Supporter Wall belum tersedia pada binding KV ini.";
  const listed = await env.PAIRINGS.list({prefix: "supporter-wall:", limit: 100});
  const values = await Promise.all((listed.keys || []).map(k => env.PAIRINGS.get(k.name, "json")));
  const active = values
    .filter(Boolean)
    .filter(x => Number(x.supporter_until || 0) > Date.now())
    .slice(0, 50);
  if (!active.length) return "⭐ Supporter Wall\n\nBelum ada supporter yang memilih tampil di wall.";
  const names = active.map((x, i) => {
    if (x.mode === "anonymous") return `${i + 1}. Anonymous Supporter`;
    if (x.username) return `${i + 1}. @${x.username}`;
    return `${i + 1}. ${String(x.first_name || "Supporter").slice(0, 40)}`;
  });
  return ["⭐ Supporter Wall", "", ...names].join("\n");
}


function normalizeSupportQuery(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUPPORT_AI_MAX_INPUT_CHARS);
}

function redactSensitiveSupportText(value) {
  return normalizeSupportQuery(value)
    .replace(/\b(password|passwd|kata\s*sandi)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/\b(cookie|session|bearer|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
}

const SUPPORT_KB = [
  {
    "id": "about",
    "title": "Apa itu BMP Terbuka",
    "aliases": [
      "apa itu bmp terbuka",
      "bmp terbuka itu apa",
      "fungsi bmp terbuka"
    ],
    "keywords": [
      "bmp terbuka",
      "fungsi"
    ],
    "answer": "BMP Terbuka adalah extension komunitas independen untuk membantu mengubah materi BMP yang memang sudah bisa kamu akses menjadi searchable PDF untuk belajar pribadi/offline. OCR dan penyusunan PDF dilakukan lokal di perangkat."
  },
  {
    "id": "independent",
    "title": "Apakah resmi dari UT",
    "aliases": [
      "produk resmi ut",
      "resmi dari ut",
      "afiliasi ut"
    ],
    "keywords": [
      "resmi",
      "afiliasi",
      "universitas terbuka"
    ],
    "answer": "BMP Terbuka adalah proyek komunitas independen dan bukan produk resmi atau perwakilan pihak lain."
  },
  {
    "id": "supported-site",
    "title": "Website yang didukung",
    "aliases": [
      "bisa untuk web lain",
      "website lain",
      "situs lain",
      "selain pustaka ut",
      "selain rbv"
    ],
    "keywords": [
      "web lain",
      "website",
      "situs",
      "rbv",
      "pustaka"
    ],
    "answer": "Saat ini BMP Terbuka hanya punya adapter untuk reader RBV di https://pustaka.ut.ac.id/reader/. Belum ada dukungan untuk website/reader lain."
  },
  {
    "id": "rbv-only",
    "title": "Harus di halaman RBV",
    "aliases": [
      "ekstensi ga jalan",
      "extension tidak jalan",
      "tombol ga jalan",
      "tidak bereaksi",
      "belum buka rbv"
    ],
    "keywords": [
      "ekstensi ga jalan",
      "extension ga jalan",
      "pustaka ut",
      "rbv",
      "reader"
    ],
    "answer": "Sebelum mulai, buka/login ke reader RBV yang didukung di pustaka.ut.ac.id/reader/ pada tab aktif. Kalau extension dijalankan saat belum berada di reader yang didukung, proses tidak bisa mengambil modul."
  },
  {
    "id": "normal-login",
    "title": "Harus login normal",
    "aliases": [
      "harus login",
      "perlu login",
      "login dulu"
    ],
    "keywords": [
      "login",
      "akun"
    ],
    "answer": "Iya. Gunakan akunmu sendiri dan login ke portal/reader melalui mekanisme normal. BMP Terbuka tidak menyediakan bypass akses."
  },
  {
    "id": "internet",
    "title": "Perlu internet",
    "aliases": [
      "butuh internet",
      "offline bisa",
      "tanpa internet"
    ],
    "keywords": [
      "internet",
      "offline"
    ],
    "answer": "Internet tetap diperlukan saat membuka sumber/RBV dan saat aktivasi komunitas. OCR/PDF dikerjakan lokal setelah halaman sumber berhasil diambil."
  },
  {
    "id": "ocr-local",
    "title": "OCR lokal",
    "aliases": [
      "ocr dikirim server",
      "ocr online",
      "pdf diupload",
      "dokumen diupload"
    ],
    "keywords": [
      "ocr",
      "lokal",
      "upload",
      "server"
    ],
    "answer": "OCR dan penyusunan PDF dilakukan lokal di perangkat. Activation service tidak dipakai untuk mengunggah gambar halaman, teks OCR, atau PDF hasil."
  },
  {
    "id": "watermark",
    "title": "Watermark",
    "aliases": [
      "watermark dihapus",
      "hapus watermark",
      "watermark"
    ],
    "keywords": [
      "watermark"
    ],
    "answer": "BMP Terbuka mempertahankan watermark dari sumber dan tidak menyediakan fitur penghapusan watermark."
  },
  {
    "id": "latest",
    "title": "Versi terbaru",
    "aliases": [
      "versi terbaru",
      "latest version",
      "update terbaru",
      "download terbaru"
    ],
    "keywords": [
      "versi",
      "latest",
      "update",
      "1.0.5"
    ],
    "answer": "Versi terbaru yang didokumentasikan bot ini adalah v1.0.5. Download selalu dari https://github.com/mentaliss/bukabmp/releases/latest"
  },
  {
    "id": "release-package",
    "title": "Paket release resmi",
    "aliases": [
      "download yang mana",
      "paket yang mana",
      "source code zip",
      "release zip"
    ],
    "keywords": [
      "release",
      "zip",
      "source code"
    ],
    "answer": "Gunakan asset dari GitHub Releases, bukan “Source code ZIP”. Desktop memakai ZIP extension; Android memakai paket Android-CRX."
  },
  {
    "id": "install-overview",
    "title": "Cara install BMP Terbuka",
    "aliases": [
      "cara install",
      "cara instal",
      "cara pasang",
      "install bmp terbuka",
      "instal bmp terbuka",
      "pasang bmp terbuka"
    ],
    "keywords": [
      "install",
      "instal",
      "pasang"
    ],
    "answer": "Instalasi tergantung platform. Android: Microsoft Edge Canary + paket Android-CRX, tutorial teks https://t.me/bukabmp/11?comment=168. Desktop: Google Chrome atau Microsoft Edge, download ZIP release → extract → Developer mode → Load unpacked. Release terbaru: https://github.com/mentaliss/bukabmp/releases/latest"
  },
  {
    "id": "android-support",
    "title": "Android didukung",
    "aliases": [
      "support android",
      "bisa android",
      "android bisa",
      "hp android"
    ],
    "keywords": [
      "android",
      "support"
    ],
    "answer": "Bisa di Android melalui Microsoft Edge Canary dengan dukungan pemasangan extension/CRX yang tersedia pada build/perangkatmu."
  },
  {
    "id": "android-edge-canary",
    "title": "Browser Android",
    "aliases": [
      "browser android",
      "edge canary android",
      "chrome android",
      "firefox android"
    ],
    "keywords": [
      "android",
      "edge canary",
      "chrome",
      "firefox"
    ],
    "answer": "Jalur Android yang didukung saat ini adalah Microsoft Edge Canary. Chrome/Firefox Android bukan target instalasi resmi BMP Terbuka saat ini."
  },
  {
    "id": "android-install",
    "title": "Tutorial instalasi Android",
    "aliases": [
      "cara install android",
      "instal android",
      "install android",
      "pasang android"
    ],
    "keywords": [
      "android",
      "install",
      "instal",
      "crx"
    ],
    "answer": "Tutorial instalasi Android (teks): https://t.me/bukabmp/11?comment=168\n\nGunakan paket Android-CRX dari release terbaru: https://github.com/mentaliss/bukabmp/releases/latest"
  },
  {
    "id": "android-video-v104",
    "title": "Video penggunaan Android v1.0.4",
    "aliases": [
      "video android",
      "tutorial video android",
      "cara pakai android"
    ],
    "keywords": [
      "android",
      "video",
      "tutorial"
    ],
    "answer": "Video penggunaan Android yang tersedia dibuat untuk v1.0.4: https://t.me/bukabmp/11?comment=294\n\nUntuk perubahan fitur v1.0.5, ketik /tutorial atau /fitur."
  },
  {
    "id": "desktop-support",
    "title": "Desktop didukung",
    "aliases": [
      "support desktop",
      "bisa desktop",
      "pc laptop"
    ],
    "keywords": [
      "desktop",
      "pc",
      "laptop"
    ],
    "answer": "Desktop resmi mendukung Google Chrome atau Microsoft Edge yang mendukung Manifest V3."
  },
  {
    "id": "desktop-browsers-summary",
    "title": "Browser desktop yang didukung",
    "aliases": [
      "support chrome firefox edge",
      "chrome firefox edge",
      "browser desktop apa",
      "browser apa yang support",
      "browser yang didukung"
    ],
    "keywords": [
      "chrome",
      "firefox",
      "edge",
      "browser",
      "desktop"
    ],
    "answer": "Di desktop, target resmi BMP Terbuka adalah Google Chrome dan Microsoft Edge yang mendukung Manifest V3. Firefox tidak didukung resmi saat ini; browser Chromium lain juga belum menjadi target dukungan resmi."
  },
  {
    "id": "chrome-desktop",
    "title": "Chrome desktop",
    "aliases": [
      "support chrome",
      "bisa chrome",
      "google chrome"
    ],
    "keywords": [
      "chrome",
      "desktop"
    ],
    "answer": "Google Chrome desktop didukung. Install lewat ZIP release → extract → chrome://extensions → Developer mode → Load unpacked."
  },
  {
    "id": "edge-desktop",
    "title": "Edge desktop",
    "aliases": [
      "support edge",
      "bisa edge desktop",
      "microsoft edge desktop"
    ],
    "keywords": [
      "edge",
      "desktop"
    ],
    "answer": "Microsoft Edge desktop didukung. Install lewat ZIP release → extract → edge://extensions → Developer mode → Load unpacked."
  },
  {
    "id": "firefox-desktop",
    "title": "Firefox desktop",
    "aliases": [
      "support firefox",
      "bisa firefox",
      "bisa di firefox",
      "firefox bisa",
      "firefox desktop",
      "mozilla firefox"
    ],
    "keywords": [
      "firefox",
      "desktop"
    ],
    "answer": "Firefox bukan browser desktop yang didukung resmi saat ini. Target desktop resmi BMP Terbuka adalah Google Chrome dan Microsoft Edge dengan Manifest V3."
  },
  {
    "id": "other-chromium",
    "title": "Browser Chromium lain",
    "aliases": [
      "brave bisa",
      "opera bisa",
      "vivaldi bisa",
      "chromium lain"
    ],
    "keywords": [
      "brave",
      "opera",
      "vivaldi",
      "chromium"
    ],
    "answer": "Browser Chromium lain belum menjadi target dukungan resmi. Yang didokumentasikan dan diuji sebagai target desktop adalah Google Chrome dan Microsoft Edge."
  },
  {
    "id": "desktop-video-v104",
    "title": "Video penggunaan Desktop v1.0.4",
    "aliases": [
      "video desktop",
      "tutorial video desktop",
      "cara pakai desktop"
    ],
    "keywords": [
      "desktop",
      "video",
      "tutorial"
    ],
    "answer": "Video penggunaan Desktop yang tersedia dibuat untuk v1.0.4: https://t.me/c/4381494564/18\n\nUntuk alur dan fitur baru v1.0.5, ketik /tutorial atau /fitur."
  },
  {
    "id": "desktop-install",
    "title": "Cara install Desktop",
    "aliases": [
      "cara install desktop",
      "install chrome",
      "install edge",
      "load unpacked"
    ],
    "keywords": [
      "desktop",
      "install",
      "load unpacked"
    ],
    "answer": "Desktop: download ZIP release → extract ke folder tetap → buka chrome://extensions atau edge://extensions → aktifkan Developer mode → Load unpacked → pilih folder yang berisi manifest.json."
  },
  {
    "id": "join-group",
    "title": "Cara join Group Terbuka",
    "aliases": [
      "cara join grup",
      "join group",
      "gabung grup",
      "group terbuka"
    ],
    "keywords": [
      "join",
      "group",
      "grup"
    ],
    "answer": "Cara join Group Terbuka: https://t.me/bukabmp/13"
  },
  {
    "id": "activation",
    "title": "Aktivasi komunitas",
    "aliases": [
      "cara aktivasi",
      "aktivasi komunitas",
      "verifikasi telegram"
    ],
    "keywords": [
      "aktivasi",
      "verifikasi",
      "telegram"
    ],
    "answer": "Aktivasi dilakukan dari popup BMP Terbuka lalu diverifikasi lewat Telegram. Bot mengecek keanggotaan komunitas dan mengembalikan token aktivasi yang diverifikasi extension."
  },
  {
    "id": "activation-expired",
    "title": "Aktivasi kedaluwarsa",
    "aliases": [
      "aktivasi expired",
      "aktivasi habis",
      "kedaluwarsa",
      "expired activation"
    ],
    "keywords": [
      "aktivasi",
      "expired",
      "kedaluwarsa"
    ],
    "answer": "Kalau aktivasi kedaluwarsa, buka popup dan lakukan verifikasi komunitas lagi. Selama syarat komunitas terpenuhi, aktivasi bisa diperbarui."
  },
  {
    "id": "activation-old-version",
    "title": "Aktivasi gagal karena versi lama",
    "aliases": [
      "versi tidak didukung",
      "update required",
      "aktivasi gagal versi"
    ],
    "keywords": [
      "aktivasi",
      "versi",
      "update"
    ],
    "answer": "Kalau versi extension sudah di bawah minimum yang didukung backend, aktivasi baru akan meminta update dulu. Ambil versi terbaru di https://github.com/mentaliss/bukabmp/releases/latest"
  },
  {
    "id": "rules",
    "title": "Rules group",
    "aliases": [
      "rules",
      "aturan grup",
      "aturan group"
    ],
    "keywords": [
      "rules",
      "aturan"
    ],
    "answer": "Cek rules Group Terbuka lewat Rose dengan command /rules. Jangan membagikan credential atau materi yang tidak boleh didistribusikan."
  },
  {
    "id": "privacy-credentials",
    "title": "Jangan kirim credential",
    "aliases": [
      "boleh kirim nim",
      "boleh kirim password",
      "cookie",
      "session token",
      "credential"
    ],
    "keywords": [
      "nim",
      "password",
      "cookie",
      "session",
      "token",
      "credential"
    ],
    "answer": "Jangan kirim password, NIM, cookie, session/token, atau credential lain ke bot/group. Untuk troubleshooting cukup screenshot, versi, platform, Kode BMP, dan modul yang bermasalah."
  },
  {
    "id": "bug-report",
    "title": "Format laporan kendala",
    "aliases": [
      "cara lapor bug",
      "lapor error",
      "lapor kendala",
      "bug report"
    ],
    "keywords": [
      "bug",
      "error",
      "kendala",
      "lapor"
    ],
    "answer": "Biar gampang dicek, kirim: screenshot error/posisi terakhir, versi BMP Terbuka, Android/Desktop, Kode BMP, dan modul yang bermasalah. Jangan kirim password, NIM, cookie, session/token, atau credential."
  },
  {
    "id": "code-from-url",
    "title": "Ambil Kode BMP",
    "aliases": [
      "kode bmp ambil dimana",
      "cara cari kode bmp",
      "ambil kode bmp"
    ],
    "keywords": [
      "kode bmp",
      "url",
      "modul="
    ],
    "answer": "Kode BMP diambil dari URL reader RBV, yaitu nilai setelah parameter ?modul=. Contoh ...index.php?modul=BING412102 berarti Kode BMP = BING412102."
  },
  {
    "id": "code-not-course",
    "title": "Kode BMP bukan kode mata kuliah",
    "aliases": [
      "kode bmp sama kode matkul",
      "kode mata kuliah",
      "kode matkul"
    ],
    "keywords": [
      "kode bmp",
      "kode matkul",
      "mata kuliah"
    ],
    "answer": "Kode BMP tidak selalu sama dengan kode mata kuliah. Gunakan nilai ?modul= dari URL reader, bukan menebak dari kode mata kuliah."
  },
  {
    "id": "bmp-not-found",
    "title": "BMP/modul tidak muncul",
    "aliases": [
      "bmp ga muncul",
      "bmp tidak muncul",
      "modul tidak tersedia",
      "modul ga muncul"
    ],
    "keywords": [
      "bmp",
      "modul",
      "tidak tersedia",
      "ga muncul"
    ],
    "answer": "Paling sering karena Kode BMP salah atau range modul yang dipilih tidak tersedia. Buka BMP tersebut di reader, salin nilai ?modul= dari URL, lalu pastikan modulnya memang bisa dibuka dengan akunmu."
  },
  {
    "id": "wrong-code",
    "title": "Salah Kode BMP",
    "aliases": [
      "salah kode",
      "kode salah",
      "invalid kode bmp"
    ],
    "keywords": [
      "kode",
      "salah",
      "invalid"
    ],
    "answer": "Kalau Kode BMP salah, extension tidak bisa menemukan modul yang dimaksud. Ambil ulang Kode BMP langsung dari URL reader RBV."
  },
  {
    "id": "range",
    "title": "Range modul",
    "aliases": [
      "modul pertama",
      "modul terakhir",
      "range modul",
      "m1 m9"
    ],
    "keywords": [
      "range",
      "modul pertama",
      "modul terakhir"
    ],
    "answer": "Isi modul pertama dan modul terakhir sesuai range yang ingin diproses. Contoh 1 sampai 9 berarti M1–M9."
  },
  {
    "id": "active-tab",
    "title": "Tab aktif harus reader",
    "aliases": [
      "tab aktif",
      "buka pustaka",
      "buka reader dulu"
    ],
    "keywords": [
      "tab",
      "reader",
      "pustaka"
    ],
    "answer": "Jalankan extension saat tab aktif sedang membuka reader RBV yang didukung. Kalau belum membuka pustaka.ut.ac.id/reader/, extension tidak punya konteks halaman sumber untuk diproses."
  },
  {
    "id": "resume",
    "title": "Resume proses",
    "aliases": [
      "resume",
      "lanjut proses",
      "melanjutkan",
      "ga ulang dari awal",
      "tidak ulang dari awal"
    ],
    "keywords": [
      "resume",
      "lanjut",
      "ocr ulang"
    ],
    "answer": "Di v1.0.5, modul yang sudah selesai disimpan lokal. Saat dijalankan lagi, modul yang sudah tersedia dilewati otomatis sehingga tidak perlu OCR ulang dari awal."
  },
  {
    "id": "interrupted-module",
    "title": "Proses terputus di tengah modul",
    "aliases": [
      "browser ketutup",
      "edge ketutup",
      "chrome ketutup",
      "mati di tengah modul",
      "proses terhenti tengah"
    ],
    "keywords": [
      "terhenti",
      "ketutup",
      "tengah modul"
    ],
    "answer": "Yang aman untuk resume adalah modul yang sudah selesai dan sudah tersimpan lokal. Kalau proses terputus saat satu modul belum selesai, modul yang sedang berjalan itu mungkin perlu diproses lagi."
  },
  {
    "id": "local-storage",
    "title": "Apa itu penyimpanan lokal",
    "aliases": [
      "apa itu penyimpanan lokal",
      "cache itu apa",
      "penyimpanan bmp"
    ],
    "keywords": [
      "penyimpanan lokal",
      "cache",
      "storage"
    ],
    "answer": "Penyimpanan lokal adalah salinan PDF modul hasil proses di dalam storage extension. Ini dipakai untuk resume, PDF gabungan, dan ekspor ulang tanpa OCR."
  },
  {
    "id": "storage-vs-downloads",
    "title": "Penyimpanan lokal vs Downloads",
    "aliases": [
      "beda cache dan download",
      "penyimpanan lokal downloads",
      "cache downloads"
    ],
    "keywords": [
      "cache",
      "downloads",
      "penyimpanan lokal"
    ],
    "answer": "Penyimpanan lokal extension berbeda dari folder Downloads. File di Downloads adalah hasil ekspor; storage extension adalah sumber lokal untuk resume/merge/export ulang."
  },
  {
    "id": "deleted-download",
    "title": "File Downloads terhapus",
    "aliases": [
      "file kehapus bisa download ulang",
      "pdf kehapus",
      "file download kehapus",
      "hapus file downloads"
    ],
    "keywords": [
      "file kehapus",
      "pdf kehapus",
      "download ulang",
      "export"
    ],
    "answer": "Bisa. Kalau PDF modul masih ada di penyimpanan lokal extension, tinggal ekspor ulang dan hasilnya praktis instan karena tidak perlu OCR lagi."
  },
  {
    "id": "deleted-local-storage",
    "title": "Penyimpanan lokal terhapus",
    "aliases": [
      "cache kehapus",
      "storage kehapus",
      "penyimpanan lokal kehapus"
    ],
    "keywords": [
      "cache kehapus",
      "storage kehapus"
    ],
    "answer": "Kalau data penyimpanan lokal extension sudah dihapus dan file itu tidak lagi ada sebagai cache BMP, fitur resume/export instan tidak punya sumber lokal lagi. Modul tersebut perlu diproses ulang bila dibutuhkan."
  },
  {
    "id": "export-one",
    "title": "Ekspor satu modul",
    "aliases": [
      "export satu modul",
      "download satu modul",
      "ekspor satu"
    ],
    "keywords": [
      "export",
      "satu modul"
    ],
    "answer": "Bisa. Buka pengelolaan penyimpanan lalu pilih modul yang sudah tersimpan untuk diekspor tanpa OCR ulang."
  },
  {
    "id": "export-multiple",
    "title": "Ekspor banyak modul",
    "aliases": [
      "export beberapa modul",
      "download banyak modul",
      "multi export",
      "pilih semua"
    ],
    "keywords": [
      "export",
      "beberapa",
      "banyak",
      "pilih semua"
    ],
    "answer": "Bisa pilih beberapa modul sekaligus untuk diekspor ulang dari penyimpanan lokal tanpa OCR ulang."
  },
  {
    "id": "export-instant",
    "title": "Ekspor ulang cepat",
    "aliases": [
      "export instan",
      "download ulang instan",
      "kenapa cepat export"
    ],
    "keywords": [
      "export",
      "instan",
      "cepat"
    ],
    "answer": "Ekspor ulang dari penyimpanan lokal tidak menjalankan OCR/source retrieval lagi, jadi biasanya jauh lebih cepat dibanding memproses modul dari awal."
  },
  {
    "id": "clear-storage",
    "title": "Hapus cache/penyimpanan lokal",
    "aliases": [
      "bisa hapus cache",
      "hapus cache",
      "hapus penyimpanan lokal",
      "kosongkan penyimpanan"
    ],
    "keywords": [
      "hapus cache",
      "kosongkan",
      "penyimpanan"
    ],
    "answer": "Bisa. Gunakan “Kosongkan penyimpanan BMP ini” untuk menghapus data lokal hanya untuk Kode BMP yang sedang dipilih."
  },
  {
    "id": "clear-storage-downloads",
    "title": "Hapus storage apakah hapus Downloads",
    "aliases": [
      "hapus cache file downloads",
      "kosongkan penyimpanan hapus pdf"
    ],
    "keywords": [
      "hapus",
      "downloads",
      "penyimpanan"
    ],
    "answer": "Tidak. Mengosongkan penyimpanan lokal BMP tidak menghapus PDF yang sudah tersimpan di folder Downloads."
  },
  {
    "id": "storage-per-code",
    "title": "Storage per Kode BMP",
    "aliases": [
      "cache campur",
      "ganti kode bmp",
      "penyimpanan per kode"
    ],
    "keywords": [
      "cache",
      "kode bmp",
      "ganti kode"
    ],
    "answer": "Penyimpanan disusun per Kode BMP. Modul dari Kode BMP lain tidak seharusnya dianggap sebagai modul untuk kode yang sedang dipilih."
  },
  {
    "id": "storage-size",
    "title": "Ukuran penyimpanan lokal",
    "aliases": [
      "berapa ukuran cache",
      "storage besar",
      "penyimpanan mb"
    ],
    "keywords": [
      "ukuran",
      "cache",
      "storage",
      "mb"
    ],
    "answer": "Popup v1.0.5 menampilkan ringkasan ukuran data lokal untuk Kode BMP yang dipilih. Kalau tidak lagi dibutuhkan, storage BMP itu bisa dikosongkan tanpa menghapus file Downloads."
  },
  {
    "id": "rerun-complete",
    "title": "Jalankan range yang sudah lengkap",
    "aliases": [
      "semua sudah tersedia",
      "range sudah lengkap",
      "klik proses lagi"
    ],
    "keywords": [
      "sudah tersedia",
      "lengkap",
      "range"
    ],
    "answer": "Kalau semua modul dalam range sudah tersedia lokal dan kamu tidak memilih download ulang, v1.0.5 tidak perlu OCR ulang. Kamu bisa ekspor PDF yang ada atau membuat PDF gabungan bila diinginkan."
  },
  {
    "id": "missing-only",
    "title": "Hanya modul yang hilang diproses",
    "aliases": [
      "cuma modul belum ada",
      "modul yang hilang",
      "skip cached"
    ],
    "keywords": [
      "modul hilang",
      "belum ada",
      "skip"
    ],
    "answer": "Default v1.0.5 adalah resume: modul yang sudah tersimpan dilewati, dan hanya modul yang belum tersedia dalam range yang perlu diproses."
  },
  {
    "id": "redownload-selected",
    "title": "Download ulang range tertentu",
    "aliases": [
      "download ulang modul yang dipilih",
      "redownload range",
      "proses ulang range"
    ],
    "keywords": [
      "download ulang",
      "redownload",
      "proses ulang"
    ],
    "answer": "Centang “Download ulang modul yang dipilih” lalu atur range. Hanya modul dalam range tersebut yang diproses ulang."
  },
  {
    "id": "redownload-preserve",
    "title": "Redownload tidak hapus modul lain",
    "aliases": [
      "download ulang hapus yang lain",
      "redownload hapus cache lain"
    ],
    "keywords": [
      "redownload",
      "hapus",
      "modul lain"
    ],
    "answer": "Tidak. Download ulang range tertentu tidak menghapus modul lain yang sudah tersimpan di Kode BMP tersebut."
  },
  {
    "id": "redownload-one",
    "title": "Download ulang satu modul",
    "aliases": [
      "download ulang m3",
      "ulang satu modul",
      "redownload satu modul"
    ],
    "keywords": [
      "download ulang",
      "satu modul"
    ],
    "answer": "Bisa. Set modul pertama dan terakhir ke nomor yang sama, misalnya 3–3, lalu aktifkan “Download ulang modul yang dipilih”."
  },
  {
    "id": "merge-optional",
    "title": "PDF gabungan opsional",
    "aliases": [
      "harus buat pdf gabungan",
      "merge wajib",
      "pdf gabungan opsional"
    ],
    "keywords": [
      "gabungan",
      "opsional",
      "merge"
    ],
    "answer": "PDF gabungan di v1.0.5 bersifat opsional. Kalau cuma butuh PDF per modul, biarkan opsi “Buat PDF gabungan” tidak dicentang."
  },
  {
    "id": "merge-full",
    "title": "PDF gabungan FULL",
    "aliases": [
      "full pdf",
      "gabungan full",
      "full_searchable"
    ],
    "keywords": [
      "full",
      "gabungan",
      "merge"
    ],
    "answer": "PDF gabungan FULL bisa dibuat ketika set modul yang dibutuhkan sudah lengkap di penyimpanan lokal."
  },
  {
    "id": "merge-range",
    "title": "PDF gabungan range",
    "aliases": [
      "gabung m3 m6",
      "merge range",
      "pdf m3-m6"
    ],
    "keywords": [
      "gabung",
      "range",
      "m3",
      "m6"
    ],
    "answer": "Bisa membuat PDF gabungan untuk range tertentu, misalnya M3–M6, selama semua modul dalam range itu tersedia lokal."
  },
  {
    "id": "merge-gap",
    "title": "Merge gagal karena ada gap",
    "aliases": [
      "pdf gabungan tidak jadi",
      "merge tidak jadi",
      "ada gap",
      "modul bolong"
    ],
    "keywords": [
      "merge",
      "gap",
      "bolong",
      "tidak jadi"
    ],
    "answer": "Kalau ada modul yang belum tersedia dalam range yang dipilih, PDF gabungan tidak dibuat sampai range tersebut lengkap. Ini sengaja supaya modul yang hilang tidak diam-diam dilewati."
  },
  {
    "id": "merge-from-storage",
    "title": "Merge sumbernya storage",
    "aliases": [
      "merge dari downloads",
      "gabungan dari download",
      "merge cache"
    ],
    "keywords": [
      "merge",
      "downloads",
      "storage"
    ],
    "answer": "PDF gabungan dibangun dari PDF modul yang tersimpan lokal di extension, bukan dengan membaca file di folder Downloads."
  },
  {
    "id": "deleted-download-merge",
    "title": "File Downloads hilang tapi mau merge",
    "aliases": [
      "file download kehapus masih bisa merge",
      "pdf downloads hilang gabung"
    ],
    "keywords": [
      "downloads",
      "kehapus",
      "merge"
    ],
    "answer": "Kalau modulnya masih ada di penyimpanan lokal extension, file Downloads yang terhapus tidak menghalangi merge. Merge memakai data lokal extension."
  },
  {
    "id": "page-count",
    "title": "Berhenti di halaman terakhir",
    "aliases": [
      "halaman terakhir",
      "page count",
      "kelebihan halaman",
      "page terakhir"
    ],
    "keywords": [
      "halaman terakhir",
      "page count"
    ],
    "answer": "v1.0.5 memakai jumlah halaman yang dilaporkan reader bila tersedia, sehingga proses berhenti tepat di halaman terakhir dan tidak meminta halaman setelahnya."
  },
  {
    "id": "progress",
    "title": "Progress halaman",
    "aliases": [
      "progress halaman",
      "current total",
      "berapa halaman"
    ],
    "keywords": [
      "progress",
      "halaman",
      "total"
    ],
    "answer": "Saat total halaman tersedia dari reader, progress menampilkan posisi halaman terhadap total sehingga lebih jelas prosesnya sudah sampai mana."
  },
  {
    "id": "downloads-not-canonical",
    "title": "Downloads bukan penentu selesai",
    "aliases": [
      "hapus downloads resume",
      "downloads sumber",
      "folder downloads cache"
    ],
    "keywords": [
      "downloads",
      "resume",
      "sumber"
    ],
    "answer": "Folder Downloads bukan sumber status penyelesaian. Resume v1.0.5 mengandalkan penyimpanan lokal extension; menghapus file Downloads tidak otomatis membuat modul dianggap belum selesai."
  },
  {
    "id": "403",
    "title": "Error 403",
    "aliases": [
      "403",
      "forbidden"
    ],
    "keywords": [
      "403",
      "forbidden"
    ],
    "answer": "Kalau reader memberi 403, BMP Terbuka berhenti. Selesaikan login/akses melalui mekanisme normal sumber lalu coba lagi; bot tidak memberi cara bypass."
  },
  {
    "id": "429",
    "title": "Error 429",
    "aliases": [
      "429",
      "too many requests"
    ],
    "keywords": [
      "429",
      "rate limit"
    ],
    "answer": "Kalau reader memberi 429, BMP Terbuka safe-stop dan tidak melakukan blind retry. Tunggu kondisi akses normal lalu coba lagi."
  },
  {
    "id": "request-rejected",
    "title": "Request Rejected",
    "aliases": [
      "request rejected",
      "support id"
    ],
    "keywords": [
      "request rejected",
      "support id"
    ],
    "answer": "Kalau muncul Request Rejected, proses sengaja berhenti. Jangan mencoba bypass/stealth; selesaikan akses secara normal dan coba lagi nanti."
  },
  {
    "id": "login-redirect",
    "title": "Minta login ulang",
    "aliases": [
      "login ulang",
      "ke halaman login",
      "session habis"
    ],
    "keywords": [
      "login ulang",
      "session",
      "login"
    ],
    "answer": "Kalau reader mengarahkan ke login ulang atau sesi habis, login kembali secara normal di reader lalu mulai lagi. Modul yang sudah selesai dan masih tersimpan lokal tetap bisa dipakai untuk resume."
  },
  {
    "id": "safe-stop",
    "title": "Kenapa tidak retry otomatis",
    "aliases": [
      "kenapa berhenti",
      "kok ga retry",
      "retry otomatis"
    ],
    "keywords": [
      "retry",
      "berhenti",
      "safe stop"
    ],
    "answer": "Safe-stop memang desain BMP Terbuka saat sumber menolak akses. Extension tidak melakukan blind retry terhadap 403/429/login/Request Rejected."
  },
  {
    "id": "no-bypass",
    "title": "Bypass blokir",
    "aliases": [
      "bypass waf",
      "bypass blokir",
      "stealth",
      "spoof cookie"
    ],
    "keywords": [
      "bypass",
      "waf",
      "stealth",
      "spoof"
    ],
    "answer": "BMP Terbuka tidak menyediakan teknik bypass WAF/blokir, stealth, spoofing cookie/token, IP rotation, atau cara memaksa akses yang ditolak sumber."
  },
  {
    "id": "file-location",
    "title": "PDF tersimpan di mana",
    "aliases": [
      "pdf dimana",
      "hasil download dimana",
      "file tersimpan dimana"
    ],
    "keywords": [
      "pdf",
      "downloads",
      "tersimpan"
    ],
    "answer": "Hasil ekspor PDF masuk ke mekanisme Downloads browser. Selain itu, v1.0.5 menyimpan salinan modul secara lokal di storage extension untuk resume/merge/export ulang."
  },
  {
    "id": "uninstall-extension",
    "title": "Hapus atau uninstall extension",
    "aliases": [
      "hapus ekstensi",
      "cara hapus ekstensi",
      "hapus extension",
      "cara hapus extension",
      "uninstall ekstensi",
      "uninstall extension",
      "hapus bmp terbuka"
    ],
    "keywords": [
      "hapus ekstensi",
      "hapus extension",
      "uninstall"
    ],
    "answer": "Bisa. Hapus/uninstall BMP Terbuka dari halaman extensions browser. Perlu diingat, menghapus extension atau data browser dapat menghilangkan penyimpanan lokal BMP di extension; PDF yang sudah diekspor ke Downloads tidak ikut terhapus."
  },
  {
    "id": "reinstall-extension",
    "title": "Reinstall dan storage",
    "aliases": [
      "reinstall extension cache",
      "hapus extension data",
      "install ulang data"
    ],
    "keywords": [
      "reinstall",
      "hapus extension",
      "storage"
    ],
    "answer": "Jangan mengandalkan storage lokal tetap ada setelah extension dihapus/reinstall atau data browser dibersihkan. Kalau datanya hilang, resume/export instan dari storage itu juga hilang."
  },
  {
    "id": "update-v104-v105",
    "title": "Tutorial v1.0.4 vs v1.0.5",
    "aliases": [
      "tutorial 1.0.4",
      "video versi lama",
      "beda tutorial"
    ],
    "keywords": [
      "tutorial",
      "1.0.4",
      "1.0.5"
    ],
    "answer": "Video Android/Desktop yang ditautkan bot dibuat pada v1.0.4, jadi tampilan/fitur penyimpanan v1.0.5 bisa berbeda. Untuk penggunaan v1.0.5 gunakan /tutorial dan /fitur sebagai acuan terbaru."
  },
  {
    "id": "current-v105-tutorial",
    "title": "Tutorial penggunaan v1.0.5",
    "aliases": [
      "tutorial 1.0.5",
      "cara pakai 1.0.5",
      "penggunaan v1.0.5"
    ],
    "keywords": [
      "tutorial",
      "1.0.5",
      "cara pakai"
    ],
    "answer": "Ketik /tutorial untuk tutorial penggunaan v1.0.5 langsung dari bot. Tutorial itu mencakup Kode BMP, range modul, resume, redownload, PDF gabungan, ekspor ulang, dan penyimpanan lokal."
  },
  {
    "id": "help-human",
    "title": "Kalau bot tidak tahu",
    "aliases": [
      "bot ga tau",
      "jawaban tidak membantu",
      "masih error",
      "butuh admin"
    ],
    "keywords": [
      "bot",
      "admin",
      "member",
      "bantu"
    ],
    "answer": "Kalau jawaban bot belum menyelesaikan masalah, kirim detail kendala di Group Terbuka. Member lain bisa ikut bantu; sertakan screenshot, versi, platform, Kode BMP, dan modul yang bermasalah."
  },
  {
    "id": "greeting",
    "title": "Sapaan",
    "aliases": [
      "halo",
      "hai",
      "hi"
    ],
    "keywords": [
      "halo",
      "hai"
    ],
    "answer": "Halo 👋 Tanya aja soal instalasi, Kode BMP, Android/Desktop, aktivasi, error, atau fitur v1.0.5. Bisa juga pakai /tutorial, /fitur, atau /bug."
  }
];

const SUPPORT_STOPWORDS = new Set([
  "yang", "dan", "atau", "di", "ke", "dari", "untuk", "ini", "itu", "nya", "aku", "saya",
  "gw", "gue", "ga", "gak", "nggak", "tidak", "bisa", "apa", "gimana", "bagaimana", "kok",
  "kenapa", "kalau", "kalo", "mau", "jadi", "udah", "sudah", "dong", "bro", "min"
]);

function supportSearchText(value) {
  return normalizeSupportQuery(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function supportTokens(value) {
  return supportSearchText(value)
    .split(" ")
    .filter(x => x.length >= 2 && !SUPPORT_STOPWORDS.has(x));
}

function scoreSupportKbEntry(query, entry) {
  const q = supportSearchText(query);
  if (!q) return {score: 0, strong: false};
  let score = 0;
  let strong = false;

  const qTokenList = supportTokens(q);
  const qTokenSet = new Set(qTokenList);

  for (const raw of entry.aliases || []) {
    const alias = supportSearchText(raw);
    if (!alias || alias.length < 2) continue;
    if (q === alias) {
      score += 30;
      strong = true;
    } else if (q.includes(alias)) {
      score += 18;
      strong = true;
    } else {
      // Treat harmless filler-word variants as the same FAQ, e.g.
      // "bisa di firefox?" vs "bisa firefox". This keeps known FAQs free.
      const aliasTokens = supportTokens(alias);
      const tokenExact = aliasTokens.length > 0 &&
        aliasTokens.length === qTokenList.length &&
        aliasTokens.every(token => qTokenSet.has(token));
      const meaningfulSubset = aliasTokens.length >= 2 &&
        aliasTokens.every(token => qTokenSet.has(token));
      if (tokenExact) {
        score += 24;
        strong = true;
      } else if (meaningfulSubset) {
        score += 14;
        strong = true;
      }
    }
  }

  for (const raw of entry.keywords || []) {
    const kw = supportSearchText(raw);
    if (!kw) continue;
    if (q.includes(kw)) score += kw.includes(" ") ? 8 : 4;
  }

  const qTokens = qTokenSet;
  const eTokens = new Set(supportTokens([entry.title, ...(entry.aliases || []), ...(entry.keywords || [])].join(" ")));
  let overlap = 0;
  for (const token of qTokens) if (eTokens.has(token)) overlap++;
  score += overlap * 2;

  return {score, strong};
}

function retrieveSupportKnowledge(query, limit = 6) {
  return SUPPORT_KB
    .map(entry => ({entry, ...scoreSupportKbEntry(query, entry)}))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function directSupportKbAnswer(query) {
  const matches = retrieveSupportKnowledge(query, 3);
  if (!matches.length) return null;
  const top = matches[0];
  const second = matches[1]?.score || 0;
  const secondMatch = matches[1] || null;
  const multiStrong = Boolean(secondMatch?.strong && second >= top.score - 8);
  if (!multiStrong && (top.strong || top.score >= 16 || (top.score >= 10 && top.score >= second + 5))) {
    return top.entry.answer;
  }
  return null;
}

function supportActorId(message) {
  if (isAnonymousAdminMessage(message)) {
    return `anonymous-admin:${message?.sender_chat?.id || message?.chat?.id || "unknown"}`;
  }
  return String(message?.from?.id || "unknown");
}

function supportDailyBucket() {
  // Reset once per calendar day (WIB) so "per hari" is predictable for the Indonesian community.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}

async function supportAiQuotaStatus(env, userId) {
  if (!env.PAIRINGS) {
    return {count: 0, remaining: SUPPORT_AI_MAX_CALLS_PER_DAY};
  }
  const key = `support-ai-day:${userId}:${supportDailyBucket()}`;
  const count = Math.max(0, Number(await env.PAIRINGS.get(key) || 0));
  return {
    count,
    remaining: Math.max(0, SUPPORT_AI_MAX_CALLS_PER_DAY - count)
  };
}

async function supportAiAllowed(env, userId) {
  if (!env.PAIRINGS) return {allowed: true, count: 0, remaining: SUPPORT_AI_MAX_CALLS_PER_DAY};
  const key = `support-ai-day:${userId}:${supportDailyBucket()}`;
  const current = await supportAiQuotaStatus(env, userId);
  if (current.count >= SUPPORT_AI_MAX_CALLS_PER_DAY) {
    return {allowed: false, count: current.count, remaining: 0};
  }
  const next = current.count + 1;
  await env.PAIRINGS.put(key, String(next), {expirationTtl: 48 * 60 * 60});
  return {allowed: true, count: next, remaining: Math.max(0, SUPPORT_AI_MAX_CALLS_PER_DAY - next)};
}

function formatKnowledgeEntries(entries) {
  return entries.map((entry, i) => `${i + 1}. ${entry.title}: ${entry.answer}`).join("\n");
}

function buildSupportKnowledgeContext(query) {
  const matches = retrieveSupportKnowledge(query, 10);
  const topScore = matches[0]?.score || 0;

  // Strong/medium lexical hit: keep context compact. Weak hit: give the model
  // the complete curated KB so natural-language phrasing is not rejected just
  // because the local retriever missed a synonym or word order.
  if (matches.length && topScore >= 6) {
    return {
      mode: "retrieved",
      text: formatKnowledgeEntries(matches.map(x => x.entry))
    };
  }
  return {
    mode: "full",
    text: formatKnowledgeEntries(SUPPORT_KB)
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

function isBmpSupportQuestion(query) {
  const q = supportSearchText(query);
  if (!q) return false;

  const topical = /\b(bmp|modul|pdf|ocr|extension|ekstensi|rbv|pustaka|reader|android|desktop|edge|chrome|firefox|download|unduh|export|ekspor|cache|penyimpanan|storage|aktivasi|telegram|update|versi|kode|merge|gabung|403|429|request rejected|watermark|crx|manifest|canary)\b/i;
  if (topical.test(q)) return true;

  const matches = retrieveSupportKnowledge(q, 1);
  return Boolean(matches.length && matches[0].score >= 5);
}


async function answerWithSupportAi(env, query, priorContext = "", supporterPriority = false) {
  if (!env.AI || typeof env.AI.run !== "function") return "";
  const safeQuery = redactSensitiveSupportText(query);
  const knowledge = buildSupportKnowledgeContext(safeQuery);

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
    supporterPriority ? "User ini Supporter. Gunakan konteks troubleshooting sebelumnya bila relevan dan prioritaskan diagnosis yang nyambung, tanpa mengarang." : ""
  ].filter(Boolean).join("\n");

  const userPrompt = [
    `MODE_KB=${knowledge.mode}`,
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

  const answer = extractWorkersAiText(result).slice(0, supporterPriority ? 4500 : 3500);
  if (!answer) {
    console.warn("support_ai_empty_result", {
      model: SUPPORT_AI_MODEL,
      kb_mode: knowledge.mode,
      keys: result && typeof result === "object" ? Object.keys(result).slice(0, 12) : []
    });
  }
  return answer;
}


async function sendSupportReply(env, message, text) {
  if (!text) return;
  let output = text;
  if (isGroupChat(message) && message?.__supportAccess?.source === "supporter") {
    output = `⭐ Supporter • Priority\n${text}`;
  }
  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: output,
    reply_parameters: {message_id: message.message_id},
    disable_web_page_preview: true
  });
}


async function handleSupportMessage(env, message) {
  const privateChat = isPrivateChat(message);
  const access = await supportPrivilegeForMessage(env, message);
  const privileged = Boolean(access.privileged);
  message.__supportAccess = access;
  if (!privateChat && !isOfficialSupportGroup(env, message)) return false;
  if (isNormalBotMessage(message)) return false;

  let invocation = supportInvocation(message, env);
  const command = invocation.command?.command || "";
  const commerceDmCommand = privateChat && ["support", "supporter", "supporters", "terms", "paysupport"].includes(command);

  // Regular users are Group-only for support. Commerce/status commands remain
  // available in DM so anyone can buy/check a Supporter Pass.
  if (privateChat && !privileged && !commerceDmCommand) {
    const text = String(message?.text || "").trim();
    if (!text) return false;
    await sendSupportReply(env, message, [
      "Support BMP Terbuka tersedia di Group Terbuka.",
      SUPPORT_GROUP_JOIN_URL,
      "",
      "DM bot tetap digunakan untuk aktivasi/verifikasi extension dan Supporter Pass (/support)."
    ].join("\n"));
    return true;
  }

  // Privileged/supporter users may use plain-text support in DM.
  if (privateChat && privileged && !invocation.invoked) {
    const text = String(message?.text || "").trim();
    if (text) invocation = {invoked: true, command: null, query: text};
  }
  if (!invocation.invoked) return false;

  const currentCommand = invocation.command?.command || "";
  if (currentCommand === "support") {
    await sendSupporterMenu(env, message, access);
    return true;
  }
  if (currentCommand === "terms") {
    await sendSupportReply(env, message, supporterTermsText());
    return true;
  }
  if (currentCommand === "paysupport") {
    await handlePaymentSupportCommand(env, message, invocation.command?.args || "");
    return true;
  }
  if (currentCommand === "supporter") {
    const arg = String(invocation.command?.args || "").trim().toLowerCase();
    if (["public", "anonymous", "private"].includes(arg)) {
      await setSupporterWallMode(env, message, arg);
    } else {
      await sendSupportReply(env, message, await supporterStatusText(env, message?.from?.id));
    }
    return true;
  }
  if (currentCommand === "supporters") {
    await sendSupportReply(env, message, await supporterWallText(env));
    return true;
  }
  if (currentCommand === "bmphelp" || currentCommand === "faq") {
    await sendSupportReply(env, message, supportHelpText(access));
    return true;
  }
  if (currentCommand === "tutorial") {
    await sendSupportReply(env, message, tutorialText());
    return true;
  }
  if (currentCommand === "install") {
    await sendSupportReply(env, message, installText());
    return true;
  }
  if (currentCommand === "android") {
    await sendSupportReply(env, message, androidHelpText());
    return true;
  }
  if (currentCommand === "desktop") {
    await sendSupportReply(env, message, desktopHelpText());
    return true;
  }
  if (currentCommand === "group") {
    await sendSupportReply(env, message, groupHelpText());
    return true;
  }
  if (currentCommand === "update") {
    await sendSupportReply(env, message, updateHelpText());
    return true;
  }
  if (currentCommand === "fitur") {
    await sendSupportReply(env, message, featuresText());
    return true;
  }
  if (currentCommand === "storage") {
    await sendSupportReply(env, message, storageText());
    return true;
  }
  if (currentCommand === "bug") {
    await sendSupportReply(env, message, bugReportText());
    return true;
  }
  if (currentCommand === "quota") {
    if (privileged) {
      const label = access.source === "supporter"
        ? `unlimited (Supporter Pass aktif sampai ${formatWibDateTime(access.supporter?.supporter_until)}).`
        : "unlimited (akun khusus).";
      await sendSupportReply(env, message, `Kuota AI support: ${label}`);
    } else {
      const status = await supportAiQuotaStatus(env, supportActorId(message));
      await sendSupportReply(env, message, `Sisa kuota AI hari ini: ${status.remaining} dari ${SUPPORT_AI_MAX_CALLS_PER_DAY}`);
    }
    return true;
  }

  const query = normalizeSupportQuery(invocation.query);
  if (!query) {
    await sendSupportReply(env, message, "Tulis pertanyaannya setelah /ask ya. Contoh: /ask kenapa modul tidak tersedia?");
    return true;
  }

  if (!isBmpSupportQuestion(query)) {
    await sendSupportReply(env, message, "Bot ini khusus bantuan BMP Terbuka. Ketik /bmphelp untuk menu bantuan.");
    return true;
  }

  const directAnswer = directSupportKbAnswer(query);
  if (directAnswer) {
    await sendSupportReply(env, message, directAnswer);
    if (access.source === "supporter" && !isAnonymousAdminMessage(message)) {
      await rememberSupporterTurn(env, message.from.id, message.chat.id, query, directAnswer);
    }
    return true;
  }

  const quota = privileged
    ? {allowed: true, unlimited: true, count: 0, remaining: null}
    : await supportAiAllowed(env, supportActorId(message));

  if (!quota.allowed) {
    await sendSupportReply(env, message, "Kuota AI support hari ini sudah habis (sisa 0 dari 6). Coba lagi besok. FAQ yang bisa dijawab langsung dari basis pengetahuan serta command seperti /tutorial, /install, /android, /desktop, /storage, /fitur, dan /bug tetap bisa dipakai tanpa kuota AI. Supporter Pass dapat diaktifkan lewat /support.");
    return true;
  }

  try {
    const turns = access.source === "supporter" && !isAnonymousAdminMessage(message)
      ? await supporterContext(env, message.from.id, message.chat.id)
      : [];
    const aiAnswer = await answerWithSupportAi(env, query, formatSupporterContext(turns), access.source === "supporter");
    if (aiAnswer) {
      const footer = access.source === "supporter"
        ? `AI support unlimited • Supporter aktif sampai ${formatWibDateTime(access.supporter?.supporter_until)}`
        : access.source === "allowlist"
          ? "AI support: unlimited (akun khusus)."
          : `Sisa kuota AI hari ini: ${quota.remaining} dari ${SUPPORT_AI_MAX_CALLS_PER_DAY}`;
      await sendSupportReply(env, message, `${aiAnswer}\n\n${footer}`);
      if (access.source === "supporter" && !isAnonymousAdminMessage(message)) {
        await rememberSupporterTurn(env, message.from.id, message.chat.id, query, aiAnswer);
      }
    } else {
      await sendSupportReply(env, message, "Jawaban AI belum berhasil dibuat. Coba gunakan command /bmphelp atau kirim pertanyaan BMP Terbuka dengan konteks yang lebih spesifik.");
    }
  } catch (e) {
    console.error("support_ai_failed", {error: String(e?.stack || e)});
    await sendSupportReply(env, message, "AI support sedang tidak tersedia. Command bantuan seperti /tutorial, /storage, dan /bug tetap bisa dipakai.");
  }
  return true;
}


async function handleTelegram(env, update) {
  if (update.pre_checkout_query) {
    await handleSupporterPreCheckout(env, update.pre_checkout_query);
    return;
  }

  if (update.message) {
    const message = update.message;
    const userId = message.from?.id;
    const chatId = message.chat?.id;
    const text = String(message.text || "").trim();
    const command = parseBotCommand(text, env);

    // Payment receipt must be processed before support routing.
    if (message.successful_payment) {
      await applySuccessfulSupporterPayment(env, message);
      return;
    }

    // Privacy moderation runs first for all ordinary group messages.
    if (await handlePrivacyGate(env, message)) return;

    // Lazily remove stale BMP Supporter tags after expiry when the member speaks.
    await reconcileSupporterTagOnMessage(env, message).catch(() => {});

    // Deep-link /start support opens the private Stars purchase menu instead of
    // being interpreted as an extension pair ID.
    if (isPrivateChat(message) && command?.command === "start" && String(command.args || "").toLowerCase() === "support") {
      const access = await supportPrivilegeForMessage(env, message);
      message.__supportAccess = access;
      await sendSupporterMenu(env, message, access);
      return;
    }

    // Activation remains available in DM for everyone.
    if (isPrivateChat(message) && command?.command === "start") {
      const pairId = command.args || "";
      if (!pairId) {
        await tg(env, "sendMessage", {
          chat_id: chatId,
          text:
            "BMP Terbuka\n\n" +
            "Mulai aktivasi dari popup extension. Jika Telegram Web tidak membawa " +
            "kode aktivasi, salin kode dari popup lalu kirim langsung ke bot ini.\n\n" +
            "Untuk Supporter Pass ketik /support."
        });
        return;
      }
      await verifyPairForUser(env, pairId, userId, chatId);
      return;
    }

    if (isPrivateChat(message) && command?.command === "verify") {
      const pairId = command.args || "";
      if (!pairId) {
        await tg(env, "sendMessage", {
          chat_id: chatId,
          text: "Kirim /verify diikuti kode aktivasi dari popup BMP Terbuka."
        });
        return;
      }
      await verifyPairForUser(env, pairId, userId, chatId);
      return;
    }

    if (isPrivateChat(message) && /^[A-Za-z0-9_-]{10,20}$/.test(text)) {
      await verifyPairForUser(env, text, userId, chatId);
      return;
    }

    if (await handleSupportMessage(env, message)) return;
  }

  if (update.edited_message) {
    await handlePrivacyGate(env, update.edited_message);
    return;
  }

  if (update.callback_query) {
    const q = update.callback_query;
    const callback = parseTelegramCallback(q.data);

    if (!callback) {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id,
        text: "Aksi tidak dikenali."
      }).catch(() => {});
      return;
    }

    if (callback.namespace === "activation" && callback.action === "verify") {
      if (!q.message || !isPrivateChat(q.message)) {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Verifikasi aktivasi hanya lewat DM bot."
        }).catch(() => {});
        return;
      }
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id,
        text: "Memeriksa keanggotaan..."
      }).catch(() => {});
      await verifyPairForUser(env, callback.pairId, q.from.id, q.message.chat.id);
      return;
    }

    if (callback.namespace === "supporter") {
      if (!q.message || !isPrivateChat(q.message)) {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Buka Supporter lewat DM bot."
        }).catch(() => {});
        return;
      }

      if (callback.action === "select") {
        const pkg = supporterPackage(callback.packageId);
        if (!pkg) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Paket tidak valid."
          }).catch(() => {});
          return;
        }
        await tg(env, "answerCallbackQuery", {callback_query_id: q.id}).catch(() => {});
        await sendSupporterPackageConfirmation(env, q.from.id, q.message.chat.id, callback.packageId);
        return;
      }

      if (callback.action === "terms") {
        await tg(env, "answerCallbackQuery", {callback_query_id: q.id}).catch(() => {});
        await tg(env, "sendMessage", {
          chat_id: q.message.chat.id,
          text: supporterTermsText()
        });
        return;
      }

      if (callback.action === "buy") {
        const pkg = supporterPackage(callback.packageId);
        if (!pkg) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Paket tidak valid."
          }).catch(() => {});
          return;
        }
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: `Membuat invoice ${pkg.stars} Stars...`
        }).catch(() => {});
        await sendSupporterInvoice(env, q.from.id, q.message.chat.id, callback.packageId);
        return;
      }
    }
  }
}

function normalizeDistributionChannel(value) {
  const channel = String(value || "github").trim().toLowerCase();
  return DISTRIBUTION_CHANNELS.includes(channel) ? channel : "github";
}

function envString(env, name, fallback = "") {
  const value = env?.[name];
  if (value == null) return fallback;
  return String(value).trim();
}

function envBoolean(env, name, fallback = false) {
  const raw = envString(env, name, "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

function channelEnvName(channel, suffix) {
  return `EXTENSION_${String(channel).toUpperCase()}_${suffix}`;
}

function storeChannel(channel) {
  return channel === "cws" || channel === "edge";
}

function channelPolicy(env, channelValue) {
  const channel = normalizeDistributionChannel(channelValue);
  const latestVersion = envString(
    env,
    channelEnvName(channel, "LATEST_VERSION"),
    envString(env, "EXTENSION_LATEST_VERSION", "1.0.5")
  );
  const configuredMinimum = envString(
    env,
    channelEnvName(channel, "MINIMUM_VERSION"),
    envString(env, "EXTENSION_MINIMUM_VERSION", "1.0.2")
  );
  const forceAfter = envString(
    env,
    channelEnvName(channel, "FORCE_AFTER"),
    envString(env, "EXTENSION_FORCE_AFTER", "")
  ) || null;
  const releaseUrlValue = envString(
    env,
    channelEnvName(channel, "RELEASE_URL"),
    releaseUrl(env)
  );
  const message = envString(
    env,
    channelEnvName(channel, "UPDATE_MESSAGE"),
    envString(env, "EXTENSION_UPDATE_MESSAGE", "")
  );
  const storeReady = storeChannel(channel)
    ? envBoolean(env, channelEnvName(channel, "STORE_READY"), false)
    : true;

  // Never lock Store users to a version that is not actually available in that Store.
  const minimumVersion = storeChannel(channel) && !storeReady ? "" : configuredMinimum;

  return {
    channel,
    latestVersion,
    minimumVersion,
    forceAfter,
    releaseUrl: releaseUrlValue,
    message,
    storeReady
  };
}

function safeCloudText(value, max = 700) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function safeHttpsUrl(value) {
  const raw = safeCloudText(value, 2048);
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function sanitizeCloudAction(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = safeCloudText(raw.type, 32).toUpperCase();
  const allowed = new Set(["OPEN_URL", "OPEN_CHANNEL", "OPEN_GROUP", "OPEN_ABOUT"]);
  if (!allowed.has(type)) return null;
  const label = safeCloudText(raw.label, 48);
  if (!label) return null;
  if (type === "OPEN_URL") {
    const url = safeHttpsUrl(raw.url);
    return url ? {type, label, url} : null;
  }
  return {type, label};
}

function sanitizeExtensionState(raw) {
  const out = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    ttl_seconds: CLOUD_STATE_DEFAULT_TTL_SECONDS,
    sections: [],
    supporter: {active: false, until: null, label: ""},
    features: {supporter_card: false, community_banner: false}
  };
  if (!raw || typeof raw !== "object" || Number(raw.schema_version) !== 1) return out;

  const ttl = Number(raw.ttl_seconds);
  if (Number.isFinite(ttl)) out.ttl_seconds = Math.max(60, Math.min(86400, Math.floor(ttl)));

  if (Array.isArray(raw.sections)) {
    for (let i = 0; i < raw.sections.length && out.sections.length < 8; i++) {
      const item = raw.sections[i];
      if (!item || typeof item !== "object" || item.visible !== true) continue;
      const rawId = safeCloudText(item.id, 48);
      const id = /^[a-z0-9][a-z0-9_-]{0,47}$/i.test(rawId) ? rawId : `section-${i + 1}`;
      const kindRaw = safeCloudText(item.kind, 24).toLowerCase();
      const kind = ["info", "warning", "success", "community", "supporter", "sponsor"].includes(kindRaw) ? kindRaw : "info";
      const title = safeCloudText(item.title, 96);
      const text = safeCloudText(item.text, 700);
      if (!title && !text) continue;
      let action = sanitizeCloudAction(item.action);
      if (kind === "sponsor" && action?.type !== "OPEN_URL") action = null;
      out.sections.push({id, visible: true, kind, title, text, action});
    }
  }

  const supporter = raw.supporter && typeof raw.supporter === "object" ? raw.supporter : {};
  out.supporter = {
    active: supporter.active === true,
    until: safeCloudText(supporter.until, 64) || null,
    label: safeCloudText(supporter.label, 64)
  };
  const features = raw.features && typeof raw.features === "object" ? raw.features : {};
  out.features = {
    supporter_card: features.supporter_card === true,
    community_banner: features.community_banner === true
  };
  return out;
}

function extensionStateKey(channel) {
  return `extension-state:${normalizeDistributionChannel(channel)}`;
}

async function extensionState(request, env, url) {
  const channel = normalizeDistributionChannel(url.searchParams.get("distribution_channel"));
  let state = null;
  if (env.PAIRINGS) state = await env.PAIRINGS.get(extensionStateKey(channel), "json");
  if (!state) {
    const raw = envString(env, channelEnvName(channel, "STATE_JSON"), envString(env, "EXTENSION_STATE_JSON", ""));
    if (raw) {
      try { state = JSON.parse(raw); } catch { state = null; }
    }
  }
  return json(sanitizeExtensionState(state), 200, corsHeaders(request));
}

async function adminExtensionState(request, env, url) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }
  if (!env.PAIRINGS) return json({error: "PAIRINGS KV belum dikonfigurasi"}, 503, corsHeaders(request));
  const channel = normalizeDistributionChannel(url.searchParams.get("distribution_channel"));
  const key = extensionStateKey(channel);

  if (request.method === "GET") {
    const existing = await env.PAIRINGS.get(key, "json");
    return json({channel, state: sanitizeExtensionState(existing)}, 200, corsHeaders(request));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({error: "JSON body tidak valid"}, 400, corsHeaders(request));
  const state = sanitizeExtensionState(body);
  await env.PAIRINGS.put(key, JSON.stringify(state));
  return json({ok: true, channel, state}, 200, corsHeaders(request));
}

function secureHtml(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function reviewerPage() {
  return secureHtml(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BMP Terbuka Store Review</title><style>body{font:16px system-ui;max-width:560px;margin:40px auto;padding:0 18px;line-height:1.5}label{display:block;margin:14px 0 5px}input{width:100%;box-sizing:border-box;padding:10px}button{margin-top:16px;padding:10px 14px}</style><h1>BMP Terbuka Store Review</h1><p>Use only the temporary reviewer code supplied privately in Microsoft/Chrome certification notes.</p><form method="post" action="/v1/reviewer/activate"><label>Pair ID</label><input name="pair_id" autocomplete="off" required><label>Reviewer code</label><input name="reviewer_code" type="password" autocomplete="off" required><button type="submit">Activate review installation</button></form></html>`);
}

async function reviewerRateLimit(request, env) {
  if (!env.PAIRINGS || !env.MEMBER_HASH_SALT) return true;
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!ip) return true;
  const fingerprint = await sha256Hex(`review-rate:${ip}:${env.MEMBER_HASH_SALT}`);
  const key = `review-rate:${fingerprint}`;
  const count = Number(await env.PAIRINGS.get(key) || 0);
  if (count >= 10) return false;
  await env.PAIRINGS.put(key, String(count + 1), {expirationTtl: 10 * 60});
  return true;
}

async function issueReviewerToken(env, installId) {
  const now = Math.floor(Date.now() / 1000);
  const header = {alg: "RS256", typ: "JWT"};
  const payload = {
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    install_id: installId,
    iat: now,
    exp: now + REVIEWER_TOKEN_TTL_SECONDS,
    scope: ["community_access", "store_review"],
    member_ref: await sha256Hex(`store-reviewer:${env.MEMBER_HASH_SALT || ""}`)
  };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const signingInput = `${h}.${p}`;
  const key = await importSigningKey(env);
  const sig = await crypto.subtle.sign({name: "RSASSA-PKCS1-v1_5"}, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

async function reviewerActivate(request, env) {
  if (!(await reviewerRateLimit(request, env))) {
    return new Response("Too many attempts.", {status: 429, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  }
  if (!env.STORE_REVIEWER_SECRET) {
    return new Response("Reviewer activation is not configured.", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  }
  const contentType = request.headers.get("Content-Type") || "";
  let pairId = "";
  let reviewerCode = "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    pairId = String(body.pair_id || "").trim();
    reviewerCode = String(body.reviewer_code || "");
  } else {
    const form = await request.formData().catch(() => null);
    pairId = String(form?.get("pair_id") || "").trim();
    reviewerCode = String(form?.get("reviewer_code") || "");
  }
  if (!pairId || reviewerCode !== String(env.STORE_REVIEWER_SECRET)) {
    return new Response("Invalid pair ID or reviewer code.", {status: 403, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  }
  const key = `pair:${pairId}`;
  const record = await env.PAIRINGS.get(key, "json");
  if (!record) return new Response("Pair session expired. Start activation again in the extension.", {status: 410, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  if (!storeChannel(normalizeDistributionChannel(record.distribution_channel))) {
    return new Response("This pair is not a Store review build.", {status: 403, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  }
  const token = await issueReviewerToken(env, record.install_id);
  await env.PAIRINGS.put(key, JSON.stringify({...record, status: "verified", token, verified_at: Date.now(), verification_source: "store_reviewer"}), {expirationTtl: PAIR_TTL_SECONDS});
  return secureHtml('<!doctype html><html lang="en"><meta charset="utf-8"><title>Activated</title><body style="font:16px system-ui;max-width:560px;margin:40px auto;padding:0 18px"><h1>Review installation activated</h1><p>Return to the BMP Terbuka extension popup. It will detect activation automatically.</p></body></html>');
}

function versionParts(value) {
  return String(value || "")
    .split(".")
    .slice(0, 4)
    .map(x => Number.parseInt(x, 10))
    .map(x => Number.isFinite(x) ? x : 0);
}

function compareVersions(a, b) {
  const x = versionParts(a);
  const y = versionParts(b);
  const n = Math.max(x.length, y.length, 3);
  for (let i = 0; i < n; i++) {
    const xa = x[i] || 0;
    const ya = y[i] || 0;
    if (xa < ya) return -1;
    if (xa > ya) return 1;
  }
  return 0;
}

function releaseUrl(env) {
  return String(
    env.EXTENSION_RELEASE_URL || env.CHANNEL_URL || "https://t.me/bukabmp"
  ).trim();
}

async function pairStart(request, env) {
  if (!(await checkPairRateLimit(request, env))) {
    return json({error: "Terlalu banyak permintaan aktivasi. Coba lagi sebentar."}, 429, corsHeaders(request));
  }
  const body = await request.json().catch(() => ({}));
  const extensionVersion = String(body.extension_version || "").trim();
  const distributionChannel = normalizeDistributionChannel(body.distribution_channel);
  const policy = channelPolicy(env, distributionChannel);
  const minimumVersion = policy.minimumVersion;
  if (!extensionVersion || (minimumVersion && compareVersions(extensionVersion, minimumVersion) < 0)) {
    return json({
      error: `Versi BMP Terbuka ini sudah tidak didukung. Update ke versi ${minimumVersion || policy.latestVersion} atau lebih baru.`,
      code: "update_required",
      minimum_version: minimumVersion || null,
      release_url: policy.releaseUrl,
      distribution_channel: distributionChannel
    }, 426, corsHeaders(request));
  }

  const installId = String(body.install_id || "");
  if (!/^[0-9a-fA-F-]{20,64}$/.test(installId)) {
    return json({error: "install_id tidak valid"}, 400);
  }
  if (!env.BOT_USERNAME) {
    return json({error: "BOT_USERNAME belum dikonfigurasi"}, 503);
  }

  const pairId = randomToken(9);
  const pollSecret = randomToken(24);
  const now = Date.now();
  const record = {
    install_id: installId,
    extension_version: extensionVersion,
    distribution_channel: distributionChannel,
    poll_secret_hash: await sha256Hex(pollSecret),
    status: "pending",
    created_at: now
  };

  await env.PAIRINGS.put(`pair:${pairId}`, JSON.stringify(record), {
    expirationTtl: PAIR_TTL_SECONDS
  });

  return json({
    pair_id: pairId,
    poll_secret: pollSecret,
    deep_link: `https://t.me/${env.BOT_USERNAME}?start=${encodeURIComponent(pairId)}`,
    expires_at: now + PAIR_TTL_SECONDS * 1000
  }, 200, corsHeaders(request));
}

async function pairStatus(request, env, url) {
  const pairId = String(url.searchParams.get("pair_id") || "");
  const auth = request.headers.get("Authorization") || "";
  const pollSecret = auth.startsWith("Pair ") ? auth.slice(5) : "";
  if (!pairId || !pollSecret) {
    return json({error: "Pair authorization diperlukan"}, 401, corsHeaders(request));
  }

  const record = await env.PAIRINGS.get(`pair:${pairId}`, "json");
  if (!record) return json({status: "expired"}, 200, corsHeaders(request));

  const expected = record.poll_secret_hash;
  const actual = await sha256Hex(pollSecret);
  if (!expected || expected !== actual) {
    return json({error: "Pair authorization tidak valid"}, 403, corsHeaders(request));
  }

  if (record.status === "verified" && record.token) {
    return json({status: "verified", token: record.token}, 200, corsHeaders(request));
  }
  return json({status: "pending"}, 200, corsHeaders(request));
}


function versionPolicy(request, env, url) {
  const currentVersion = String(url.searchParams.get("extension_version") || "").trim();
  const channel = normalizeDistributionChannel(url.searchParams.get("distribution_channel"));
  const policy = channelPolicy(env, channel);

  return json({
    current_version: currentVersion || null,
    distribution_channel: policy.channel,
    latest_version: policy.latestVersion,
    minimum_version: policy.minimumVersion || null,
    force_after: policy.forceAfter,
    release_url: policy.releaseUrl,
    message: policy.message,
    store_ready: policy.storeReady,
    check_after_seconds: VERSION_CHECK_AFTER_SECONDS
  }, 200, corsHeaders(request));
}


async function adminSetWebhook(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401);
  }
  if (!env.PUBLIC_BASE_URL || !env.TELEGRAM_WEBHOOK_SECRET) {
    return json({error: "PUBLIC_BASE_URL / TELEGRAM_WEBHOOK_SECRET belum diset"}, 503);
  }

  const webhook = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/telegram/webhook`;
  const result = await tg(env, "setWebhook", {
    url: webhook,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "edited_message", "callback_query", "pre_checkout_query"],
    drop_pending_updates: true
  });
  await tg(env, "setMyCommands", {
    commands: [
      {command: "start", description: "Aktivasi BMP Terbuka"},
      {command: "verify", description: "Verifikasi kode aktivasi"},
      {command: "ask", description: "Tanya BMP Terbuka Assistant"},
      {command: "tutorial", description: "Cara pakai v1.0.5"},
      {command: "install", description: "Cara instalasi"},
      {command: "android", description: "Tutorial Android"},
      {command: "desktop", description: "Tutorial Desktop"},
      {command: "group", description: "Join Group Terbuka"},
      {command: "update", description: "Versi terbaru"},
      {command: "fitur", description: "Fitur v1.0.5"},
      {command: "storage", description: "Storage/resume/export"},
      {command: "bug", description: "Format laporan kendala"},
      {command: "quota", description: "Cek sisa kuota AI"},
      {command: "support", description: "Supporter Pass via Stars"},
      {command: "supporter", description: "Status Supporter Pass"},
      {command: "supporters", description: "Supporter Wall"},
      {command: "terms", description: "Terms Supporter Pass"},
      {command: "paysupport", description: "Bantuan pembayaran Stars"},
      {command: "bmphelp", description: "Bantuan bot"}
    ]
  }).catch(() => {});
  return json({ok: true, webhook, result});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {status: 204, headers: corsHeaders(request)});
    }

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({
          service: "BMP Terbuka Community",
          version: APP_VERSION,
          status: "ok",
          stores_documents: false,
          stores_source_credentials: false,
          support_bot: true,
          support_kb_entries: SUPPORT_KB.length,
          support_ai_model: SUPPORT_AI_MODEL,
          support_ai_configured: Boolean(env.AI && typeof env.AI.run === "function"),
          support_access_mode: "group_only_except_privileged_or_active_supporter",
          support_privileged_users_configured: supportPrivilegedUserIds(env).size,
          support_group_configured: Boolean(env.SUPPORT_GROUP_ID || env.GROUP_ID),
          support_explicit_trigger_only: true,
          privacy_gate_enabled: true,
          privacy_gate_scope: "official_group_text_caption_contact_location",
          supporter_pass: true,
          supporter_packages: {day: {stars: 2, days: 1}, month: {stars: 50, days: 30}},
          supporter_activation_bonus_days: SUPPORTER_ACTIVATION_BONUS_DAYS,
          supporter_activation_max_days: SUPPORTER_ACTIVATION_MAX_DAYS,
          supporter_context_turns: SUPPORTER_CONTEXT_MAX_TURNS,
          store_channels: ["cws", "edge"],
          realtime_extension_state: true,
          reviewer_activation_configured: Boolean(env.STORE_REVIEWER_SECRET)
        }, 200, corsHeaders(request));
      }

      if (url.pathname === "/v1/version" && request.method === "GET") {
        return versionPolicy(request, env, url);
      }

      if (url.pathname === "/v1/extension-state" && request.method === "GET") {
        return await extensionState(request, env, url);
      }

      if (url.pathname === "/review" && request.method === "GET") {
        return reviewerPage();
      }

      if (url.pathname === "/v1/reviewer/activate" && request.method === "POST") {
        return await reviewerActivate(request, env);
      }

      if (url.pathname === "/v1/pair/start" && request.method === "POST") {
        return await pairStart(request, env);
      }

      if (url.pathname === "/v1/pair/status" && request.method === "GET") {
        return await pairStatus(request, env, url);
      }

      if (url.pathname === "/telegram/webhook" && request.method === "POST") {
        if (!telegramWebhookAuthorized(request, env)) {
          return json({error: "unauthorized"}, 401);
        }

        const update = await request.json();
        const claim = await claimTelegramUpdate(env, update?.update_id);
        if (!claim.process) {
          return json({ok: true});
        }

        try {
          await handleTelegram(env, update);
        } catch (e) {
          console.error("telegram_update_failed", {
            update_id: update?.update_id,
            error: String(e?.stack || e)
          });

          const chatId =
            update?.message?.chat?.id ??
            update?.callback_query?.message?.chat?.id ??
            null;

          if (chatId) {
            const isGroupUpdate = ["group", "supergroup"].includes(update?.message?.chat?.type || "");
            await tg(env, "sendMessage", {
              chat_id: chatId,
              text: isGroupUpdate
                ? "⚠️ BMP Terbuka Assistant lagi error sebentar. Coba lagi nanti atau kirim detail kendalanya supaya member lain bisa bantu."
                : "⚠️ Aktivasi belum selesai karena terjadi kesalahan backend. Update sudah diterima dan tidak akan mengunci antrean bot."
            }).catch(() => {});
          }
        }

        // Important: always acknowledge a valid Telegram webhook with HTTP 200.
        // A poisoned activation update must never block later /start messages.
        return json({ok: true});
      }

      if (url.pathname === "/admin/extension-state" && ["GET", "POST"].includes(request.method)) {
        return await adminExtensionState(request, env, url);
      }

      if (url.pathname === "/admin/set-webhook" && request.method === "POST") {
        return await adminSetWebhook(request, env);
      }

      return json({error: "not_found"}, 404, corsHeaders(request));
    } catch (e) {
      console.error(e);
      return json({error: "internal_error"}, 500, corsHeaders(request));
    }
  }
};