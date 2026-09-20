# Sponsor Surface

Status: candidate only. Disabled by default.

BMP Terbuka reserves one dedicated sponsor banner in the extension-owned popup surface. This is separate from normal Cloud Surface announcements.

## Safety and UX rules

- At most one sponsor banner is rendered.
- The label `Sponsor` is fixed by packaged extension code and cannot be removed remotely.
- Sponsor content is plain text only in this first version.
- Sponsor actions are restricted to packaged `OPEN_URL` handling with HTTPS URLs.
- No remote HTML, JavaScript, WebAssembly, tracking pixel, iframe, or remote image is rendered.
- The sponsor banner is shown only on the main extension screen; it is not injected into source websites.
- No sponsor is shown unless the backend explicitly returns a visible `kind: "sponsor"` section.
- Removing the sponsor section from realtime state acts as a remote kill switch.

## Example realtime state

```json
{
  "schema_version": 1,
  "ttl_seconds": 60,
  "sections": [
    {
      "id": "sponsor-demo",
      "visible": true,
      "kind": "sponsor",
      "title": "Partner belajar",
      "text": "Contoh penawaran sponsor.",
      "action": {
        "type": "OPEN_URL",
        "label": "Lihat penawaran",
        "url": "https://example.com/offer"
      }
    }
  ],
  "supporter": {
    "active": false,
    "until": null,
    "label": ""
  },
  "features": {
    "supporter_card": false,
    "community_banner": false
  }
}
```

The current Microsoft Edge Store v1.0.5 live package does not contain this dedicated sponsor renderer. It must ship in a later Store update before `kind: "sponsor"` is used in production.
