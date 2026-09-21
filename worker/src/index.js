import {tg} from "./telegram/api.js";
import {
  configuredTelegramChatMatches,
  isAnonymousAdminMessage,
  isGroupChat,
  isNormalBotMessage,
  isOfficialSupportGroup,
  isPrivateChat,
  parseBotCommand,
  supportInvocation,
  telegramBotUsername
} from "./telegram/router.js";
import {parseTelegramCallback} from "./telegram/callbacks.js";
import {SUPPORT_KB} from "./knowledge.generated.js";
import {supportPrivilegedUserIds} from "./security/permissions.js";
import {b64url, b64urlJson, importSigningKey, randomToken, sha256Hex} from "./security/crypto.js";
import {checkPairRateLimit} from "./security/rate-limit.js";
import {telegramWebhookAuthorized} from "./security/webhook-auth.js";
import {claimTelegramUpdate} from "./security/idempotency.js";
import {d1ActivationLedgerEnabled, d1MigrationEnabled, d1PaymentEnabled, d1ReadProbe, d1ReferralEnabled, d1ReferralSelfTestEnabled, d1ReplayEnabled, d1SupporterEnabled, d1WritesEnabled} from "./data/d1/mode.js";
import {kvInventorySummary} from "./security/kv-inventory.js";
import {supporterMigrationApply, supporterMigrationCompare, supporterMigrationDryRun} from "./features/supporter-migration.js";
import {runReferralSelfTest} from "./features/referral-self-test.js";
import {handlePrivacyGate} from "./security/privacy-gate.js";
import {auditErrorName} from "./security/audit.js";
import {normalizeSupportQuery, redactSensitiveSupportText} from "./security/redaction.js";
import {
  SUPPORT_GROUP_JOIN_URL,
  androidHelpText,
  bugReportText,
  desktopHelpText,
  featuresText,
  groupHelpText,
  installText,
  storageText,
  supportHelpText,
  tutorialText,
  updateHelpText
} from "./menus/help.js";
import {
  sendSupporterMenu,
  sendSupporterPackageConfirmation,
  sendSupporterPackages,
  sendSupporterPaymentPanel,
  sendSupporterStatusPanel,
  sendSupporterTermsPanel,
  sendSupporterWallPanel,
  supporterDeepLink,
  supporterTermsText
} from "./menus/supporter.js";
import {menuDeepLink, sendMainMenu} from "./menus/main.js";
import {sendAccountMenu} from "./menus/account.js";
import {sendAiMenu, sendAiPrompt, sendAiQuotaPanel} from "./menus/ai.js";
import {sendExtensionMenu, sendExtensionPage} from "./menus/extension.js";
import {sendGroupBotPanel} from "./menus/group.js";
import {sendReferralMenu, sendReferralRewards, sendReferralRules} from "./menus/referral.js";
import {sendActivationMenu} from "./menus/activation.js";
import {sendBotHelpPanel, sendHelpPanel, sendReportHelpPanel} from "./menus/help-panel.js";
import {
  SUPPORTER_ACTIVATION_BONUS_DAYS,
  SUPPORTER_ACTIVATION_MAX_DAYS,
  SUPPORTER_CONTEXT_MAX_TURNS,
  SUPPORTER_CONTEXT_TTL_SECONDS,
  SUPPORTER_MEMBER_TAG,
  formatWibDateTime,
  parseSupportInvoicePayload,
  supporterContextKey,
  supporterEntitlementKey,
  supporterInvoiceKey,
  supporterIsActive,
  supporterPackage,
  supporterPaymentKey,
  supporterWallKey
} from "./features/supporter-model.js";
import {getSupporterEntitlement, putSupporterEntitlement} from "./data/supporter.js";
import {PAIR_TTL_SECONDS, TOKEN_TTL_DAYS, verifyPairForUser} from "./features/activation.js";
import {
  formatSupporterContext,
  rememberSupporterTurn,
  setSupporterWallMode,
  supportAccessForUser,
  supporterContext,
  supporterStatusText,
  supporterWallText,
  supportPrivilegeForMessage
} from "./features/supporter.js";
import {
  SUPPORT_AI_MAX_CALLS_PER_DAY,
  SUPPORT_AI_MODEL,
  runSupportAi,
  supportActorId,
  supportAiAllowed,
  supportAiQuotaStatus
} from "./features/ai-support.js";
import {
  applySuccessfulSupporterPayment,
  handleSupporterPreCheckout,
  reconcileSupporterTagOnMessage,
  sendSupporterInvoice
} from "./features/payment.js";
import {parseReferralStartArg} from "./features/referral.js";
import {attributeReferralFromCode} from "./features/referral-service.js";

const APP_VERSION = "1.0.5-support-bot-v12-sponsor-surface";
const TOKEN_ISSUER = "bmp-terbuka-community";
const TOKEN_AUDIENCE = "bmp-terbuka-extension";
const VERSION_CHECK_AFTER_SECONDS = 24 * 60 * 60;
const REVIEWER_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const CLOUD_STATE_DEFAULT_TTL_SECONDS = 5 * 60;
const DISTRIBUTION_CHANNELS = Object.freeze(["github", "android", "cws", "edge"]);

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra
    }
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

async function handlePaymentSupportCommand(env, message, details = "") {
  if (!isPrivateChat(message)) {
    await sendSupportReply(env, message, "Untuk masalah pembayaran Supporter Pass, kirim /paysupport lewat DM bot supaya detail transaksi tidak dibahas di grup.");
    return;
  }
  const clean = redactSensitiveSupportText(String(details || "").trim()).slice(0, 1800);
  if (!clean) {
    await tg(env, "sendMessage", {
      chat_id: message.chat.id,
      text: [
        "💳 Payment Support",
        "",
        "Kirim /paysupport diikuti penjelasan masalah pembayaran. Contoh:",
        "/paysupport pembayaran berhasil tapi Supporter belum aktif",
        "",
        "Jangan kirim password, OTP, token, cookie, atau data kartu. Telegram Support/Bot Support tidak menangani transaksi Supporter Pass ini; pengelola BMP Terbuka yang memprosesnya."
      ].join("\n")
    });
    return;
  }

  const ownerIds = [...supportPrivilegedUserIds(env)].slice(0, 3);
  let delivered = 0;
  for (const ownerId of ownerIds) {
    try {
      await tg(env, "sendMessage", {
        chat_id: Number(ownerId),
        text: [
          "💳 Supporter Payment Support",
          `User ID: ${message.from?.id}`,
          message.from?.username ? `Username: @${message.from.username}` : "",
          "",
          clean
        ].filter(Boolean).join("\n")
      });
      delivered++;
    } catch {}
  }
  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: delivered
      ? "✅ Laporan payment support sudah diteruskan ke pengelola BMP Terbuka."
      : "⚠️ Kontak payment support belum terkonfigurasi. Gunakan Group Terbuka untuk menghubungi pengelola tanpa membagikan detail transaksi sensitif."
  });
}



