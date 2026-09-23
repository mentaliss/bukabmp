# Public Architecture

BMP Terbuka intentionally separates public client code from private production infrastructure.

## Public

- Manifest V3 browser extension;
- local OCR/PDF runtime assembled into release packages;
- public build/validation tooling;
- public website source and documentation.

## Private

- production Cloudflare Worker implementation;
- Telegram bot/backend implementation;
- Control Center;
- D1 migrations/private operational schema;
- deployment secrets and private signing material.

The extension communicates with public backend endpoints for activation, version/realtime state, pseudonymous telemetry, and sponsor state. Document pages, OCR text, and generated PDFs are not sent to the BMP Terbuka backend as part of the OCR workflow.