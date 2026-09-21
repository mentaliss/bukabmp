import {supportPrivilegedUserIds} from "../security/permissions.js";

function envFlag(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase()
  );
}

export function v21UiCanaryEnabled(env) {
  return envFlag(env?.BOT_V21_UI_CANARY_ENABLED);
}

export function v21UiCanaryUser(env, userId) {
  if (!v21UiCanaryEnabled(env)) return false;
  return supportPrivilegedUserIds(env).has(String(userId || ""));
}

export function v21UiCanaryCount(env) {
  return v21UiCanaryEnabled(env)
    ? supportPrivilegedUserIds(env).size
    : 0;
}