const SUPPORT_STOPWORDS = new Set([
  "yang", "dan", "atau", "di", "ke", "dari", "untuk", "ini", "itu", "nya", "aku", "saya",
  "gw", "gue", "ga", "gak", "nggak", "tidak", "bisa", "apa", "gimana", "bagaimana", "kok",
  "kenapa", "kalau", "kalo", "mau", "jadi", "udah", "sudah", "dong", "bro", "min"
]);

function supportSearchText(value) {
  return normalizeSupportQuery(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function supportTokens(value) {
  return supportSearchText(value)
    .split(" ")
    .filter(x => x.length >= 2 && !SUPPORT_STOPWORDS.has(x));
}

function scoreSupportKbEntry(query, entry) {
  const q = supportSearchText(query);
  if (!q) return {score: 0, strong: false};
  let score = 0;
  let strong = false;

  const qTokenList = supportTokens(q);
  const qTokenSet = new Set(qTokenList);

  for (const raw of entry.aliases || []) {
    const alias = supportSearchText(raw);
    if (!alias || alias.length < 2) continue;
    if (q === alias) {
      score += 30;
      strong = true;
    } else if (q.includes(alias)) {
      score += 18;
      strong = true;
    } else {
      // Treat harmless filler-word variants as the same FAQ, e.g.
      // "bisa di firefox?" vs "bisa firefox". This keeps known FAQs free.
      const aliasTokens = supportTokens(alias);
      const tokenExact = aliasTokens.length > 0 &&
        aliasTokens.length === qTokenList.length &&
        aliasTokens.every(token => qTokenSet.has(token));
      const meaningfulSubset = aliasTokens.length >= 2 &&
        aliasTokens.every(token => qTokenSet.has(token));
      if (tokenExact) {
        score += 24;
        strong = true;
      } else if (meaningfulSubset) {
        score += 14;
        strong = true;
      }
    }
  }

  for (const raw of entry.keywords || []) {
    const kw = supportSearchText(raw);
    if (!kw) continue;
    if (q.includes(kw)) score += kw.includes(" ") ? 8 : 4;
  }

  const qTokens = qTokenSet;
  const eTokens = new Set(supportTokens([entry.title, ...(entry.aliases || []), ...(entry.keywords || [])].join(" ")));
  let overlap = 0;
  for (const token of qTokens) if (eTokens.has(token)) overlap++;
  score += overlap * 2;

  return {score, strong};
}

function retrieveSupportKnowledge(query, limit = 6) {
  return SUPPORT_KB
    .map(entry => ({entry, ...scoreSupportKbEntry(query, entry)}))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function directSupportKbAnswer(query) {
  const matches = retrieveSupportKnowledge(query, 3);
  if (!matches.length) return null;
  const top = matches[0];
  const second = matches[1]?.score || 0;
  const secondMatch = matches[1] || null;
  const multiStrong = Boolean(secondMatch?.strong && second >= top.score - 8);
  if (!multiStrong && (top.strong || top.score >= 16 || (top.score >= 10 && top.score >= second + 5))) {
    return top.entry.answer;
  }
  return null;
}

function formatKnowledgeEntries(entries) {
  return entries.map((entry, i) => `${i + 1}. ${entry.title}: ${entry.answer}`).join("\n");
}

function buildSupportKnowledgeContext(query) {
  const matches = retrieveSupportKnowledge(query, 10);
  const topScore = matches[0]?.score || 0;

  // Strong/medium lexical hit: keep context compact. Weak hit: give the model
  // the complete curated KB so natural-language phrasing is not rejected just
  // because the local retriever missed a synonym or word order.
  if (matches.length && topScore >= 6) {
    return {
      mode: "retrieved",
      text: formatKnowledgeEntries(matches.map(x => x.entry))
    };
  }
  return {
    mode: "full",
    text: formatKnowledgeEntries(SUPPORT_KB)
  };
}

function isBmpSupportQuestion(query) {
  const q = supportSearchText(query);
  if (!q) return false;

  const topical = /\b(bmp|modul|pdf|ocr|extension|ekstensi|rbv|pustaka|reader|android|desktop|edge|chrome|firefox|download|unduh|export|ekspor|cache|penyimpanan|storage|aktivasi|telegram|update|versi|kode|merge|gabung|403|429|request rejected|watermark|crx|manifest|canary)\b/i;
  if (topical.test(q)) return true;

  const matches = retrieveSupportKnowledge(q, 1);
  return Boolean(matches.length && matches[0].score >= 5);
}


async function answerWithSupportAi(
  env,
  query,
  priorContext = "",
  supporterPriority = false
) {
  const safeQuery = redactSensitiveSupportText(query);
  const knowledge = buildSupportKnowledgeContext(safeQuery);
  return await runSupportAi(env, {
    safeQuery,
    knowledge,
    priorContext,
    supporterPriority
  });
}

async function sendSupportReply(env, message, text) {
  if (!text) return;
  let output = text;
  if (isGroupChat(message) && message?.__supportAccess?.source === "supporter") {
    output = `⭐ Supporter • Priority\n${text}`;
  }
  await tg(env, "sendMessage", {
    chat_id: message.chat.id,
    text: output,
    reply_parameters: {message_id: message.message_id},
    disable_web_page_preview: true
  });
}


async function handleSupportMessage(env, message) {
  const privateChat = isPrivateChat(message);
  const access = await supportPrivilegeForMessage(env, message);
  const privileged = Boolean(access.privileged);
  message.__supportAccess = access;
  if (!privateChat && !isOfficialSupportGroup(env, message)) return false;
  if (isNormalBotMessage(message)) return false;

  let invocation = supportInvocation(message, env);
  const command = invocation.command?.command || "";
  const dmUtilityCommand = privateChat && new Set([
    "support", "supporter", "supporters", "terms", "paysupport",
    "help", "bmphelp", "faq", "tutorial", "install", "android",
    "desktop", "group", "update", "fitur", "storage", "bug", "quota"
  ]).has(command);

  // Regular users use AI in Group Terbuka, but deterministic help/account
  // utilities remain available in DM.
  if (privateChat && !privileged && !dmUtilityCommand) {
    const text = String(message?.text || "").trim();
    if (!text) return false;
    await sendSupportReply(env, message, [
      "Support BMP Terbuka tersedia di Group Terbuka.",
      SUPPORT_GROUP_JOIN_URL,
      "",
      "DM bot tetap bisa dipakai untuk menu akun, panduan extension, aktivasi/verifikasi, dan Supporter. AI reguler digunakan di Group Terbuka."
    ].join("\n"));
    return true;
  }

  // Privileged/supporter users may use plain-text support in DM.
  if (privateChat && privileged && !invocation.invoked) {
    const text = String(message?.text || "").trim();
    if (text) invocation = {invoked: true, command: null, query: text};
  }
  if (!invocation.invoked) return false;

  const currentCommand = invocation.command?.command || "";
  if (currentCommand === "support") {
    await sendSupporterMenu(env, message, access);
    return true;
  }
  if (currentCommand === "terms") {
    await sendSupportReply(env, message, supporterTermsText());
    return true;
  }
  if (currentCommand === "paysupport") {
    await handlePaymentSupportCommand(env, message, invocation.command?.args || "");
    return true;
  }
  if (currentCommand === "supporter") {
    const arg = String(invocation.command?.args || "").trim().toLowerCase();
    if (["public", "anonymous", "private"].includes(arg)) {
      await sendSupportReply(
        env,
        message,
        await setSupporterWallMode(env, message, arg)
      );
    } else {
      await sendSupportReply(env, message, await supporterStatusText(env, message?.from?.id));
    }
    return true;
  }
  if (currentCommand === "supporters") {
    await sendSupportReply(env, message, await supporterWallText(env));
    return true;
  }
  if (currentCommand === "help" || currentCommand === "bmphelp" || currentCommand === "faq") {
    await sendSupportReply(env, message, supportHelpText(access));
    return true;
  }
  if (currentCommand === "tutorial") {
    await sendSupportReply(env, message, tutorialText());
    return true;
  }
  if (currentCommand === "install") {
    await sendSupportReply(env, message, installText());
    return true;
  }
  if (currentCommand === "android") {
    await sendSupportReply(env, message, androidHelpText());
    return true;
  }
  if (currentCommand === "desktop") {
    await sendSupportReply(env, message, desktopHelpText());
    return true;
  }
  if (currentCommand === "group") {
    await sendSupportReply(env, message, groupHelpText());
    return true;
  }
  if (currentCommand === "update") {
    await sendSupportReply(env, message, updateHelpText());
    return true;
  }
  if (currentCommand === "fitur") {
    await sendSupportReply(env, message, featuresText());
    return true;
  }
  if (currentCommand === "storage") {
    await sendSupportReply(env, message, storageText());
    return true;
  }
  if (currentCommand === "bug") {
    await sendSupportReply(env, message, bugReportText());
    return true;
  }
  if (currentCommand === "quota") {
    if (privileged) {
      const label = access.source === "supporter"
        ? `unlimited (Supporter Pass aktif sampai ${formatWibDateTime(access.supporter?.supporter_until)}).`
        : "unlimited (akun khusus).";
      await sendSupportReply(env, message, `Kuota AI support: ${label}`);
    } else {
      const status = await supportAiQuotaStatus(env, supportActorId(message));
      await sendSupportReply(env, message, `Sisa kuota AI hari ini: ${status.remaining} dari ${SUPPORT_AI_MAX_CALLS_PER_DAY}`);
    }
    return true;
  }

  const query = normalizeSupportQuery(invocation.query);
  if (!query) {
    await sendSupportReply(env, message, "Tulis pertanyaannya setelah /ask ya. Contoh: /ask kenapa modul tidak tersedia?");
    return true;
  }

  if (!isBmpSupportQuestion(query)) {
    await sendSupportReply(env, message, "Bot ini khusus bantuan BMP Terbuka. Ketik /bmphelp untuk menu bantuan.");
    return true;
  }

  const directAnswer = directSupportKbAnswer(query);
  if (directAnswer) {
    await sendSupportReply(env, message, directAnswer);
    if (access.source === "supporter" && !isAnonymousAdminMessage(message)) {
      await rememberSupporterTurn(env, message.from.id, message.chat.id, query, directAnswer);
    }
    return true;
  }

  const quota = privileged
    ? {allowed: true, unlimited: true, count: 0, remaining: null}
    : await supportAiAllowed(env, supportActorId(message));

  if (!quota.allowed) {
    await sendSupportReply(env, message, "Kuota AI support hari ini sudah habis (sisa 0 dari 6). Coba lagi besok. FAQ yang bisa dijawab langsung dari basis pengetahuan serta command seperti /tutorial, /install, /android, /desktop, /storage, /fitur, dan /bug tetap bisa dipakai tanpa kuota AI. Supporter Pass dapat diaktifkan lewat /support.");
    return true;
  }

  try {
    const turns = access.source === "supporter" && !isAnonymousAdminMessage(message)
      ? await supporterContext(env, message.from.id, message.chat.id)
      : [];
    const aiAnswer = await answerWithSupportAi(env, query, formatSupporterContext(turns), access.source === "supporter");
    if (aiAnswer) {
      const footer = access.source === "supporter"
        ? `AI support unlimited • Supporter aktif sampai ${formatWibDateTime(access.supporter?.supporter_until)}`
        : access.source === "allowlist"
          ? "AI support: unlimited (akun khusus)."
          : `Sisa kuota AI hari ini: ${quota.remaining} dari ${SUPPORT_AI_MAX_CALLS_PER_DAY}`;
      await sendSupportReply(env, message, `${aiAnswer}\n\n${footer}`);
      if (access.source === "supporter" && !isAnonymousAdminMessage(message)) {
        await rememberSupporterTurn(env, message.from.id, message.chat.id, query, aiAnswer);
      }
    } else {
      await sendSupportReply(env, message, "Jawaban AI belum berhasil dibuat. Coba gunakan command /bmphelp atau kirim pertanyaan BMP Terbuka dengan konteks yang lebih spesifik.");
    }
  } catch (e) {
    console.error("support_ai_failed", {error_name: auditErrorName(e)});
    await sendSupportReply(env, message, "AI support sedang tidak tersedia. Command bantuan seperti /tutorial, /storage, dan /bug tetap bisa dipakai.");
  }
  return true;
}


async function handleTelegram(env, update) {
  if (update.pre_checkout_query) {
    await handleSupporterPreCheckout(env, update.pre_checkout_query);
    return;
  }

  if (update.message) {
    const message = update.message;
    const userId = message.from?.id;
    const chatId = message.chat?.id;
    const text = String(message.text || "").trim();
    const command = parseBotCommand(text, env);
    const commandName = command?.command || "";

    if (message.successful_payment) {
      await applySuccessfulSupporterPayment(env, message);
      return;
    }

    if (await handlePrivacyGate(env, message)) return;
    await reconcileSupporterTagOnMessage(env, message).catch(() => {});

    if (
      !isPrivateChat(message) &&
      ["start", "menu", "help", "bmphelp"].includes(commandName)
    ) {
      await sendGroupBotPanel(env, message);
      return;
    }

    if (commandName === "id") {
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "👤 Telegram User ID kamu: " + String(userId || "tidak tersedia"),
        reply_parameters: {message_id: message.message_id}
      });
      return;
    }

    if (
      isPrivateChat(message) &&
      commandName === "start" &&
      String(command.args || "").toLowerCase() === "support"
    ) {
      const access = await supportPrivilegeForMessage(env, message);
      message.__supportAccess = access;
      await sendSupporterMenu(env, message, access);
      return;
    }

    if (
      isPrivateChat(message) &&
      commandName === "start" &&
      String(command.args || "").toLowerCase() === "help_extension"
    ) {
      await sendExtensionMenu(env, chatId, userId);
      return;
    }

    if (
      isPrivateChat(message) &&
      commandName === "start" &&
      String(command.args || "").toLowerCase() === "ai"
    ) {
      await sendAiMenu(env, chatId, message.from);
      return;
    }

    if (
      isPrivateChat(message) &&
      (
        commandName === "menu" ||
        (
          commandName === "start" &&
          ["", "menu"].includes(
            String(command.args || "").trim().toLowerCase()
          )
        )
      )
    ) {
      await sendMainMenu(env, chatId, userId);
      return;
    }

    if (isPrivateChat(message) && commandName === "help") {
      const access = await supportPrivilegeForMessage(env, message);
      await sendHelpPanel(env, chatId, access, userId);
      return;
    }

    if (
      isPrivateChat(message) &&
      commandName === "start" &&
      String(command.args || "").startsWith("ref_")
    ) {
      const code = parseReferralStartArg(command.args);
      if (!code) {
        await tg(env, "sendMessage", {
          chat_id: chatId,
          text: "Link referral tidak valid."
        });
        await sendMainMenu(env, chatId, userId);
        return;
      }

      const result = await attributeReferralFromCode(env, userId, code);
      let referralText = "Referral belum diaktifkan di environment ini.";
      if (result.available) {
        if (result.created) {
          referralText =
            "✅ Referral tersimpan. Referral baru menjadi valid setelah syarat komunitas dan aktivasi terpenuhi.";
        } else if (result.reason === "already_activated") {
          referralText =
            "Referral tidak dapat diterapkan karena akun ini sudah tercatat pernah melakukan aktivasi BMP.";
        } else if (result.reason === "already_attributed") {
          referralText =
            "Akun ini sudah terikat ke referral pertama yang tercatat.";
        } else if (result.reason === "self_referral") {
          referralText = "Referral diri sendiri tidak berlaku.";
        } else {
          referralText = "Link referral tidak valid.";
        }
      }

      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: referralText
      });
      await sendReferralMenu(env, chatId, userId);
      return;
    }

    if (isPrivateChat(message) && commandName === "start") {
      const pairId = command.args || "";
      await verifyPairForUser(env, pairId, userId, chatId);
      return;
    }

    if (isPrivateChat(message) && commandName === "verify") {
      const pairId = command.args || "";
      if (!pairId) {
        await tg(env, "sendMessage", {
          chat_id: chatId,
          text: [
            "🔐 Verifikasi manual",
            "",
            "Gunakan ini hanya kalau popup extension memberi kode aktivasi tetapi Telegram tidak membawanya otomatis.",
            "",
            "1. Buka popup BMP Terbuka.",
            "2. Mulai aktivasi.",
            "3. Salin kode yang tampil.",
            "4. Kirim: /verify KODE",
            "",
            "Kalau kode sudah kedaluwarsa, mulai ulang aktivasi dari popup."
          ].join("\n")
        });
        return;
      }
      await verifyPairForUser(env, pairId, userId, chatId);
      return;
    }

    if (isPrivateChat(message) && /^[A-Za-z0-9_-]{10,20}$/.test(text)) {
      await verifyPairForUser(env, text, userId, chatId);
      return;
    }

    if (await handleSupportMessage(env, message)) return;
  }

  if (update.edited_message) {
    await handlePrivacyGate(env, update.edited_message);
    return;
  }

  if (update.callback_query) {
    const q = update.callback_query;
    const callback = parseTelegramCallback(q.data);

    if (!callback) {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id,
        text: "Aksi tidak dikenali."
      }).catch(() => {});
      return;
    }

    if (callback.namespace === "group") {
      if (callback.action === "id") {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Telegram User ID kamu: " + String(q.from?.id || "tidak tersedia"),
          show_alert: true
        }).catch(() => {});
        return;
      }
      if (callback.action === "ask") {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Ketik /ask lalu pertanyaan kamu di Group Terbuka. Bisa juga mention @bukabmp_bot atau reply pesan bot.",
          show_alert: true
        }).catch(() => {});
        return;
      }
    }

    const isPrivateCallback = q.message && isPrivateChat(q.message);
    if (
      ["menu", "ai", "extension", "help", "referral", "supporter", "activation"]
        .includes(callback.namespace) &&
      !isPrivateCallback
    ) {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id,
        text: "Buka menu pribadi lewat DM bot."
      }).catch(() => {});
      return;
    }

    const chatId = q.message?.chat?.id;
    const userId = q.from?.id;
    const menuMessageId = q.message?.message_id;

    if (callback.namespace === "menu") {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id
      }).catch(() => {});

      if (callback.action === "main") {
        await sendMainMenu(env, chatId, userId, menuMessageId);
        return;
      }
      if (callback.action === "account") {
        await sendAccountMenu(env, chatId, q.from, menuMessageId);
        return;
      }
      if (callback.action === "ai") {
        await sendAiMenu(env, chatId, q.from, menuMessageId);
        return;
      }
      if (callback.action === "extension") {
        await sendExtensionMenu(env, chatId, userId, menuMessageId);
        return;
      }
      if (callback.action === "supporter") {
        const callbackMessage = {...q.message, from: q.from};
        const access = await supportPrivilegeForMessage(env, callbackMessage);
        await sendSupporterMenu(
          env,
          callbackMessage,
          access,
          menuMessageId
        );
        return;
      }
      if (callback.action === "referral") {
        await sendReferralMenu(env, chatId, userId, menuMessageId);
        return;
      }
      if (callback.action === "activation") {
        await sendActivationMenu(
          env,
          chatId,
          userId,
          menuMessageId
        );
        return;
      }
      if (callback.action === "help") {
        const callbackMessage = {...q.message, from: q.from};
        const access = await supportPrivilegeForMessage(
          env,
          callbackMessage
        );
        await sendHelpPanel(
          env,
          chatId,
          access,
          userId,
          menuMessageId
        );
        return;
      }
    }

    if (callback.namespace === "ai") {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id
      }).catch(() => {});
      if (callback.action === "prompt") {
        await sendAiPrompt(env, chatId, q.from, menuMessageId);
      } else if (callback.action === "quota") {
        await sendAiQuotaPanel(env, chatId, q.from, menuMessageId);
      }
      return;
    }

    if (callback.namespace === "extension") {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id
      }).catch(() => {});
      await sendExtensionPage(
        env,
        chatId,
        userId,
        menuMessageId,
        callback.action
      );
      return;
    }

    if (callback.namespace === "help") {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id
      }).catch(() => {});
      const callbackMessage = {...q.message, from: q.from};
      const access = await supportPrivilegeForMessage(env, callbackMessage);
      if (callback.action === "bot") {
        await sendBotHelpPanel(
          env,
          chatId,
          userId,
          menuMessageId,
          access
        );
      } else if (callback.action === "report") {
        await sendReportHelpPanel(
          env,
          chatId,
          userId,
          menuMessageId
        );
      }
      return;
    }

    if (callback.namespace === "referral") {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id
      }).catch(() => {});
      if (callback.action === "rewards") {
        await sendReferralRewards(env, chatId, userId, menuMessageId);
      } else if (callback.action === "rules") {
        await sendReferralRules(env, chatId, userId, menuMessageId);
      }
      return;
    }

    if (
      callback.namespace === "activation" &&
      callback.action === "verify"
    ) {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id,
        text: "Memeriksa keanggotaan..."
      }).catch(() => {});
      await verifyPairForUser(
        env,
        callback.pairId,
        q.from.id,
        q.message.chat.id
      );
      return;
    }

    if (callback.namespace === "supporter") {
      const callbackMessage = {...q.message, from: q.from};

      if (callback.action === "packages") {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id
        }).catch(() => {});
        await sendSupporterPackages(
          env,
          chatId,
          userId,
          menuMessageId
        );
        return;
      }

      if (callback.action === "status") {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id
        }).catch(() => {});
        await sendSupporterStatusPanel(
          env,
          chatId,
          userId,
          menuMessageId
        );
        return;
      }

      if (callback.action === "wall") {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id
        }).catch(() => {});
        await sendSupporterWallPanel(
          env,
          chatId,
          userId,
          menuMessageId
        );
        return;
      }

      if (callback.action === "payment") {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id
        }).catch(() => {});
        await sendSupporterPaymentPanel(
          env,
          chatId,
          userId,
          menuMessageId
        );
        return;
      }

      if (callback.action === "terms") {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id
        }).catch(() => {});
        await sendSupporterTermsPanel(
          env,
          chatId,
          userId,
          menuMessageId
        );
        return;
      }

      if (callback.action === "wall-mode") {
        const result = await setSupporterWallMode(
          env,
          callbackMessage,
          callback.mode
        );
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: result
        }).catch(() => {});
        await sendSupporterWallPanel(
          env,
          chatId,
          userId,
          menuMessageId
        );
        return;
      }

      if (callback.action === "select") {
        const pkg = supporterPackage(callback.packageId);
        if (!pkg) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Paket tidak valid."
          }).catch(() => {});
          return;
        }
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id
        }).catch(() => {});
        await sendSupporterPackageConfirmation(
          env,
          userId,
          chatId,
          callback.packageId,
          menuMessageId
        );
        return;
      }

      if (callback.action === "buy") {
        const pkg = supporterPackage(callback.packageId);
        if (!pkg) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Paket tidak valid."
          }).catch(() => {});
          return;
        }
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Membuat invoice " + pkg.stars + " Stars..."
        }).catch(() => {});
        await sendSupporterInvoice(
          env,
          q.from.id,
          q.message.chat.id,
          callback.packageId
        );
        return;
      }
    }
  }
}

