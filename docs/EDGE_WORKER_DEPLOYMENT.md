# Edge Store-control Worker V11 Deployment Gate

The Edge Store package must not be submitted until the tested V11 Store-control Worker candidate is deployed to the existing community service and smoke-tested.

## Candidate authority

Private Worker candidate:

```text
BMP-Terbuka-community-worker-v1.0.5-SUPPORT-BOT-V11-EDGE-STORE-CONTROL-CANDIDATE.js
```

Keep Worker source, signing material, bot token, reviewer secret, and operational secrets private.

## Existing bindings/secrets

Preserve all current production bindings/secrets. Do not recreate or rotate them merely for the Edge Store change.

The V11 patch is intended to be backward compatible with existing GitHub/Android clients.

## Edge channel variables before certification

Configure:

```text
EXTENSION_EDGE_LATEST_VERSION=1.0.5
EXTENSION_EDGE_MINIMUM_VERSION=1.0.5
EXTENSION_EDGE_STORE_READY=false
EXTENSION_EDGE_RELEASE_URL=
```

Optional:

```text
EXTENSION_EDGE_FORCE_AFTER=
EXTENSION_EDGE_UPDATE_MESSAGE=
```

Do not set `store_ready=true` merely because a package was uploaded. Keep it false while the submission is Draft, In review, or otherwise unavailable to users.

## Reviewer secret

Create a strong random secret as the private Worker secret:

```text
STORE_REVIEWER_SECRET=<private strong random value>
```

Never:
- commit it;
- put it in the extension package;
- put it in screenshots;
- put it in a public issue/chat/document.

Paste it only into the private Microsoft Partner Center certification notes.

## Required live smoke tests

After deploying V11 and before Store submission:

### Health

```text
GET /health
```

Confirm service remains healthy and reports Store-control/reviewer capability.

### Existing activation compatibility

Run one normal activation from an existing GitHub/Android build. Confirm:
- pair start succeeds;
- Telegram membership verification succeeds;
- pair status returns a valid existing-format token;
- no forced Edge/CWS policy leaks into the legacy channel.

### Edge version policy

```text
GET /v1/version?extension_version=1.0.5&distribution_channel=edge
```

Expected before Store publication:
- channel is `edge`;
- latest is 1.0.5;
- minimum is not enforced while `store_ready=false`;
- `store_ready=false`.

### Edge Cloud Surface

```text
GET /v1/extension-state?extension_version=1.0.5&distribution_channel=edge
```

A valid empty/default state is acceptable for initial publication.

### Reviewer flow

1. Start an Edge pair from the candidate extension.
2. Open `/review`.
3. Enter that Pair ID and the private reviewer secret.
4. Confirm pair status becomes verified.
5. Confirm the client recognizes the token as `store_review`.
6. Confirm the reviewer-only local OCR panel appears.
7. Run the fixture and confirm the searchable PDF is generated.

## Post-publication switch

Only after Microsoft reports the submission **In the store** and the direct listing URL works:

```text
EXTENSION_EDGE_RELEASE_URL=<final Microsoft Edge Add-ons listing URL>
EXTENSION_EDGE_STORE_READY=true
```

Keep `EXTENSION_EDGE_MINIMUM_VERSION=1.0.5` until a later Store version is actually published.

Future Edge releases follow the same rule: upload/review first with the old minimum still usable; raise the minimum only after the new package is truly available from the Store.

## Rollback

If V11 causes production activation/support regression:
1. restore the immediately previous Worker version;
2. keep `EXTENSION_EDGE_STORE_READY=false`;
3. do not submit or advance the Edge Store package;
4. preserve the failed V11 candidate/evidence for diagnosis rather than blindly retrying production deploy.
