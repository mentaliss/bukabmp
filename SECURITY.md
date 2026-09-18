# Security Policy

## Scope repository

Repository ini mempublikasikan source **Chrome extension BMP Terbuka** dan tooling build/release extension. Source activation service dan infrastructure operasional tidak berada di repository publik ini.

## Melaporkan kerentanan

Jangan membuka detail kerentanan sensitif sebagai public GitHub Issue. Gunakan **GitHub Private Vulnerability Reporting / Security Advisories** bila tersedia.

Sertakan:
- versi BMP Terbuka;
- browser/OS;
- langkah reproduksi minimum;
- dampak;
- proof-of-concept yang tidak menyertakan credential atau materi berhak cipta.

## Contoh isu in-scope

- extension mengirim materi atau credential ke endpoint yang tidak semestinya;
- XSS/injection pada halaman extension;
- verifikasi signed activation token pada client dapat dibypass karena bug implementasi;
- penyimpanan credential sumber yang tidak disengaja;
- permission Chrome lebih luas daripada yang diperlukan;
- dependency/build artifact extension telah dimodifikasi tanpa terdeteksi.

Masalah yang terlihat melalui API aktivasi juga boleh dilaporkan secara privat bila berdampak pada keamanan pengguna, meskipun implementasi service tersebut tidak open-source di repository ini.

## Out of scope

- permintaan teknik untuk melewati kontrol keamanan situs pihak ketiga;
- credential stuffing;
- DDoS/request flooding;
- penghapusan watermark;
- laporan yang hanya menunjukkan bahwa community gate dapat diubah pada fork open-source.

Perbaikan keamanan harus memprioritaskan perlindungan pengguna dan data tanpa menambahkan teknik stealth/bypass terhadap layanan pihak ketiga.
