const PAIR_ID_PATTERN = /^[A-Za-z0-9_-]{10,20}$/;

export function parseTelegramCallback(data) {
  const value = String(data || "");

  if (value.startsWith("verify:")) {
    const pairId = value.slice("verify:".length);
    return PAIR_ID_PATTERN.test(pairId)
      ? {namespace: "activation", action: "verify", pairId}
      : null;
  }

  const menu = value.match(
    /^menu:(main|account|ai|extension|supporter|referral|activation|help)$/
  );
  if (menu) {
    return {namespace: "menu", action: menu[1]};
  }

  const ai = value.match(/^ai:(prompt|quota)$/);
  if (ai) {
    return {namespace: "ai", action: ai[1]};
  }

  const ext = value.match(
    /^ext:(start|activation|code|process|resume|pdf|storage|install|troubleshoot)$/
  );
  if (ext) {
    return {namespace: "extension", action: ext[1]};
  }

  const help = value.match(/^help:(bot|report)$/);
  if (help) {
    return {namespace: "help", action: help[1]};
  }

  const referral = value.match(/^ref:(rewards|rules)$/);
  if (referral) {
    return {namespace: "referral", action: referral[1]};
  }

  const group = value.match(/^group:(ask|id)$/);
  if (group) {
    return {namespace: "group", action: group[1]};
  }

  if (value === "support:terms") {
    return {namespace: "supporter", action: "terms"};
  }

  const supportSimple = value.match(
    /^support:(packages|status|wall|payment)$/
  );
  if (supportSimple) {
    return {namespace: "supporter", action: supportSimple[1]};
  }

  const wall = value.match(/^support:wall:(public|anonymous|private)$/);
  if (wall) {
    return {
      namespace: "supporter",
      action: "wall-mode",
      mode: wall[1]
    };
  }

  const select = value.match(/^support:select:(day|month)$/);
  if (select) {
    return {
      namespace: "supporter",
      action: "select",
      packageId: select[1]
    };
  }

  const buy = value.match(/^support:buy:(day|month)$/);
  if (buy) {
    return {
      namespace: "supporter",
      action: "buy",
      packageId: buy[1]
    };
  }

  return null;
}
