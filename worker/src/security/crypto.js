export function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function b64urlJson(value) {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

export function randomToken(bytes = 24) {
  const out = new Uint8Array(bytes);
  crypto.getRandomValues(out);
  return b64url(out);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function importSigningKey(env) {
  if (!env.SIGNING_PRIVATE_JWK) {
    throw new Error("SIGNING_PRIVATE_JWK secret belum diset.");
  }
  const jwk = JSON.parse(env.SIGNING_PRIVATE_JWK);
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"},
    false,
    ["sign"]
  );
}
