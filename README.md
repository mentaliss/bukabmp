<p align="center">
  <img src="extension/icons/icon128.png" width="150" alt="BMP Terbuka">
</p>

<h1 align="center">BMP Terbuka</h1>

<p align="center"><strong>Materi yang dapat kamu akses, lebih nyaman untuk kamu pelajari.</strong></p>

BMP Terbuka adalah browser extension open-source yang membantu mengubah materi yang sudah dapat kamu akses secara sah menjadi searchable PDF untuk belajar, dengan OCR dan penyusunan PDF yang berjalan lokal di perangkat.

> **Rilis stabil:** **v1.1.0** — 23 September 2026.

## Website resmi

**[Buka website BMP Terbuka](https://mentaliss.github.io/bukabmp/)**

Website adalah pintu utama untuk pengguna, sponsor, partner, dan investor. Repository ini tetap menjadi sumber untuk source code, release, dan dokumentasi publik.

## Download

- **Microsoft Edge — Desktop:** melalui [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm).
- **Microsoft Edge — Android:** melalui [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm).
- **Manual / supported Chromium:** gunakan asset ZIP hasil build di GitHub Releases, bukan asset otomatis Source code (zip).

Untuk instalasi manual, gunakan asset resmi `BMP-Terbuka-v1.1.0.zip` dari GitHub Release v1.1.0.

Lihat [Panduan Instalasi](docs/INSTALL.md), [Compatibility](docs/COMPATIBILITY.md), dan [Release Process](docs/RELEASE.md).

## Local-first, bukan zero-network

Halaman materi, OCR, cache PDF, penggabungan PDF, dan ekspor PDF diproses di perangkat. Backend BMP Terbuka tidak digunakan untuk mengunggah gambar halaman, teks OCR, atau PDF hasil.

Extension tetap melakukan request jaringan untuk fungsi yang memang membutuhkan layanan eksternal: aktivasi komunitas, version/realtime state, telemetry pseudonymous, serta sponsor/advertising state dan metrics yang terbatas.

Baca [Privacy](PRIVACY.md), [Security](SECURITY.md), dan [Responsible Use](RESPONSIBLE_USE.md).

## Open source dan batasnya

Repository publik ini berisi source extension Manifest V3, public tooling, source website publik, dokumentasi publik, dan release metadata.

Repository publik ini tidak memuat implementation Worker produksi, bot/backend Telegram, Control Center, D1 migration/schema privat, secret produksi, private signing key, atau material deployment privat.

Source yang dipublikasikan di repository ini menggunakan **GPL-3.0**. Hak atas nama/logo/branding BMP Terbuka tidak otomatis diberikan oleh GPL; lihat [TRADEMARK.md](TRADEMARK.md). Dependency pihak ketiga tetap memakai lisensinya masing-masing; lihat [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Sponsor, iklan, dan partnership

BMP Terbuka terbuka terhadap sponsorship/advertising yang legal, non-deceptive, non-malicious, dan sesuai aturan platform/distribusi. Pendanaan tidak membeli akses ke data pengguna atau kontrol atas keputusan privasi, keamanan, moderasi, dan core product.

- [Sponsorship & Advertising](SPONSORSHIP.md)
- [Advertiser Terms](ADVERTISER_TERMS.md)
- [Funding Transparency](FUNDING_TRANSPARENCY.md)
- [Ethics & Independence](ETHICS_INDEPENDENCE.md)

Harga iklan/sponsorship belum dipublikasikan.

## Komunitas

- **Channel:** [Buka BMP](https://t.me/bukabmp)
- **Group:** [Group Terbuka](https://t.me/+0pAg9ymEhWdkZmNl)
- **Bot aktivasi:** [@bukabmp_bot](https://t.me/bukabmp_bot)

## Developer / contributor

- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)

## Independensi

BMP Terbuka adalah proyek komunitas independen. Pencantuman layanan atau platform yang kompatibel tidak berarti afiliasi, dukungan resmi, atau endorsement dari pemilik layanan tersebut.
