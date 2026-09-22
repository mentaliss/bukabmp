# Microsoft Edge Add-ons Submission Pack — Candidate

Status: **submission-ready package preparation**, not proof of Microsoft certification. Initial publication target: **Hidden**.

## Distribution

Build:

```bash
npm run build:edge
npm run validate:edge
```

GitHub Actions artifact:

```text
bmp-terbuka-edge-candidate
└── BMP-Terbuka-v<VERSION>-EDGE.zip
```

The ZIP is flat-root and contains `manifest.json` at package root. Microsoft Edge Add-ons accepts a ZIP package and handles Store distribution/update after certification.

## Identity rule

Do not attempt to force the Edge Add-ons identity to equal the existing manually signed Android CRX identity. Treat these as separate distribution identities until experimentally proven otherwise.

Existing Android CRX users remain on the existing signed/manual path unless they explicitly install the Store edition.

## Update policy

The Edge build sends:

```text
distribution_channel=edge
```

Backend version policy for Edge must be independent from CWS/GitHub/Android. While a new Edge submission is in review, return `store_ready=false`. Only after the version is actually available in Edge Add-ons may backend set `store_ready=true` and enforce a higher minimum version.

Microsoft documents that package updates enter certification and become available when the submission is `In the store`. Store/browser distribution then handles the published update.

## Permissions

Edge package uses the same minimum-permission Store profile as CWS:
- `storage`
- `downloads`
- `offscreen`
- `clipboardWrite`

Broad `tabs` is removed only from Store package output. The narrow reader/API host permissions remain.

## Reviewer/certification access

The client now includes a reviewer-only local OCR fixture. It is exposed only when the normal signed activation token contains the `store_review` scope.

Backend Store-control V11 candidate provides:
- a temporary reviewer activation page at `/review`;
- private server-side reviewer secret;
- installation-bound RS256 token issuance;
- 24-hour reviewer token;
- rate-limited reviewer attempts;
- no public hard-coded bypass.

The exact audited production Worker commit used by the 1.1.0 candidate must be deployed and smoke-tested before Partner Center submission. The private reviewer secret belongs only in Partner Center certification notes, never in this repository.

Exact fields and reviewer instructions are frozen in `docs/EDGE_PARTNER_CENTER_FIELDS.md`.

## Required real-device regression before submission

Automated CI already proves build/package/static compatibility. Before submission, test the actual Edge package in a clean Edge profile against authenticated RBV:
- activation;
- active-tab reader detection without broad `tabs`;
- OCR;
- page-count termination;
- resume/cache;
- cached export;
- merge;
- safe-stop;
- Worker outage;
- realtime cloud/status + sponsor card;
- successful START_JOB followed by a 2–5 second sponsor/house interstitial without blocking OCR;
- sponsor event privacy/integrity;
- token-v2 refresh + Supporter snapshot;
- Store-channel update behavior;
- same-listing 1.0.5 → 1.1.0 preservation of token, draft, IndexedDB cache, and resume state.

Android Edge Canary signed CRX must be regression-tested separately because its private signing path is intentionally outside this public repo.

## Upgrade identity gate

A separately installed candidate cannot prove persistence. Before public rollout, update the **existing Edge Store listing** from 1.0.5 to 1.1.0 in a controlled/hidden path and verify the browser preserves extension storage. Do not raise the Edge minimum version until this same-listing update is available and passes regression.
