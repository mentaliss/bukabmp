# Third-Party Licenses

Release BMP Terbuka membundel dependency berikut pada waktu build:

| Komponen | Versi / sumber | Lisensi |
|---|---|---|
| Tesseract.js | 6.0.1 | Apache-2.0 |
| tesseract.js-core | 6.0.0 | Apache-2.0 |
| pdf-lib | 1.17.1 | MIT |
| PDF.js (pdfjs-dist) | 3.11.174 (`pdf.min.js`, `pdf.worker.min.js`) | Apache-2.0 |
| Indonesian traineddata | `tesseract-ocr/tessdata_fast`, `ind.traineddata` | Apache-2.0 |

File lisensi dependency disertakan di dalam `vendor/licenses/` pada release build bila tersedia. Teks lisensi juga tersedia di repo pada `extension/vendor/licenses/` (mis. `LICENSE-pdfjs.txt`, `LICENSE-pdf-lib.md`, `LICENSE-tesseract-js.md`, `LICENSE-tesseract-core.txt`); pada release build file yang sama dikirim ke `vendor/licenses/LICENSE-pdfjs.txt`.

BMP Terbuka sendiri dilisensikan di bawah GPL-3.0.


## AdsOnBread

No live AdsOnBread production SDK is bundled in this source stage. `extension/vendor/adsonbread-test-sdk.js` is a BMP Terbuka test fixture, not vendor code. A live SDK may only be added after approval/license review and must be bundled locally for Manifest V3; remote executable JavaScript is not permitted.