function normalizeDistributionChannel(value) {
  const channel = String(value || "github").trim().toLowerCase();
  return DISTRIBUTION_CHANNELS.includes(channel) ? channel : "github";
}

function envString(env, name, fallback = "") {
  const value = env?.[name];
  if (value == null) return fallback;
  return String(value).trim();
}

function envBoolean(env, name, fallback = false) {
  const raw = envString(env, name, "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

function channelEnvName(channel, suffix) {
  return `EXTENSION_${String(channel).toUpperCase()}_${suffix}`;
}

function storeChannel(channel) {
  return channel === "cws" || channel === "edge";
}

function channelPolicy(env, channelValue) {
  const channel = normalizeDistributionChannel(channelValue);
  const latestVersion = envString(
    env,
    channelEnvName(channel, "LATEST_VERSION"),
    envString(env, "EXTENSION_LATEST_VERSION", "1.0.5")
  );
  const configuredMinimum = envString(
    env,
    channelEnvName(channel, "MINIMUM_VERSION"),
    envString(env, "EXTENSION_MINIMUM_VERSION", "1.0.2")
  );
  const forceAfter = envString(
    env,
    channelEnvName(channel, "FORCE_AFTER"),
    envString(env, "EXTENSION_FORCE_AFTER", "")
  ) || null;
  const releaseUrlValue = envString(
    env,
    channelEnvName(channel, "RELEASE_URL"),
    releaseUrl(env)
  );
  const message = envString(
    env,
    channelEnvName(channel, "UPDATE_MESSAGE"),
    envString(env, "EXTENSION_UPDATE_MESSAGE", "")
  );
  const storeReady = storeChannel(channel)
    ? envBoolean(env, channelEnvName(channel, "STORE_READY"), false)
    : true;

  // Never lock Store users to a version that is not actually available in that Store.
  const minimumVersion = storeChannel(channel) && !storeReady ? "" : configuredMinimum;

  return {
    channel,
    latestVersion,
    minimumVersion,
    forceAfter,
    releaseUrl: releaseUrlValue,
    message,
    storeReady
  };
}

function safeCloudText(value, max = 700) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function safeHttpsUrl(value) {
  const raw = safeCloudText(value, 2048);
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function sanitizeCloudAction(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = safeCloudText(raw.type, 32).toUpperCase();
  const allowed = new Set(["OPEN_URL", "OPEN_CHANNEL", "OPEN_GROUP", "OPEN_ABOUT"]);
  if (!allowed.has(type)) return null;
  const label = safeCloudText(raw.label, 48);
  if (!label) return null;
  if (type === "OPEN_URL") {
    const url = safeHttpsUrl(raw.url);
    return url ? {type, label, url} : null;
  }
  return {type, label};
}

function sanitizeExtensionState(raw) {
  const out = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    ttl_seconds: CLOUD_STATE_DEFAULT_TTL_SECONDS,
    sections: [],
    supporter: {active: false, until: null, label: ""},
    features: {supporter_card: false, community_banner: false}
  };
  if (!raw || typeof raw !== "object" || Number(raw.schema_version) !== 1) return out;

  const ttl = Number(raw.ttl_seconds);
  if (Number.isFinite(ttl)) out.ttl_seconds = Math.max(60, Math.min(86400, Math.floor(ttl)));

  if (Array.isArray(raw.sections)) {
    for (let i = 0; i < raw.sections.length && out.sections.length < 8; i++) {
      const item = raw.sections[i];
      if (!item || typeof item !== "object" || item.visible !== true) continue;
      const rawId = safeCloudText(item.id, 48);
      const id = /^[a-z0-9][a-z0-9_-]{0,47}$/i.test(rawId) ? rawId : `section-${i + 1}`;
      const kindRaw = safeCloudText(item.kind, 24).toLowerCase();
      const kind = ["info", "warning", "success", "community", "supporter", "sponsor"].includes(kindRaw) ? kindRaw : "info";
      const title = safeCloudText(item.title, 96);
      const text = safeCloudText(item.text, 700);
      if (!title && !text) continue;
      let action = sanitizeCloudAction(item.action);
      if (kind === "sponsor" && action?.type !== "OPEN_URL") action = null;
      out.sections.push({id, visible: true, kind, title, text, action});
    }
  }

  const supporter = raw.supporter && typeof raw.supporter === "object" ? raw.supporter : {};
  out.supporter = {
    active: supporter.active === true,
    until: safeCloudText(supporter.until, 64) || null,
    label: safeCloudText(supporter.label, 64)
  };
  const features = raw.features && typeof raw.features === "object" ? raw.features : {};
  out.features = {
    supporter_card: features.supporter_card === true,
    community_banner: features.community_banner === true
  };
  return out;
}

function extensionStateKey(channel) {
  return `extension-state:${normalizeDistributionChannel(channel)}`;
}

async function extensionState(request, env, url) {
  const channel = normalizeDistributionChannel(url.searchParams.get("distribution_channel"));
  let state = null;
  if (env.PAIRINGS) state = await env.PAIRINGS.get(extensionStateKey(channel), "json");
  if (!state) {
    const raw = envString(env, channelEnvName(channel, "STATE_JSON"), envString(env, "EXTENSION_STATE_JSON", ""));
    if (raw) {
      try { state = JSON.parse(raw); } catch { state = null; }
    }
  }
  return json(sanitizeExtensionState(state), 200, corsHeaders(request));
}

async function adminExtensionState(request, env, url) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }
  if (!env.PAIRINGS) return json({error: "PAIRINGS KV belum dikonfigurasi"}, 503, corsHeaders(request));
  const channel = normalizeDistributionChannel(url.searchParams.get("distribution_channel"));
  const key = extensionStateKey(channel);

  if (request.method === "GET") {
    const existing = await env.PAIRINGS.get(key, "json");
    return json({channel, state: sanitizeExtensionState(existing)}, 200, corsHeaders(request));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({error: "JSON body tidak valid"}, 400, corsHeaders(request));
  const state = sanitizeExtensionState(body);
  await env.PAIRINGS.put(key, JSON.stringify(state));
  return json({ok: true, channel, state}, 200, corsHeaders(request));
}

function secureHtml(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function reviewerPage() {
  return secureHtml(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BMP Terbuka Store Review</title><style>body{font:16px system-ui;max-width:560px;margin:40px auto;padding:0 18px;line-height:1.5}label{display:block;margin:14px 0 5px}input{width:100%;box-sizing:border-box;padding:10px}button{margin-top:16px;padding:10px 14px}</style><h1>BMP Terbuka Store Review</h1><p>Use only the temporary reviewer code supplied privately in Microsoft/Chrome certification notes.</p><form method="post" action="/v1/reviewer/activate"><label>Pair ID</label><input name="pair_id" autocomplete="off" required><label>Reviewer code</label><input name="reviewer_code" type="password" autocomplete="off" required><button type="submit">Activate review installation</button></form></html>`);
}

async function reviewerRateLimit(request, env) {
  if (!env.PAIRINGS || !env.MEMBER_HASH_SALT) return true;
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!ip) return true;
  const fingerprint = await sha256Hex(`review-rate:${ip}:${env.MEMBER_HASH_SALT}`);
  const key = `review-rate:${fingerprint}`;
  const count = Number(await env.PAIRINGS.get(key) || 0);
  if (count >= 10) return false;
  await env.PAIRINGS.put(key, String(count + 1), {expirationTtl: 10 * 60});
  return true;
}

async function issueReviewerToken(env, installId) {
  const now = Math.floor(Date.now() / 1000);
  const header = {alg: "RS256", typ: "JWT"};
  const payload = {
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    install_id: installId,
    iat: now,
    exp: now + REVIEWER_TOKEN_TTL_SECONDS,
    scope: ["community_access", "store_review"],
    member_ref: await sha256Hex(`store-reviewer:${env.MEMBER_HASH_SALT || ""}`)
  };
  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const signingInput = `${h}.${p}`;
  const key = await importSigningKey(env);
  const sig = await crypto.subtle.sign({name: "RSASSA-PKCS1-v1_5"}, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

async function reviewerActivate(request, env) {
  if (!(await reviewerRateLimit(request, env))) {
    return new Response("Too many attempts.", {status: 429, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  }
  if (!env.STORE_REVIEWER_SECRET) {
    return new Response("Reviewer activation is not configured.", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  }
  const contentType = request.headers.get("Content-Type") || "";
  let pairId = "";
  let reviewerCode = "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    pairId = String(body.pair_id || "").trim();
    reviewerCode = String(body.reviewer_code || "");
  } else {
    const form = await request.formData().catch(() => null);
    pairId = String(form?.get("pair_id") || "").trim();
    reviewerCode = String(form?.get("reviewer_code") || "");
  }
  if (!pairId || reviewerCode !== String(env.STORE_REVIEWER_SECRET)) {
    return new Response("Invalid pair ID or reviewer code.", {status: 403, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  }
  const key = `pair:${pairId}`;
  const record = await env.PAIRINGS.get(key, "json");
  if (!record) return new Response("Pair session expired. Start activation again in the extension.", {status: 410, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  if (!storeChannel(normalizeDistributionChannel(record.distribution_channel))) {
    return new Response("This pair is not a Store review build.", {status: 403, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
  }
  const token = await issueReviewerToken(env, record.install_id);
  await env.PAIRINGS.put(key, JSON.stringify({...record, status: "verified", token, verified_at: Date.now(), verification_source: "store_reviewer"}), {expirationTtl: PAIR_TTL_SECONDS});
  return secureHtml('<!doctype html><html lang="en"><meta charset="utf-8"><title>Activated</title><body style="font:16px system-ui;max-width:560px;margin:40px auto;padding:0 18px"><h1>Review installation activated</h1><p>Return to the BMP Terbuka extension popup. It will detect activation automatically.</p></body></html>');
}

function versionParts(value) {
  return String(value || "")
    .split(".")
    .slice(0, 4)
    .map(x => Number.parseInt(x, 10))
    .map(x => Number.isFinite(x) ? x : 0);
}

function compareVersions(a, b) {
  const x = versionParts(a);
  const y = versionParts(b);
  const n = Math.max(x.length, y.length, 3);
  for (let i = 0; i < n; i++) {
    const xa = x[i] || 0;
    const ya = y[i] || 0;
    if (xa < ya) return -1;
    if (xa > ya) return 1;
  }
  return 0;
}

function releaseUrl(env) {
  return String(
    env.EXTENSION_RELEASE_URL || env.CHANNEL_URL || "https://t.me/bukabmp"
  ).trim();
}

async function pairStart(request, env) {
  if (!(await checkPairRateLimit(request, env))) {
    return json({error: "Terlalu banyak permintaan aktivasi. Coba lagi sebentar."}, 429, corsHeaders(request));
  }
  const body = await request.json().catch(() => ({}));
  const extensionVersion = String(body.extension_version || "").trim();
  const distributionChannel = normalizeDistributionChannel(body.distribution_channel);
  const policy = channelPolicy(env, distributionChannel);
  const minimumVersion = policy.minimumVersion;
  if (!extensionVersion || (minimumVersion && compareVersions(extensionVersion, minimumVersion) < 0)) {
    return json({
      error: `Versi BMP Terbuka ini sudah tidak didukung. Update ke versi ${minimumVersion || policy.latestVersion} atau lebih baru.`,
      code: "update_required",
      minimum_version: minimumVersion || null,
      release_url: policy.releaseUrl,
      distribution_channel: distributionChannel
    }, 426, corsHeaders(request));
  }

  const installId = String(body.install_id || "");
  if (!/^[0-9a-fA-F-]{20,64}$/.test(installId)) {
    return json({error: "install_id tidak valid"}, 400);
  }
  if (!env.BOT_USERNAME) {
    return json({error: "BOT_USERNAME belum dikonfigurasi"}, 503);
  }

  const pairId = randomToken(9);
  const pollSecret = randomToken(24);
  const now = Date.now();
  const record = {
    install_id: installId,
    extension_version: extensionVersion,
    distribution_channel: distributionChannel,
    poll_secret_hash: await sha256Hex(pollSecret),
    status: "pending",
    created_at: now
  };

  await env.PAIRINGS.put(`pair:${pairId}`, JSON.stringify(record), {
    expirationTtl: PAIR_TTL_SECONDS
  });

  return json({
    pair_id: pairId,
    poll_secret: pollSecret,
    deep_link: `https://t.me/${env.BOT_USERNAME}?start=${encodeURIComponent(pairId)}`,
    expires_at: now + PAIR_TTL_SECONDS * 1000
  }, 200, corsHeaders(request));
}

async function pairStatus(request, env, url) {
  const pairId = String(url.searchParams.get("pair_id") || "");
  const auth = request.headers.get("Authorization") || "";
  const pollSecret = auth.startsWith("Pair ") ? auth.slice(5) : "";
  if (!pairId || !pollSecret) {
    return json({error: "Pair authorization diperlukan"}, 401, corsHeaders(request));
  }

  const record = await env.PAIRINGS.get(`pair:${pairId}`, "json");
  if (!record) return json({status: "expired"}, 200, corsHeaders(request));

  const expected = record.poll_secret_hash;
  const actual = await sha256Hex(pollSecret);
  if (!expected || expected !== actual) {
    return json({error: "Pair authorization tidak valid"}, 403, corsHeaders(request));
  }

  if (record.status === "verified" && record.token) {
    return json({status: "verified", token: record.token}, 200, corsHeaders(request));
  }
  return json({status: "pending"}, 200, corsHeaders(request));
}


function versionPolicy(request, env, url) {
  const currentVersion = String(url.searchParams.get("extension_version") || "").trim();
  const channel = normalizeDistributionChannel(url.searchParams.get("distribution_channel"));
  const policy = channelPolicy(env, channel);

  return json({
    current_version: currentVersion || null,
    distribution_channel: policy.channel,
    latest_version: policy.latestVersion,
    minimum_version: policy.minimumVersion || null,
    force_after: policy.forceAfter,
    release_url: policy.releaseUrl,
    message: policy.message,
    store_ready: policy.storeReady,
    check_after_seconds: VERSION_CHECK_AFTER_SECONDS
  }, 200, corsHeaders(request));
}


async function adminKvInventory(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }

  const inventory = await kvInventorySummary(env);
  if (!inventory.available) {
    return json({error: "PAIRINGS KV listing unavailable"}, 503, corsHeaders(request));
  }

  return json({
    ok: true,
    total_keys: inventory.total_keys,
    families: inventory.families
  }, 200, corsHeaders(request));
}


