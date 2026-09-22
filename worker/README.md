# BMP Terbuka Community Worker

Production source for the Cloudflare Worker connected through Workers Builds.

Deployment is controlled by the `cloudflare-worker-prod` branch.

## v0.2 production requirements

The current Worker source expects:
- R2 bucket binding `AD_MEDIA` -> `bmp-terbuka-ad-media` declared in `wrangler.jsonc`;
- D1 database `bmp-terbuka-bot-v2`;
- independent `TELEMETRY_HASH_KEY`;
- readiness-aware Store policy.

The R2 binding is source-controlled so a GitHub/Workers Build deploy does not silently drop it.

## D1 migration ledger safety

Do **not** run `wrangler d1 migrations apply` blindly when the live schema already contains the Bot V2, activation-ledger, and media-analytics schema but `d1_migrations` is empty. Migration `0002_activation_ledger.sql` contains non-idempotent `ALTER TABLE ... ADD COLUMN` statements, so replaying historical migrations against an already-upgraded database can fail.

From `worker/`, first run the read-only guard:

```bash
npm run d1:reconcile-ledger
```

It verifies the required tables, columns, and indexes for `0001_bot_v2.sql`, `0002_activation_ledger.sql`, and `0003_media_analytics.sql`. It refuses to continue if the schema is incomplete or the ledger contains an unknown entry.

Only when the guard reports that all migration effects already exist, baseline the missing ledger rows without replaying schema changes:

```bash
npm run d1:reconcile-ledger:write
```

The write mode performs the same checks first, inserts only missing known migration names, then re-reads the remote ledger and fails if reconciliation does not converge.
