# Third-Party Licenses

Release BMP Terbuka membundel dependency berikut pada waktu build:

| Komponen | Versi / sumber | Lisensi |
|---|---|---|
| Tesseract.js | 6.0.1 | Apache-2.0 |
| tesseract.js-core | 6.0.0 | Apache-2.0 |
| pdf-lib | 1.17.1 | MIT |
| Indonesian traineddata | `tesseract-ocr/tessdata_fast`, `ind.traineddata` | Apache-2.0 |

File lisensi dependency disertakan di dalam `vendor/licenses/` pada release build bila tersedia.

BMP Terbuka sendiri dilisensikan di bawah GPL-3.0.


## AdsOnBread

No live AdsOnBread production SDK is bundled in this source stage. `extension/vendor/adsonbread-test-sdk.js` is a BMP Terbuka test fixture, not vendor code. A live SDK may only be added after approval/license review and must be bundled locally for Manifest V3; remote executable JavaScript is not permitted.
