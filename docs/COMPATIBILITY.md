# Compatibility

BMP Terbuka V1 saat ini memiliki adapter untuk reader:

```text
https://pustaka.ut.ac.id/reader/
```

Pencantuman URL kompatibilitas tidak berarti afiliasi, dukungan resmi, atau endorsement dari pemilik layanan.

## Prinsip adapter

Adapter hanya boleh:
- menggunakan sesi user yang sudah login secara normal;
- meminta resource dalam konteks sesi tersebut;
- berhenti saat akses ditolak;
- mempertahankan watermark;
- memproses OCR/PDF lokal.

Adapter tidak boleh menambahkan teknik stealth, credential theft, pemalsuan token, IP rotation, atau blind retry.
