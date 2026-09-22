const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIME = new Set(["video/mp4", "video/webm"]);
const IMAGE_MAX = 3 * 1024 * 1024;
const VIDEO_MAX = 10 * 1024 * 1024;
const VIDEO_DURATION_MAX_MS = 15000;

function clean(value, max = 128) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function bytesToHex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

function decodeBase64(value) {
  const raw = String(value || "");
  if (!raw || raw.length > Math.ceil(VIDEO_MAX * 4 / 3) + 32) return null;
  try {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function magicMatches(bytes, mime) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return false;
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (mime === "image/webp") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  if (mime === "video/mp4") return ascii(bytes, 4, 4) === "ftyp";
  if (mime === "video/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}

function extensionFor(mime) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm"
  }[mime] || "bin";
}

function mediaKey(id, mime) {
  return `ads/${id}.${extensionFor(mime)}`;
}

function metadataKey(id) {
  return `ad-media:${id}`;
}

export function sanitizeMediaUpload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const mime = clean(raw.mime, 64).toLowerCase();
  const image = IMAGE_MIME.has(mime);
  const video = VIDEO_MIME.has(mime);
  if (!image && !video) return null;
  const bytes = decodeBase64(raw.data_base64);
  if (!bytes || !magicMatches(bytes, mime)) return null;
  const maxBytes = video ? VIDEO_MAX : IMAGE_MAX;
  if (!bytes.length || bytes.length > maxBytes) return null;

  const width = Math.max(0, Math.min(8192, Math.floor(Number(raw.width) || 0)));
  const height = Math.max(0, Math.min(8192, Math.floor(Number(raw.height) || 0)));
  const durationMs = video
    ? Math.max(0, Math.min(VIDEO_DURATION_MAX_MS, Math.floor(Number(raw.duration_ms) || 0)))
    : 0;
  if (video && (!durationMs || Number(raw.duration_ms) > VIDEO_DURATION_MAX_MS)) return null;

  return {mime, bytes, width, height, duration_ms: durationMs, kind: video ? "video" : "image"};
}

export async function storeAdMedia(env, raw, now = Date.now()) {
  if (!env?.AD_MEDIA || typeof env.AD_MEDIA.put !== "function") {
    return {ok: false, reason: "media_storage_unavailable"};
  }
  if (!env?.PAIRINGS) return {ok: false, reason: "metadata_storage_unavailable"};
  const upload = sanitizeMediaUpload(raw);
  if (!upload) return {ok: false, reason: "invalid_media"};

  const digest = await crypto.subtle.digest("SHA-256", upload.bytes);
  const id = bytesToHex(new Uint8Array(digest));
  const key = mediaKey(id, upload.mime);
  const record = {
    id,
    key,
    mime: upload.mime,
    bytes: upload.bytes.length,
    width: upload.width,
    height: upload.height,
    duration_ms: upload.duration_ms,
    kind: upload.kind,
    created_at: now
  };

  await env.AD_MEDIA.put(key, upload.bytes, {
    httpMetadata: {
      contentType: upload.mime,
      cacheControl: "public, max-age=31536000, immutable"
    },
    customMetadata: {
      id,
      kind: upload.kind
    }
  });
  await env.PAIRINGS.put(metadataKey(id), JSON.stringify(record));
  return {ok: true, asset: record};
}

export async function revokeAdMedia(env, id) {
  const safeId = clean(id, 128);
  if (!/^[0-9a-f]{64}$/.test(safeId) || !env?.PAIRINGS) return {ok: false, reason: "invalid_media_id"};
  const record = await env.PAIRINGS.get(metadataKey(safeId), "json");
  if (!record) return {ok: false, reason: "not_found"};
  if (env?.AD_MEDIA && typeof env.AD_MEDIA.delete === "function") {
    await env.AD_MEDIA.delete(record.key);
  }
  await env.PAIRINGS.delete(metadataKey(safeId));
  return {ok: true};
}

function parseSingleRange(value, total) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(value || "").trim());
  if (!match || String(value).includes(",")) return null;
  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;
  if (start == null && end == null) return null;
  if (start == null) {
    const suffix = Math.max(0, end || 0);
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else if (end == null) {
    end = total - 1;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= total || end < start) return null;
  end = Math.min(end, total - 1);
  return {offset: start, length: end - start + 1, start, end};
}

export async function serveAdMedia(request, env, id) {
  const safeId = clean(id, 128);
  if (!/^[0-9a-f]{64}$/.test(safeId) || !env?.PAIRINGS || !env?.AD_MEDIA) {
    return new Response("Not found", {status: 404});
  }
  const record = await env.PAIRINGS.get(metadataKey(safeId), "json");
  if (!record?.key || !record?.mime) return new Response("Not found", {status: 404});

  const baseHeaders = {
    "Content-Type": record.mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Access-Control-Allow-Origin": "*"
  };

  const rangeHeader = request.headers.get("Range") || "";
  if (rangeHeader && record.kind === "video") {
    const range = parseSingleRange(rangeHeader, Number(record.bytes));
    if (!range) {
      return new Response(null, {status: 416, headers: {...baseHeaders, "Content-Range": `bytes */${record.bytes}`}});
    }
    const object = await env.AD_MEDIA.get(record.key, {range: {offset: range.offset, length: range.length}});
    if (!object) return new Response("Not found", {status: 404});
    return new Response(object.body, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(range.length),
        "Content-Range": `bytes ${range.start}-${range.end}/${record.bytes}`
      }
    });
  }

  const object = await env.AD_MEDIA.get(record.key);
  if (!object) return new Response("Not found", {status: 404});
  return new Response(object.body, {
    status: 200,
    headers: {...baseHeaders, "Content-Length": String(record.bytes)}
  });
}

export const MEDIA_LIMITS = Object.freeze({
  image_bytes: IMAGE_MAX,
  video_bytes: VIDEO_MAX,
  video_duration_ms: VIDEO_DURATION_MAX_MS,
  image_mime: [...IMAGE_MIME],
  video_mime: [...VIDEO_MIME]
});
