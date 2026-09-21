const KV_FAMILIES = Object.freeze([
  ["pair", "pair:"],
  ["supporter_entitlement", "supporter:user:"],
  ["supporter_invoice", "supporter-invoice:"],
  ["supporter_payment_marker", "supporter-payment:"],
  ["supporter_wall", "supporter-wall:"],
  ["supporter_context", "supporter-context:"],
  ["support_ai_quota", "support-ai-day:"],
  ["telegram_update_legacy", "telegram-update:"],
  ["bot_menu", "bot-menu:"],
  ["pair_rate_limit", "rate:"],
  ["activation_refresh_rate", "activation-refresh-rate:"],
  ["reviewer_rate_limit", "review-rate:"],
  ["extension_state", "extension-state:"]
]);

export function classifyKvKey(name) {
  const key = String(name || "");
  for (const [family, prefix] of KV_FAMILIES) {
    if (key.startsWith(prefix)) return family;
  }
  return "other";
}

export async function kvInventorySummary(env) {
  if (!env?.PAIRINGS || typeof env.PAIRINGS.list !== "function") {
    return {
      available: false,
      total_keys: null,
      families: {}
    };
  }

  const families = {};
  let total = 0;
  let cursor;

  do {
    const page = await env.PAIRINGS.list({
      limit: 1000,
      ...(cursor ? {cursor} : {})
    });

    for (const item of page?.keys || []) {
      total += 1;
      const family = classifyKvKey(item?.name);
      families[family] = (families[family] || 0) + 1;
    }

    cursor = page?.list_complete === false && page?.cursor
      ? String(page.cursor)
      : null;
  } while (cursor);

  return {
    available: true,
    total_keys: total,
    families
  };
}
