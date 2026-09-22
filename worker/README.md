# BMP Terbuka Community Worker

Production source for the Cloudflare Worker connected through Workers Builds.

Deployment is controlled by the `cloudflare-worker-prod` branch.

## v0.2 pre-release additions

The `worker-control-v0.2-media-analytics` candidate adds source-only support for:
- BMP-owned sponsor media in R2 binding `AD_MEDIA`;
- privacy-bounded anonymous telemetry and compact analytics in D1;
- Telegram Channel/Group member-count aggregates;
- global readiness-aware version policy;
- atomic `ALL` Control Center state publication;
- Control Center v0.2.

Before any production deployment, the Owner must separately provision `AD_MEDIA`, apply `0003_media_analytics.sql`, configure an independent `TELEMETRY_HASH_KEY`, and verify Store readiness. Branch/source validation does not perform those production mutations.
