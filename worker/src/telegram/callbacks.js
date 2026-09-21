const PAIR_ID_PATTERN = /^[A-Za-z0-9_-]{10,20}$/;

export function parseTelegramCallback(data) {
  const value = String(data || "");

  if (value.startsWith("verify:")) {
    const pairId = value.slice("verify:".length);
    return PAIR_ID_PATTERN.test(pairId)
      ? {namespace: "activation", action: "verify", pairId}
      : null;
  }

  if (value === "support:terms") {
    return {namespace: "supporter", action: "terms"};
  }

  const menu = value.match(/^menu:(main|account|supporter|referral|activation|help)$/);
  if (menu) {
    return {namespace: "menu", action: menu[1]};
  }

  const select = value.match(/^support:select:(day|month)$/);
  if (select) {
    return {namespace: "supporter", action: "select", packageId: select[1]};
  }

  const buy = value.match(/^support:buy:(day|month)$/);
  if (buy) {
    return {namespace: "supporter", action: "buy", packageId: buy[1]};
  }

  return null;
}
