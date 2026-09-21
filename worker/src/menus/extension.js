import {renderMenu} from "./ui.js";
import {
  SUPPORT_ANDROID_INSTALL_TEXT_URL,
  SUPPORT_ANDROID_USAGE_VIDEO_V104_URL,
  SUPPORT_DESKTOP_USAGE_VIDEO_V104_URL,
  SUPPORT_RELEASE_URL
} from "./help.js";

function keyboard(rows) {
  return {inline_keyboard: rows};
}

export async function sendExtensionMenu(env, chatId, userId, messageId = null) {
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text: [
      "📚 Ekstensi BMP Terbuka",
      "",
      "Panduan penggunaan extension, aktivasi, proses BMP, PDF, storage, instalasi, dan troubleshooting."
    ].join("\n"),
    replyMarkup: keyboard([
      [
        {text: "🚀 Mulai Pakai", callback_data: "ext:start"},
        {text: "🔐 Aktivasi", callback_data: "ext:activation"}
      ],
      [
        {text: "🔎 Kode BMP", callback_data: "ext:code"},
        {text: "▶️ Proses BMP", callback_data: "ext:process"}
      ],
      [
        {text: "⏯ Resume", callback_data: "ext:resume"},
        {text: "📄 PDF / Export", callback_data: "ext:pdf"}
      ],
      [
        {text: "💾 Penyimpanan", callback_data: "ext:storage"},
        {text: "📦 Instalasi / Update", callback_data: "ext:install"}
      ],
      [{text: "🛠 Troubleshooting", callback_data: "ext:troubleshoot"}],
      [{text: "◀ Menu Utama", callback_data: "menu:main"}]
    ])
  });
}

