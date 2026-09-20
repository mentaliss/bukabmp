# Cloud Surface Contract

Cloud Surface adalah jalur **data/state**, bukan jalur pengiriman executable code.

## Endpoint concept

```text
GET /v1/extension-state
```

Endpoint belum wajib diaktifkan untuk initial CWS submission. Dokumen ini menetapkan kontrak agar implementasi backend/client berikutnya tidak melanggar boundary MV3/CWS.

## Candidate schema

```json
{
  "schema_version": 1,
  "generated_at": "2026-09-20T00:00:00Z",
  "ttl_seconds": 3600,
  "supporter": {
    "active": false,
    "until": null,
    "label": "BMP Supporter"
  },
  "notice": {
    "id": "notice-001",
    "visible": false,
    "kind": "info",
    "title": "",
    "text": "",
    "action": {
      "label": "",
      "url": ""
    }
  },
  "community": {
    "visible": true,
    "text": "",
    "action": {
      "label": "",
      "url": ""
    }
  },
  "features": {
    "supporter_card": false,
    "community_banner": true
  },
  "sponsor": {
    "visible": false,
    "campaign_id": "",
    "label": "Sponsor",
    "title": "",
    "text": "",
    "image_url": "",
    "target_url": ""
  }
}
```

## Allowlist

Allowed value classes:
- boolean;
- bounded plain text/labels;
- ISO dates/timestamps;
- bounded integer TTL;
- HTTPS destination URLs;
- HTTPS image URLs;
- known enum/component kinds;
- feature flags for code paths already present in the reviewed extension package.

## Forbidden

The client must reject/ignore:
- JavaScript source or URLs intended to load JavaScript;
- arbitrary HTML;
- remote WASM or executable worker URLs;
- CSS/code injection;
- expressions/templates interpreted as code;
- command strings interpreted as executable instructions;
- downloaded functionality not already present in the reviewed package.

Unknown keys must be ignored or rejected according to schema version. Invalid payloads fail closed to built-in defaults.

## Ads/supporter boundary

Sponsor/ads are not part of the initial CWS acceptance build. A future sponsor slot may use this data contract only after privacy/listing disclosures are updated. It must never inject content into RBV pages or generated PDFs and must not use document/OCR data for ad targeting.
