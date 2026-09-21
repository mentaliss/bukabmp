import {isAnonymousAdminMessage} from "../telegram/router.js";
import {supportPrivilegedUserIds} from "../security/permissions.js";
import {redactSensitiveSupportText} from "../security/redaction.js";
import {getSupporterEntitlement, putSupporterEntitlement} from "../data/supporter.js";
import {
  SUPPORTER_CONTEXT_MAX_TURNS,
  SUPPORTER_CONTEXT_TTL_SECONDS,
  formatWibDateTime,
  supporterContextKey,
  supporterIsActive,
  supporterWallKey
} from "./supporter-model.js";

export async function supportAccessForUser(env, userId) {
  const id = String(userId || "").trim();
  if (!id) return {privileged: false, source: null, supporter: null};
  if (supportPrivilegedUserIds(env).has(id)) {
    return {
      privileged: true,
      source: "allowlist",
      supporter: await getSupporterEntitlement(env, id)
    };
  }
  const supporter = await getSupporterEntitlement(env, id);
  if (supporterIsActive(supporter)) {
    return {privileged: true, source: "supporter", supporter};
  }
  return {privileged: false, source: null, supporter};
}

export async function supportPrivilegeForMessage(env, message) {
  if (isAnonymousAdminMessage(message)) {
    return {privileged: false, source: null, supporter: null};
  }
  return await supportAccessForUser(env, message?.from?.id);
}

export async function supporterContext(env, userId, chatId) {
  if (!env.PAIRINGS || !userId || !chatId) return [];
  const record = await env.PAIRINGS.get(
    supporterContextKey(userId, chatId),
    "json"
  );
  return Array.isArray(record?.turns)
    ? record.turns.slice(-SUPPORTER_CONTEXT_MAX_TURNS)
    : [];
}

export async function rememberSupporterTurn(
  env,
  userId,
  chatId,
  query,
  answer
) {
  if (!env.PAIRINGS || !userId || !chatId || !query || !answer) return;
  const turns = await supporterContext(env, userId, chatId);
  turns.push({
    q: redactSensitiveSupportText(String(query)).slice(0, 1200),
    a: redactSensitiveSupportText(String(answer)).slice(0, 2500),
    at: Date.now()
  });
  await env.PAIRINGS.put(
    supporterContextKey(userId, chatId),
    JSON.stringify({turns: turns.slice(-SUPPORTER_CONTEXT_MAX_TURNS)}),
    {expirationTtl: SUPPORTER_CONTEXT_TTL_SECONDS}
  );
}

export function formatSupporterContext(turns) {
  if (!Array.isArray(turns) || !turns.length) return "";
  return turns
    .map((turn, i) => (
      "Turn " + (i + 1) +
      "\nUser: " + turn.q +
      "\nBot: " + turn.a
    ))
    .join("\n\n")
    .slice(-6000);
}

export async function supporterStatusText(env, userId) {
  const access = await supportAccessForUser(env, userId);
  if (access.source === "allowlist" && !supporterIsActive(access.supporter)) {
    return "Akun khusus aktif: DM + Group + AI unlimited. Supporter Pass berbayar belum aktif.";
  }

  const record = access.supporter;
  if (!supporterIsActive(record)) {
    return "Supporter Pass belum aktif. Ketik /support untuk melihat paket 2 ⭐ / 1 hari atau 50 ⭐ / 30 hari.";
  }

  return [
    "⭐ BMP Supporter aktif",
    "Berlaku sampai: " + formatWibDateTime(record.supporter_until),
    "DM + AI unlimited: aktif",
    "Priority support: aktif",
    "Konteks troubleshooting: " + SUPPORTER_CONTEXT_MAX_TURNS + " turn / 6 jam",
    "Supporter Wall: " + (record.wall_mode || "private"),
    Number(record.activation_until || 0) > Date.now()
      ? "Target aktivasi extension: " + formatWibDateTime(record.activation_until)
      : Number(record.activation_bonus_pending_days || 0) > 0
        ? "Bonus aktivasi tertunda: +" + record.activation_bonus_pending_days + " hari"
        : "Bonus aktivasi tertunda: tidak ada"
  ].join("\n");
}

export async function setSupporterWallMode(env, message, mode) {
  const userId = String(message?.from?.id || "");
  const record = await getSupporterEntitlement(env, userId);
  if (!supporterIsActive(record)) {
    return "Supporter Pass belum aktif. Ketik /support untuk melihat paket.";
  }

  const normalized = ["public", "anonymous", "private"].includes(mode)
    ? mode
    : "private";
  record.wall_mode = normalized;
  record.username = String(message?.from?.username || record.username || "");
  record.first_name = String(message?.from?.first_name || record.first_name || "");
  await putSupporterEntitlement(env, userId, record);

  if (normalized === "private") {
    if (env.PAIRINGS.delete) {
      await env.PAIRINGS.delete(supporterWallKey(userId)).catch(() => {});
    }
  } else {
    await env.PAIRINGS.put(
      supporterWallKey(userId),
      JSON.stringify({
        user_id: userId,
        mode: normalized,
        username: record.username || "",
        first_name: record.first_name || "",
        supporter_until: record.supporter_until
      })
    );
  }

  return "Supporter Wall diatur ke: " + normalized + ".";
}

export async function supporterWallText(env) {
  if (!env.PAIRINGS?.list) {
    return "Supporter Wall belum tersedia pada binding KV ini.";
  }

  const listed = await env.PAIRINGS.list({
    prefix: "supporter-wall:",
    limit: 100
  });
  const values = await Promise.all(
    (listed.keys || []).map(key => env.PAIRINGS.get(key.name, "json"))
  );
  const active = values
    .filter(Boolean)
    .filter(item => Number(item.supporter_until || 0) > Date.now())
    .slice(0, 50);

  if (!active.length) {
    return "⭐ Supporter Wall\n\nBelum ada supporter yang memilih tampil di wall.";
  }

  const names = active.map((item, i) => {
    if (item.mode === "anonymous") {
      return (i + 1) + ". Anonymous Supporter";
    }
    if (item.username) {
      return (i + 1) + ". @" + item.username;
    }
    return (i + 1) + ". " + String(item.first_name || "Supporter").slice(0, 40);
  });

  return ["⭐ Supporter Wall", "", ...names].join("\n");
}