const PAGES = {
  start: [
    "🚀 Mulai Menggunakan BMP Terbuka",
    "",
    "1. Buka reader RBV untuk BMP yang ingin diproses.",
    "2. Buka popup BMP Terbuka pada tab reader tersebut.",
    "3. Masukkan Kode BMP dan range modul, misalnya M1–M9.",
    "4. Mulai proses dan biarkan tab reader tetap aktif saat extension bekerja.",
    "5. Modul yang selesai akan disimpan lokal agar bisa di-resume, di-merge, atau diekspor ulang.",
    "",
    "Kalau proses berhenti di tengah, jangan langsung hapus storage. Buka halaman Resume untuk memahami cara melanjutkan."
  ].join("\n"),

  activation: [
    "🔐 Aktivasi BMP Terbuka",
    "",
    "Aktivasi dimulai dari popup extension, bukan dari bot.",
    "",
    "Alur normal:",
    "1. Buka popup BMP Terbuka.",
    "2. Pilih mulai/verifikasi aktivasi.",
    "3. Extension membuka bot dengan kode aktivasi.",
    "4. Bot memeriksa keanggotaan Buka BMP + Group Terbuka.",
    "5. Jika lolos, kembali ke extension. Popup akan mendeteksi aktivasi otomatis.",
    "",
    "Kalau deep-link Telegram tidak membawa kode:",
    "• salin kode aktivasi dari popup;",
    "• kirim /verify KODE ke bot ini.",
    "",
    "Kode aktivasi bersifat sementara. Kalau sudah kedaluwarsa, mulai lagi dari popup."
  ].join("\n"),

  code: [
    "🔎 Menemukan Kode BMP",
    "",
    "Kode BMP diambil dari nilai ?modul= pada URL reader RBV.",
    "Kode BMP tidak selalu sama dengan kode mata kuliah.",
    "",
    "Contoh pola:",
    "…/reader/index.php?modul=XXXX…",
    "",
    "Gunakan nilai modul yang dibaca reader sebagai Kode BMP di popup extension.",
    "",
    "Kalau ragu, buka reader BMP yang benar dulu lalu lihat URL tab aktif."
  ].join("\n"),

  process: [
    "▶️ Proses BMP",
    "",
    "Pilih range modul yang benar-benar ingin diproses, misalnya M1–M9 atau M3–M6.",
    "",
    "Extension memproses modul satu per satu. Modul yang sudah lengkap di storage lokal akan dilewati pada proses normal.",
    "",
    "Kalau ingin memaksa modul tertentu diproses ulang, gunakan fitur Download ulang modul yang dipilih dan tentukan range-nya.",
    "",
    "Jangan gunakan download ulang untuk seluruh BMP kalau yang rusak hanya satu modul."
  ].join("\n"),

  resume: [
    "⏯ Resume Proses",
    "",
    "Contoh: kamu menjalankan M1–M9 lalu proses berhenti setelah M4.",
    "",
    "Saat M1–M9 dijalankan lagi:",
    "• M1–M4 yang sudah lengkap di storage dilewati;",
    "• proses dilanjutkan dari modul yang belum selesai;",
    "• OCR tidak dimulai ulang dari M1.",
    "",
    "Kalau storage lokal modul sudah dihapus, modul tersebut memang perlu diproses ulang."
  ].join("\n"),

  pdf: [
    "📄 PDF, Merge, dan Export",
    "",
    "PDF per modul yang sudah tersimpan lokal bisa diekspor ulang tanpa OCR.",
    "",
    "Buat PDF gabungan bersifat opsional:",
    "• FULL jika semua modul yang dibutuhkan lengkap;",
    "• atau range tertentu, misalnya M3–M6.",
    "",
    "Kalau ada modul yang bolong di range merge, PDF gabungan tidak dibuat sampai range tersebut lengkap.",
    "",
    "File di Downloads adalah hasil ekspor. Authority resume tetap storage lokal extension."
  ].join("\n"),

  storage: [
    "💾 Penyimpanan Lokal",
    "",
    "Storage extension menyimpan hasil modul untuk resume, merge, dan export ulang.",
    "",
    "Jika file di Downloads terhapus tetapi storage masih ada:",
    "→ export ulang, tidak perlu OCR lagi.",
    "",
    "Jika storage lokal dihapus:",
    "→ modul perlu diproses ulang jika dibutuhkan.",
    "",
    "Kosongkan penyimpanan BMP ini hanya menghapus data lokal BMP dari extension; file PDF yang sudah ada di Downloads tidak ikut terhapus."
  ].join("\n"),

  install: [
    "📦 Instalasi & Update",
    "",
    "Android:",
    "Microsoft Edge Canary + paket Android-CRX.",
    "Panduan teks: " + SUPPORT_ANDROID_INSTALL_TEXT_URL,
    "",
    "Desktop:",
    "Google Chrome atau Microsoft Edge → download ZIP release → extract → Developer mode → Load unpacked.",
    "",
    "Release terbaru: " + SUPPORT_RELEASE_URL,
    "",
    "Video yang tersedia saat ini masih bertanda v1.0.4:",
    "Android: " + SUPPORT_ANDROID_USAGE_VIDEO_V104_URL,
    "Desktop: " + SUPPORT_DESKTOP_USAGE_VIDEO_V104_URL
  ].join("\n"),

  troubleshoot: [
    "🛠 Troubleshooting",
    "",
    "Kalau proses bermasalah, catat dulu:",
    "• posisi/modul terakhir;",
    "• Kode BMP;",
    "• versi BMP Terbuka;",
    "• Android atau Desktop;",
    "• screenshot error bila ada.",
    "",
    "Untuk proses berhenti → cek Resume.",
    "Untuk PDF hilang → cek Storage / Export ulang.",
    "Untuk aktivasi → buka halaman Aktivasi.",
    "",
    "Jangan kirim password, NIM, cookie, session, token, OTP, atau credential lain."
  ].join("\n")
};

export async function sendExtensionPage(
  env,
  chatId,
  userId,
  messageId,
  page
) {
  const text = PAGES[page];
  if (!text) return await sendExtensionMenu(env, chatId, userId, messageId);
  return await renderMenu(env, {
    chatId,
    userId,
    messageId,
    text,
    replyMarkup: keyboard([
      [{text: "◀ Panduan Ekstensi", callback_data: "menu:extension"}],
      [{text: "◀ Menu Utama", callback_data: "menu:main"}]
    ])
  });
}
