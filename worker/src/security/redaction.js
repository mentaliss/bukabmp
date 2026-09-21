export const SUPPORT_AI_MAX_INPUT_CHARS = 1400;

export function normalizeSupportQuery(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUPPORT_AI_MAX_INPUT_CHARS);
}

export function redactSensitiveSupportText(value) {
  return normalizeSupportQuery(value)
    .replace(/\b(password|passwd|kata\s*sandi)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/\b(cookie|session|bearer|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
}
