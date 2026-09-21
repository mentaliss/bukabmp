import {sha256Hex} from "./crypto.js";

export async function auditRef(env, kind, value) {
  if (value == null || value === "") return null;
  const salt = String(env?.MEMBER_HASH_SALT || "");
  if (!salt) return null;
  const digest = await sha256Hex(
    "audit:" + String(kind || "ref") + ":" + String(value) + ":" + salt
  );
  return digest.slice(0, 16);
}

export function auditErrorName(error) {
  const name = String(error?.name || "Error").replace(/[^A-Za-z0-9_.-]/g, "");
  return name.slice(0, 64) || "Error";
}
