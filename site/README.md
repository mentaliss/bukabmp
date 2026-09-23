# BMP Terbuka public website

Static bilingual website source for Cloudflare Pages.

Build:
- npm run build:site
- npm run validate:site

Output directory: dist-site

Optional build-time values:
- BMP_EDGE_ADDONS_URL
- BMP_BUSINESS_CONTACT_URL
- BMP_GITHUB_ZIP_URL

BMP_GITHUB_ZIP_URL defaults to the currently verified stable asset:
BMP-Terbuka-v1.0.5.zip from GitHub Release v1.0.5.

If either value is missing, the generated site shows a disabled, clearly marked pending-verification CTA instead of inventing a URL.

No database or user account is required. The site is static and must not depend on the private Worker for normal page rendering.

Cloudflare Pages target:
- build command: npm run build:site
- output directory: dist-site

Custom domain is intentionally not hardcoded.