async function adminSupporterMigrationDryRun(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }

  const result = await supporterMigrationDryRun(env);
  const status = result.ok ? 200 : 409;
  return json(result, status, corsHeaders(request));
}


async function adminSupporterMigrationCompare(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }

  const result = await supporterMigrationCompare(env);
  const status = result.ok ? 200 : 409;
  return json(result, status, corsHeaders(request));
}


async function adminSupporterMigrationApply(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }

  const body = await request.json().catch(() => null);
  const result = await supporterMigrationApply(env, body?.confirm);
  const status = result.ok ? 200 : 409;
  return json(result, status, corsHeaders(request));
}


async function adminReferralSelfTest(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }

  const body = await request.json().catch(() => null);
  const result = await runReferralSelfTest(env, body?.confirm);
  const status = result.ok ? 200 : 409;
  return json(result, status, corsHeaders(request));
}


async function adminSetWebhook(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401);
  }
  if (!env.PUBLIC_BASE_URL || !env.TELEGRAM_WEBHOOK_SECRET) {
    return json({error: "PUBLIC_BASE_URL / TELEGRAM_WEBHOOK_SECRET belum diset"}, 503);
  }

  const webhook = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/telegram/webhook`;
  const result = await tg(env, "setWebhook", {
    url: webhook,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "edited_message", "callback_query", "pre_checkout_query"],
    drop_pending_updates: true
  });
  await tg(env, "setMyCommands", {
    commands: [
      {command: "start", description: "Buka BMP Terbuka"},
      {command: "menu", description: "Buka menu akun"},
      {command: "ask", description: "Tanya BMP Terbuka Assistant"},
      {command: "help", description: "Bantuan BMP Terbuka"}
    ]
  }).catch(() => {});
  return json({ok: true, webhook, result});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {status: 204, headers: corsHeaders(request)});
    }

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        const d1 = await d1ReadProbe(env);
        return json({
          service: "BMP Terbuka Community",
          version: APP_VERSION,
          status: "ok",
          stores_documents: false,
          stores_source_credentials: false,
          support_bot: true,
          support_kb_entries: SUPPORT_KB.length,
          support_ai_model: SUPPORT_AI_MODEL,
          support_ai_configured: Boolean(env.AI && typeof env.AI.run === "function"),
          support_access_mode: "group_only_except_privileged_or_active_supporter",
          support_privileged_users_configured: supportPrivilegedUserIds(env).size,
          support_group_configured: Boolean(env.SUPPORT_GROUP_ID || env.GROUP_ID),
          support_explicit_trigger_only: true,
          privacy_gate_enabled: true,
          privacy_gate_scope: "official_group_text_caption_contact_location",
          supporter_pass: true,
          supporter_packages: {day: {stars: 2, days: 1}, month: {stars: 50, days: 30}},
          supporter_activation_bonus_days: SUPPORTER_ACTIVATION_BONUS_DAYS,
          supporter_activation_max_days: SUPPORTER_ACTIVATION_MAX_DAYS,
          supporter_context_turns: SUPPORTER_CONTEXT_MAX_TURNS,
          store_channels: ["cws", "edge"],
          realtime_extension_state: true,
          reviewer_activation_configured: Boolean(env.STORE_REVIEWER_SECRET),
          bot_v2_d1_bound: d1.bound,
          bot_v2_d1_readable: d1.readable,
          bot_v2_d1_write_enabled: d1WritesEnabled(env),
          bot_v2_d1_replay_enabled: d1ReplayEnabled(env),
          bot_v2_d1_migration_enabled: d1MigrationEnabled(env),
          bot_v2_supporter_d1_enabled: d1SupporterEnabled(env),
          bot_v2_payment_d1_enabled: d1PaymentEnabled(env),
          bot_v2_referral_d1_enabled: d1ReferralEnabled(env),
          bot_v2_referral_self_test_enabled: d1ReferralSelfTestEnabled(env),
          bot_v2_activation_ledger_enabled: d1ActivationLedgerEnabled(env)
        }, 200, corsHeaders(request));
      }

      if (url.pathname === "/v1/version" && request.method === "GET") {
        return versionPolicy(request, env, url);
      }

      if (url.pathname === "/v1/extension-state" && request.method === "GET") {
        return await extensionState(request, env, url);
      }

      if (url.pathname === "/review" && request.method === "GET") {
        return reviewerPage();
      }

      if (url.pathname === "/v1/reviewer/activate" && request.method === "POST") {
        return await reviewerActivate(request, env);
      }

      if (url.pathname === "/v1/pair/start" && request.method === "POST") {
        return await pairStart(request, env);
      }

      if (url.pathname === "/v1/pair/status" && request.method === "GET") {
        return await pairStatus(request, env, url);
      }

      if (url.pathname === "/telegram/webhook" && request.method === "POST") {
        if (!telegramWebhookAuthorized(request, env)) {
          return json({error: "unauthorized"}, 401);
        }

        const update = await request.json();
        const claim = await claimTelegramUpdate(env, update?.update_id);
        if (!claim.process) {
          return json({ok: true});
        }

        try {
          await handleTelegram(env, update);
        } catch (e) {
          console.error("telegram_update_failed", {
            update_id: update?.update_id ?? null,
            error_name: auditErrorName(e)
          });

          const chatId =
            update?.message?.chat?.id ??
            update?.callback_query?.message?.chat?.id ??
            null;

          if (chatId) {
            const isGroupUpdate = ["group", "supergroup"].includes(update?.message?.chat?.type || "");
            const isSuccessfulPayment = Boolean(
              update?.message?.successful_payment
            );
            await tg(env, "sendMessage", {
              chat_id: chatId,
              text: isGroupUpdate
                ? "⚠️ BMP Terbuka Assistant lagi error sebentar. Coba lagi nanti atau kirim detail kendalanya supaya member lain bisa bantu."
                : isSuccessfulPayment
                  ? "⚠️ Pembayaran Telegram terdeteksi, tetapi status Supporter belum berhasil diperbarui. Jangan bayar ulang. Kirim /paysupport lewat DM bot agar transaksi ini diperiksa."
                  : "⚠️ Aktivasi belum selesai karena terjadi kesalahan backend. Update sudah diterima dan tidak akan mengunci antrean bot."
            }).catch(() => {});
          }
        }

        // Important: always acknowledge a valid Telegram webhook with HTTP 200.
        // A poisoned activation update must never block later /start messages.
        return json({ok: true});
      }

      if (url.pathname === "/admin/extension-state" && ["GET", "POST"].includes(request.method)) {
        return await adminExtensionState(request, env, url);
      }

      if (url.pathname === "/admin/kv-inventory" && request.method === "GET") {
        return await adminKvInventory(request, env);
      }

      if (url.pathname === "/admin/supporter-migration-dry-run" && request.method === "GET") {
        return await adminSupporterMigrationDryRun(request, env);
      }

      if (url.pathname === "/admin/supporter-migration-compare" && request.method === "GET") {
        return await adminSupporterMigrationCompare(request, env);
      }

      if (url.pathname === "/admin/supporter-migration-apply" && request.method === "POST") {
        return await adminSupporterMigrationApply(request, env);
      }

      if (url.pathname === "/admin/referral-self-test" && request.method === "POST") {
        return await adminReferralSelfTest(request, env);
      }

      if (url.pathname === "/admin/set-webhook" && request.method === "POST") {
        return await adminSetWebhook(request, env);
      }

      return json({error: "not_found"}, 404, corsHeaders(request));
    } catch (e) {
      console.error("worker_request_failed", {
        error_name: auditErrorName(e)
      });
      return json({error: "internal_error"}, 500, corsHeaders(request));
    }
  }
};