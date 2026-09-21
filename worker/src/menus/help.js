import {SUPPORTER_CONTEXT_MAX_TURNS} from "../features/supporter-model.js";

const SUPPORT_ANDROID_INSTALL_TEXT_URL = "https://t.me/bukabmp/11?comment=168";
const SUPPORT_ANDROID_USAGE_VIDEO_V104_URL = "https://t.me/bukabmp/11?comment=294";
const SUPPORT_DESKTOP_USAGE_VIDEO_V104_URL = "https://t.me/c/4381494564/18";
export const SUPPORT_GROUP_JOIN_URL = "https://t.me/bukabmp/13";
const SUPPORT_RELEASE_URL = "https://github.com/mentaliss/bukabmp/releases/latest";

export function supportHelpText(access = null) {
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

export function tutorialText() {
  return [
    "📘 Cara pakai BMP Terbuka v1.0.5",
    "",
    "1. Buka BMP di RBV, lalu ambil Kode BMP dari nilai ?modul= pada URL reader. Kode BMP tidak selalu sama dengan kode mata kuliah.",
    "",
    "2. Isi Kode BMP + range modul yang mau diproses, misalnya M1–M9, lalu mulai proses. Jalankan extension saat tab aktif sedang membuka reader RBV.",
    "",
    "3. Kalau proses terhenti, tinggal lanjut lagi. Modul yang sudah selesai disimpan lokal dan otomatis dilewati, jadi tidak perlu OCR ulang dari awal.",
    "",
    "4. Kalau mau mengulang modul tertentu, aktifkan ‘Download ulang modul yang dipilih’ lalu tentukan range. Hanya range itu yang diproses ulang.",
    "",
    "5. ‘Buat PDF gabungan’ bersifat opsional. Bisa FULL jika lengkap atau range tertentu seperti M3–M6. Kalau ada gap, merge tidak dibuat sampai lengkap.",
    "",
    "6. PDF yang sudah tersimpan lokal bisa diekspor ulang satu atau beberapa modul tanpa OCR. Kalau file di Downloads terhapus tetapi storage lokal masih ada, tinggal ekspor ulang.",
    "",
    "7. ‘Kosongkan penyimpanan BMP ini’ hanya menghapus data lokal BMP dari extension; PDF yang sudah ada di Downloads tidak ikut terhapus.",
    "",
    "Video Android v1.0.4: " + SUPPORT_ANDROID_USAGE_VIDEO_V104_URL,
    "Video Desktop v1.0.4: " + SUPPORT_DESKTOP_USAGE_VIDEO_V104_URL
  ].join("\n");
}

export function installText() {
  return [
    "📦 Instalasi BMP Terbuka",
    "",
    "Android: Microsoft Edge Canary + paket Android-CRX.",
    "Tutorial instalasi Android: " + SUPPORT_ANDROID_INSTALL_TEXT_URL,
    "",
    "Desktop: Google Chrome atau Microsoft Edge. Download ZIP release → extract → Developer mode → Load unpacked.",
    "",
    "Release terbaru: " + SUPPORT_RELEASE_URL
  ].join("\n");
}

export function androidHelpText() {
  return [
    "📱 Android — Microsoft Edge Canary",
    "",
    "Tutorial instalasi (teks): " + SUPPORT_ANDROID_INSTALL_TEXT_URL,
    "Video penggunaan v1.0.4: " + SUPPORT_ANDROID_USAGE_VIDEO_V104_URL,
    "",
    "Untuk fitur v1.0.5 ketik /tutorial atau /fitur.",
    "Release: " + SUPPORT_RELEASE_URL
  ].join("\n");
}

export function desktopHelpText() {
  return [
    "🖥 Desktop — Google Chrome / Microsoft Edge",
    "",
    "Video penggunaan v1.0.4: " + SUPPORT_DESKTOP_USAGE_VIDEO_V104_URL,
    "Untuk fitur v1.0.5 ketik /tutorial atau /fitur.",
    "",
    "Release: " + SUPPORT_RELEASE_URL
  ].join("\n");
}

export function groupHelpText() {
  return "Group Terbuka: " + SUPPORT_GROUP_JOIN_URL;
}

export function updateHelpText() {
  return "Versi terbaru: v1.0.5\n" + SUPPORT_RELEASE_URL;
}

export function featuresText() {
  return [
    "✨ Fitur utama v1.0.5",
    "",
    "• Resume: modul selesai disimpan lokal dan tidak perlu OCR ulang.",
    "• Ringkasan modul tersimpan + ukuran storage per Kode BMP.",
    "• Download ulang hanya range yang dipilih.",
    "• PDF gabungan opsional: FULL atau range tertentu.",
    "• Merge tidak dibuat kalau ada modul yang bolong.",
    "• Ekspor ulang satu/beberapa PDF dari storage tanpa OCR.",
    "• Kosongkan storage per BMP tanpa menghapus file Downloads.",
    "• Page-count berhenti tepat di halaman terakhir reader."
  ].join("\n");
}

export function storageText() {
  return [
    "💾 Penyimpanan lokal v1.0.5",
    "",
    "PDF modul yang selesai disimpan di storage extension untuk resume, merge, dan ekspor ulang.",
    "",
    "Kalau file di Downloads terhapus tetapi storage lokal masih ada → bisa ekspor ulang tanpa OCR.",
    "Kalau storage lokalnya yang dihapus → modul itu perlu diproses ulang bila dibutuhkan.",
    "Mengosongkan storage BMP tidak menghapus PDF yang sudah ada di Downloads."
  ].join("\n");
}

export function bugReportText() {
  return [
    "🛠 Biar kendalanya gampang dicek, kirim:",
    "• Screenshot error/posisi terakhir",
    "• Versi BMP Terbuka",
    "• Android atau Desktop",
    "• Kode BMP",
    "• Modul yang bermasalah",
    "",
    "Jangan kirim password, NIM, cookie, session/token, atau credential lain."
  ].join("\n");
}
