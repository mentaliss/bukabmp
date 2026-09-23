# BMP Terbuka public website

Static bilingual website source deployed through GitHub Pages.

Public URL:
- https://mentaliss.github.io/bukabmp/

Build:
- npm run build:site
- npm run validate:site

Output directory: dist-site

Build-time values:
- BMP_SITE_BASE_PATH
- BMP_SITE_URL
- BMP_EDGE_ADDONS_URL
- BMP_BUSINESS_CONTACT_URL
- BMP_GITHUB_ZIP_URL

Current GitHub Pages deployment uses:
- BMP_SITE_BASE_PATH=/bukabmp
- BMP_SITE_URL=https://mentaliss.github.io/bukabmp
- BMP_EDGE_ADDONS_URL=https://microsoftedge.microsoft.com/addons/detail/mkgmigiagipmfdlppehhmckfokmpnmlm
- BMP_BUSINESS_CONTACT_URL=https://t.me/bukabmp?direct
- BMP_GITHUB_ZIP_URL=https://github.com/mentaliss/bukabmp/releases/download/v1.0.5/BMP-Terbuka-v1.0.5.zip

The manual-download URL intentionally remains the current stable v1.0.5 release asset while v1.1.0 is Unreleased.

No database or user account is required. The site is static and does not depend on the private Worker for normal page rendering.

GitHub Pages deployment:
- workflow: .github/workflows/pages.yml
- build command: npm run build:site
- output directory: dist-site
