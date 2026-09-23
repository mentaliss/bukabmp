# Security Policy

## Scope publik

Repository ini mempublikasikan source **browser extension BMP Terbuka**, public website source, public build/release tooling, dan dokumentasi publik.

Production Worker, Telegram bot/backend, Control Center, D1 migrations/private operational schema, deployment secrets, dan private signing material tidak berada di repository publik.

## Melaporkan kerentanan

Jangan membuka detail kerentanan sensitif sebagai public GitHub Issue. Gunakan **GitHub Private Vulnerability Reporting / Security Advisories** bila tersedia.

Sertakan:
- versi/build atau halaman yang terdampak;
- browser/OS bila relevan;
- langkah reproduksi minimum;
- dampak;
- proof-of-concept yang tidak menyertakan credential atau materi berhak cipta.

## Contoh isu in-scope

- extension mengirim materi atau credential ke endpoint yang tidak semestinya;
- XSS/injection pada extension atau public website;
- signed activation token verification dapat dibypass karena bug client;
- penyimpanan credential sumber yang tidak disengaja;
- permission extension lebih luas daripada yang diperlukan;
- dependency/build artifact telah dimodifikasi tanpa terdeteksi;
- website membocorkan secret/private operational URL;
- unsafe external navigation.

Masalah yang terlihat melalui public activation/API surface juga boleh dilaporkan secara privat bila berdampak pada keamanan pengguna, meskipun implementation service tidak open-source di repository ini.

## Out of scope

- permintaan teknik untuk melewati kontrol keamanan situs pihak ketiga;
- credential stuffing;
- DDoS/request flooding;
- penghapusan watermark;
- laporan yang hanya menunjukkan bahwa community gate dapat diubah pada fork open-source.

Perbaikan keamanan harus memprioritaskan perlindungan pengguna dan data tanpa menambahkan teknik stealth/bypass terhadap layanan pihak ketiga.
