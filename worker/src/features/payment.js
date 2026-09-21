import {tg} from "../telegram/api.js";
import {isAnonymousAdminMessage, isNormalBotMessage, isOfficialSupportGroup} from "../telegram/router.js";
import {randomToken, sha256Hex} from "../security/crypto.js";
import {auditErrorName, auditRef} from "../security/audit.js";
import {TOKEN_TTL_DAYS} from "./activation.js";
import {d1PaymentEnabled} from "../data/d1/mode.js";
import {applySupporterPaymentTransaction, getPaymentByChargeRef} from "../data/d1/payment-transaction.js";
import {d1SupporterRowToRecord} from "../data/d1/supporter-state.js";
import {createUserIfMissing, getUserById} from "../data/d1/users.js";
import {createOpaqueReferralCode} from "./referral.js";
import {getSupporterEntitlement, mirrorSupporterEntitlementToKv, putSupporterEntitlement} from "../data/supporter.js";
import {
  SUPPORTER_ACTIVATION_BONUS_DAYS,
  SUPPORTER_ACTIVATION_MAX_DAYS,
  SUPPORTER_CONTEXT_MAX_TURNS,
  SUPPORTER_MEMBER_TAG,
  formatWibDateTime,
  parseSupportInvoicePayload,
  supporterInvoiceKey,
  supporterIsActive,
  supporterPackage,
  supporterPaymentKey,
  supporterWallKey
} from "./supporter-model.js";

export async function sendSupporterInvoice(env, userId, chatId, packageId) {
  const pkg = supporterPackage(packageId);
  if (!pkg) throw new Error("supporter_package_invalid");
  const nonce = randomToken(10);
  const payload = `support:v1:${pkg.id}:${String(userId)}:${nonce}`;
  const invoice = {
    user_id: String(userId),
    package_id: pkg.id,
    stars: pkg.stars,
    payload,
    created_at: Date.now(),
    terms_accepted_at: Date.now()
  };
  await env.PAIRINGS.put(
    supporterInvoiceKey(nonce),
    JSON.stringify(invoice),
    {expirationTtl: 24 * 60 * 60}
  );

  return await tg(env, "sendInvoice", {
    chat_id: chatId,
    title: pkg.title,
    description: `${pkg.days} hari Supporter Pass: DM AI unlimited, priority support, konteks troubleshooting lebih panjang, Supporter Wall opsional, dan bonus aktivasi +14 hari (maks. 60 hari).`,
    payload,
    currency: "XTR",
    prices: [{label: pkg.title, amount: pkg.stars}]
  });
}

export async function handleSupporterPreCheckout(env, query) {
  const parsed = parseSupportInvoicePayload(query?.invoice_payload);
  let ok = false;
  let errorMessage = "Invoice Supporter Pass tidak valid atau sudah kedaluwarsa. Buka /support lalu pilih paket lagi.";

  if (parsed && String(query?.from?.id || "") === parsed.user_id) {
    const pkg = supporterPackage(parsed.package_id);
    const invoice = await env.PAIRINGS.get(supporterInvoiceKey(parsed.nonce), "json");
    if (
      pkg && invoice &&
      String(invoice.user_id) === parsed.user_id &&
      invoice.package_id === pkg.id &&
      String(query.currency || "") === "XTR" &&
      Number(query.total_amount) === pkg.stars
    ) {
      ok = true;
      errorMessage = undefined;
    }
  }

  const body = {pre_checkout_query_id: query.id, ok};
  if (!ok) body.error_message = errorMessage;
  await tg(env, "answerPreCheckoutQuery", body);
  return ok;
}

export async function tryApplySupporterTag(env, userId, active) {
  const chatId = env.SUPPORT_GROUP_ID || env.GROUP_ID;
  if (!chatId || !userId) return {ok: false, reason: "group_not_configured"};
  try {
    const member = await tg(env, "getChatMember", {chat_id: chatId, user_id: Number(userId)});
    if (!["member", "restricted"].includes(String(member?.status || ""))) {
      return {ok: false, reason: "not_regular_member"};
    }
    const currentTag = String(member?.tag || "");
    if (active) {
      if (currentTag && currentTag !== SUPPORTER_MEMBER_TAG) {
        return {ok: false, reason: "existing_member_tag"};
      }
      await tg(env, "setChatMemberTag", {
        chat_id: chatId,
        user_id: Number(userId),
        tag: SUPPORTER_MEMBER_TAG
      });
      return {ok: true, active: true};
    }
    if (currentTag === SUPPORTER_MEMBER_TAG) {
      await tg(env, "setChatMemberTag", {
        chat_id: chatId,
        user_id: Number(userId),
        tag: ""
      });
    }
    return {ok: true, active: false};
  } catch (error) {
    console.warn("supporter_tag_update_failed", {
      user_ref: await auditRef(env, "telegram-user", userId),
      active,
      error_name: auditErrorName(error)
    });
    return {ok: false, reason: "telegram_error"};
  }
}

