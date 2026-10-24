# Security Policy

## Scope publik

Repository ini mempublikasikan source browser extension BMP Terbuka, public website source, public build/release tooling, dan dokumentasi publik.

Secret produksi, private signing material, credential operator, serta konfigurasi provider privat tidak boleh berada di package extension atau dokumentasi publik.

## Melaporkan kerentanan

Jangan membuka detail kerentanan sensitif sebagai public GitHub Issue. Gunakan **GitHub Private Vulnerability Reporting / Security Advisories** bila tersedia.

Sertakan:
- versi/build atau halaman yang terdampak;
- browser/OS bila relevan;
- langkah reproduksi minimum;
- dampak;
- proof-of-concept yang tidak menyertakan credential, file backup pribadi, atau materi berhak cipta.

## Prinsip keamanan v1.2.0

- credential sumber tetap berada pada browser/source service;
- OCR dan PDF utama local-first;
- Quiz tidak mengunggah raw PDF atau page image;
- Backup dapat mengandung data belajar/material lokal sehingga harus diperlakukan sebagai file privat;
- remote state tidak boleh menyuntikkan arbitrary executable code;
- 403/429/re-authentication memicu safe stop, bukan blind retry;
- update normal tidak boleh meminta pengguna menghapus storage sebagai langkah default;
- Store identity harus menggunakan jalur publikasi resmi, bukan CRX diagnostic/audit.

## Out of scope

- permintaan teknik untuk melewati kontrol keamanan situs pihak ketiga;
- credential stuffing;
- DDoS/request flooding;
- penghapusan watermark;
- laporan yang hanya menunjukkan bahwa community gate dapat diubah pada fork open-source.

Perbaikan keamanan harus memprioritaskan perlindungan pengguna dan data tanpa menambahkan teknik stealth/bypass terhadap layanan pihak ketiga.
