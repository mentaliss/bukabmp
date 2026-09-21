export function supportPrivilegedUserIds(env) {
  return new Set(
    String(env.SUPPORT_PRIVILEGED_USER_IDS || "")
      .split(/[\s,;]+/)
      .map(value => value.trim())
      .filter(Boolean)
  );
}