export async function reconcileSupporterTagOnMessage(env, message) {
  if (
    !isOfficialSupportGroup(env, message) ||
    isNormalBotMessage(message) ||
    isAnonymousAdminMessage(message)
  ) return;
  if (String(message?.sender_tag || "") !== SUPPORTER_MEMBER_TAG) return;
  const userId = message?.from?.id;
  if (!userId) return;
  const record = await getSupporterEntitlement(env, userId);
  if (supporterIsActive(record)) return;
  const result = await tryApplySupporterTag(env, userId, false);
  if (result.ok && record) {
    record.tag_applied = false;
    await putSupporterEntitlement(env, userId, record);
  }
}

async function ensurePaymentD1User(env, userId) {
  const id = Number(userId);
  const existing = await getUserById(env, id);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const user = await createUserIfMissing(env, {
      telegramUserId: id,
      referralCode: createOpaqueReferralCode()
    });
    if (user) return user;
  }

  throw new Error("payment_user_create_failed");
}

async function sendAlreadyProcessed(env, message, userId) {
  const existingEntitlement = await getSupporterEntitlement(env, userId);
  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: `Pembayaran ini sudah diproses. Supporter aktif sampai ${formatWibDateTime(existingEntitlement?.supporter_until)}.`
  }).catch(() => {});
}

async function applySuccessfulSupporterPaymentD1(
  env,
  message,
  parsed,
  pkg,
  chargeId,
  chargeHash
) {
  const userId = String(message?.from?.id || "");
  const paymentKey = supporterPaymentKey(chargeHash);

  const existingD1 = await getPaymentByChargeRef(env, chargeHash);
  if (existingD1) {
    await sendAlreadyProcessed(env, message, userId);
    return true;
  }

  // A legacy KV marker always wins over re-processing. This preserves
  // idempotency during rollback/cutover even if D1 is temporarily behind.
  const existingKvPayment = await env.PAIRINGS.get(paymentKey, "json");
  if (existingKvPayment?.processed_at) {
    console.warn("supporter_payment_legacy_marker_without_d1");
    await sendAlreadyProcessed(env, message, userId);
    return true;
  }

  const invoice = await env.PAIRINGS.get(
    supporterInvoiceKey(parsed.nonce),
    "json"
  );
  if (
    !invoice ||
    String(invoice.user_id) !== userId ||
    invoice.package_id !== pkg.id
  ) {
    console.warn("supporter_payment_invoice_missing", {
      user_ref: await auditRef(env, "telegram-user", userId),
      package_id: pkg.id
    });
    return false;
  }

  await ensurePaymentD1User(env, userId);

  const currentRecord = await getSupporterEntitlement(env, userId);
  const now = Date.now();
  let state;

  try {
    const rawState = await applySupporterPaymentTransaction(env, {
      paymentEventId: "pay_" + randomToken(18),
      supporterEventId: "support_pay_" + randomToken(18),
      telegramChargeRef: chargeHash,
      userId,
      packageId: pkg.id,
      stars: pkg.stars,
      days: pkg.days,
      activationBonusDays: SUPPORTER_ACTIVATION_BONUS_DAYS,
      activationMaxDays: SUPPORTER_ACTIVATION_MAX_DAYS,
      tokenTtlDays: TOKEN_TTL_DAYS,
      seed: currentRecord || {},
      processedAt: now
    });
    state = d1SupporterRowToRecord(rawState);
  } catch (error) {
    // Concurrent delivery can lose the unique payment insert race. If the
    // charge now exists, treat this delivery as the duplicate it is.
    const raced = await getPaymentByChargeRef(env, chargeHash).catch(() => null);
    if (raced) {
      await sendAlreadyProcessed(env, message, userId);
      return true;
    }
    throw error;
  }

  const record = {
    ...(currentRecord || {user_id: userId}),
    ...(state || {}),
    user_id: userId,
    username: String(message?.from?.username || currentRecord?.username || ""),
    first_name: String(message?.from?.first_name || currentRecord?.first_name || "")
  };
  if (!record.wall_mode) record.wall_mode = "private";

  try {
    await mirrorSupporterEntitlementToKv(env, userId, record);
    await env.PAIRINGS.put(paymentKey, JSON.stringify({
      processed_at: now,
      user_id: userId,
      package_id: pkg.id,
      stars: pkg.stars,
      telegram_payment_charge_id: chargeId
    }));
  } catch (error) {
    console.warn("supporter_payment_kv_mirror_failed", {
      error_name: auditErrorName(error)
    });
  }

  if (["public", "anonymous"].includes(record.wall_mode)) {
    await env.PAIRINGS.put(supporterWallKey(userId), JSON.stringify({
      user_id: userId,
      mode: record.wall_mode,
      username: record.username || "",
      first_name: record.first_name || "",
      supporter_until: record.supporter_until
    }));
  }

  if (env.PAIRINGS.delete) {
    await env.PAIRINGS.delete(
      supporterInvoiceKey(parsed.nonce)
    ).catch(() => {});
  }

  const tag = await tryApplySupporterTag(env, userId, true);
  record.tag_applied = Boolean(tag.ok && tag.active);
  await putSupporterEntitlement(env, userId, record);

  const activationText = Number(record.activation_until || 0) > now
    ? `Target masa aktivasi extension sekarang sampai ${formatWibDateTime(record.activation_until)}. Token di perangkat tidak berubah; target ini diterapkan saat aktivasi/verifikasi berikutnya.`
    : `Bonus aktivasi +${SUPPORTER_ACTIVATION_BONUS_DAYS} hari sudah disimpan dan akan diterapkan saat token aktivasi berikutnya diterbitkan (maksimum ${SUPPORTER_ACTIVATION_MAX_DAYS} hari).`;

  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: [
      "✅ BMP Supporter Pass aktif.",
      "",
      `Paket: ${pkg.stars} ⭐ / ${pkg.days} hari`,
      `Aktif sampai: ${formatWibDateTime(record.supporter_until)}`,
      "DM bot + AI unlimited: aktif",
      "Priority support: aktif",
      `Konteks troubleshooting: sampai ${SUPPORTER_CONTEXT_MAX_TURNS} turn / 6 jam`,
      tag.ok && tag.active
        ? `Tag grup: ${SUPPORTER_MEMBER_TAG}`
        : "Tag grup: belum diterapkan (permission/status member tidak mendukung).",
      "",
      activationText,
      "",
      "Supporter Wall default-nya private. Gunakan /supporter public, /supporter anonymous, atau /supporter private untuk mengatur."
    ].join("\n"),
    disable_web_page_preview: true
  });

  return true;
}

export async function applySuccessfulSupporterPayment(env, message) {
  const payment = message?.successful_payment;
  const userId = String(message?.from?.id || "");
  const parsed = parseSupportInvoicePayload(payment?.invoice_payload);
  if (!payment || !userId || !parsed || parsed.user_id !== userId) {
    console.warn("supporter_payment_invalid_message", {
      user_ref: await auditRef(env, "telegram-user", userId)
    });
    return false;
  }

  const pkg = supporterPackage(parsed.package_id);
  if (!pkg || payment.currency !== "XTR" || Number(payment.total_amount) !== pkg.stars) {
    console.warn("supporter_payment_amount_mismatch", {
      user_ref: await auditRef(env, "telegram-user", userId),
      package_id: parsed.package_id
    });
    return false;
  }

  const chargeId = String(payment.telegram_payment_charge_id || "");
  if (!chargeId) return false;
  const chargeHash = await sha256Hex(`support-payment:${chargeId}`);

  if (d1PaymentEnabled(env)) {
    return await applySuccessfulSupporterPaymentD1(
      env,
      message,
      parsed,
      pkg,
      chargeId,
      chargeHash
    );
  }

  const paymentKey = supporterPaymentKey(chargeHash);
  const existingPayment = await env.PAIRINGS.get(paymentKey, "json");
  if (existingPayment?.processed_at) {
    const existingEntitlement = await getSupporterEntitlement(env, userId);
    await tg(env, "sendMessage", {
      chat_id: message.chat.id,
      text: `Pembayaran ini sudah diproses. Supporter aktif sampai ${formatWibDateTime(existingEntitlement?.supporter_until)}.`
    }).catch(() => {});
    return true;
  }

  const invoice = await env.PAIRINGS.get(supporterInvoiceKey(parsed.nonce), "json");
  if (!invoice || String(invoice.user_id) !== userId || invoice.package_id !== pkg.id) {
    console.warn("supporter_payment_invoice_missing", {
      user_ref: await auditRef(env, "telegram-user", userId),
      package_id: pkg.id
    });
    return false;
  }

  const now = Date.now();
  let record = await getSupporterEntitlement(env, userId);
  if (!record) record = {user_id: userId};

  const supporterBase = Math.max(now, Number(record.supporter_until || 0));
  record.supporter_until = supporterBase + pkg.days * 86400000;
  record.total_stars = Math.max(0, Number(record.total_stars || 0)) + pkg.stars;
  record.payment_count = Math.max(0, Number(record.payment_count || 0)) + 1;
  record.last_payment_at = now;
  record.last_package_id = pkg.id;
  record.username = String(message?.from?.username || record.username || "");
  record.first_name = String(message?.from?.first_name || record.first_name || "");
  if (!record.wall_mode) record.wall_mode = "private";

  const knownActivation = Number(record.activation_until || 0);
  const maxActivation = now + SUPPORTER_ACTIVATION_MAX_DAYS * 86400000;
  if (knownActivation > now) {
    record.activation_until = Math.min(
      knownActivation + SUPPORTER_ACTIVATION_BONUS_DAYS * 86400000,
      maxActivation
    );
  } else {
    record.activation_bonus_pending_days = Math.min(
      SUPPORTER_ACTIVATION_MAX_DAYS - TOKEN_TTL_DAYS,
      Math.max(0, Number(record.activation_bonus_pending_days || 0)) +
        SUPPORTER_ACTIVATION_BONUS_DAYS
    );
  }

  await putSupporterEntitlement(env, userId, record);

  if (["public", "anonymous"].includes(record.wall_mode)) {
    await env.PAIRINGS.put(supporterWallKey(userId), JSON.stringify({
      user_id: userId,
      mode: record.wall_mode,
      username: record.username || "",
      first_name: record.first_name || "",
      supporter_until: record.supporter_until
    }));
  }

  await env.PAIRINGS.put(paymentKey, JSON.stringify({
    processed_at: now,
    user_id: userId,
    package_id: pkg.id,
    stars: pkg.stars,
    telegram_payment_charge_id: chargeId
  }));

  if (env.PAIRINGS.delete) {
    await env.PAIRINGS.delete(supporterInvoiceKey(parsed.nonce)).catch(() => {});
  }

  const tag = await tryApplySupporterTag(env, userId, true);
  record.tag_applied = Boolean(tag.ok && tag.active);
  await putSupporterEntitlement(env, userId, record);

  const activationText = Number(record.activation_until || 0) > now
    ? `Target masa aktivasi extension sekarang sampai ${formatWibDateTime(record.activation_until)}. Token di perangkat tidak berubah; target ini diterapkan saat aktivasi/verifikasi berikutnya.`
    : `Bonus aktivasi +${SUPPORTER_ACTIVATION_BONUS_DAYS} hari sudah disimpan dan akan diterapkan saat token aktivasi berikutnya diterbitkan (maksimum ${SUPPORTER_ACTIVATION_MAX_DAYS} hari).`;

  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: [
      "✅ BMP Supporter Pass aktif.",
      "",
      `Paket: ${pkg.stars} ⭐ / ${pkg.days} hari`,
      `Aktif sampai: ${formatWibDateTime(record.supporter_until)}`,
      "DM bot + AI unlimited: aktif",
      "Priority support: aktif",
      `Konteks troubleshooting: sampai ${SUPPORTER_CONTEXT_MAX_TURNS} turn / 6 jam`,
      tag.ok && tag.active
        ? `Tag grup: ${SUPPORTER_MEMBER_TAG}`
        : "Tag grup: belum diterapkan (permission/status member tidak mendukung).",
      "",
      activationText,
      "",
      "Supporter Wall default-nya private. Gunakan /supporter public, /supporter anonymous, atau /supporter private untuk mengatur."
    ].join("\n"),
    disable_web_page_preview: true
  });

  return true;
}
