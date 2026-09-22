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
import {v21UiCanaryCount, v21UiCanaryEnabled, v21UiCanaryUser, v21UiGlobalEnabled} from "./features/ui-canary.js";
import {b64url, b64urlJson, importSigningKey, randomToken, sha256Hex} from "./security/crypto.js";
import {checkActivationRefreshRateLimit, checkAdEventRateLimit, checkPairRateLimit} from "./security/rate-limit.js";
import {telegramWebhookAuthorized} from "./security/webhook-auth.js";
import {claimTelegramUpdate} from "./security/idempotency.js";
import {d1ActivationLedgerEnabled, d1MigrationEnabled, d1PaymentEnabled, d1ReadProbe, d1ReferralEnabled, d1ReferralSelfTestEnabled, d1ReplayEnabled, d1SupporterEnabled, d1WritesEnabled} from "./data/d1/mode.js";
import {kvInventorySummary} from "./security/kv-inventory.js";
import {supporterMigrationApply, supporterMigrationCompare, supporterMigrationDryRun} from "./features/supporter-migration.js";
import {runReferralSelfTest} from "./features/referral-self-test.js";
import {activationLedgerMigrationApply, activationLedgerMigrationDryRun} from "./features/activation-ledger-migration.js";
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
import {
  legacyMenuDeepLink,
  sendLegacyAccountMenu,
  sendLegacyActivationMenu,
  sendLegacyHelpPanel,
  sendLegacyMainMenu,
  sendLegacyReferralMenu,
  sendLegacySupporterMenu,
  sendLegacySupporterPackageConfirmation
} from "./menus/legacy.js";
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
import {PAIR_TTL_SECONDS, TOKEN_REFRESH_MIN_VERSION, TOKEN_TTL_DAYS, activationTokenReauthFloor, refreshActivationToken, verifyPairForUser} from "./features/activation.js";
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
import {recordAdEvent, sanitizeAdEvent, sanitizeAdsState} from "./features/ads.js";
import {analyticsSummary, ingestTelemetry} from "./features/telemetry.js";
import {MEDIA_LIMITS, revokeAdMedia, serveAdMedia, storeAdMedia} from "./features/ad-media.js";
import {communityStats} from "./features/community-stats.js";
import {readGlobalVersionPolicy, resolveVersionPolicy, writeGlobalVersionPolicy} from "./features/version-policy.js";
import {publishAllChannels} from "./features/control-bulk.js";
import {controlCenterPage} from "./control-center-ui.js";

const APP_VERSION = "1.0.5-support-bot-v23-control-center-v02";
const TOKEN_ISSUER = "bmp-terbuka-community";
const TOKEN_AUDIENCE = "bmp-terbuka-extension";
const VERSION_CHECK_AFTER_SECONDS = 24 * 60 * 60;
const REVIEWER_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const CLOUD_STATE_DEFAULT_TTL_SECONDS = 5 * 60;
const DISTRIBUTION_CHANNELS = Object.freeze(["github", "android", "cws", "edge"]);
const BMP_GROUP_COMMANDS = new Set([
  "start", "menu", "help", "bmphelp", "verify", "id", "activation",
  "tutorial", "install", "android", "desktop", "group", "update", "fitur",
  "storage", "bug", "faq", "quota", "support", "supporter", "supporters",
  "terms", "paysupport"
]);
const TELEGRAM_COMMAND_SCOPE_STATE_KEY = "telegram-command-scopes:minimal-v2";
const CONTROL_HISTORY_LIMIT = 20;
const CONTROL_HISTORY_TTL_SECONDS = 90 * 24 * 60 * 60;


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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
    await sendSupporterTermsPanel(
      env,
      message.chat.id,
      message.from?.id
    );
    return true;
  }
  if (currentCommand === "paysupport") {
    const args = String(invocation.command?.args || "").trim();
    if (args) {
      await handlePaymentSupportCommand(env, message, args);
    } else {
      await sendSupporterPaymentPanel(
        env,
        message.chat.id,
        message.from?.id
      );
    }
    return true;
  }
  if (currentCommand === "supporter") {
    const arg = String(invocation.command?.args || "").trim().toLowerCase();
    if (["public", "anonymous", "private"].includes(arg)) {
      await setSupporterWallMode(env, message, arg);
      await sendSupporterWallPanel(
        env,
        message.chat.id,
        message.from?.id
      );
    } else {
      await sendSupporterStatusPanel(
        env,
        message.chat.id,
        message.from?.id
      );
    }
    return true;
  }
  if (currentCommand === "supporters") {
    await sendSupporterWallPanel(
      env,
      message.chat.id,
      message.from?.id
    );
    return true;
  }
  if (
    currentCommand === "help" ||
    currentCommand === "bmphelp" ||
    currentCommand === "faq" ||
    currentCommand === "group"
  ) {
    await sendHelpPanel(
      env,
      message.chat.id,
      access,
      message.from?.id
    );
    return true;
  }
  if (currentCommand === "tutorial") {
    await sendExtensionPage(
      env,
      message.chat.id,
      message.from?.id,
      null,
      "start"
    );
    return true;
  }
  if (
    currentCommand === "install" ||
    currentCommand === "android" ||
    currentCommand === "desktop" ||
    currentCommand === "update"
  ) {
    await sendExtensionPage(
      env,
      message.chat.id,
      message.from?.id,
      null,
      "install"
    );
    return true;
  }
  if (currentCommand === "fitur") {
    await sendExtensionMenu(
      env,
      message.chat.id,
      message.from?.id
    );
    return true;
  }
  if (currentCommand === "storage") {
    await sendExtensionPage(
      env,
      message.chat.id,
      message.from?.id,
      null,
      "storage"
    );
    return true;
  }
  if (currentCommand === "bug") {
    await sendReportHelpPanel(
      env,
      message.chat.id,
      message.from?.id,
      null
    );
    return true;
  }
  if (currentCommand === "quota") {
    await sendAiQuotaPanel(
      env,
      message.chat.id,
      message.from
    );
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
    await sendSupportReply(env, message, "Kuota AI support hari ini sudah habis (sisa 0 dari 6). Coba lagi besok. FAQ yang bisa dijawab langsung dari basis pengetahuan tetap tersedia tanpa kuota AI. Buka menu utama untuk Bantuan, Ekstensi, atau Supporter.");
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
      await sendSupportReply(env, message, "Jawaban AI belum berhasil dibuat. Buka menu Bantuan atau kirim pertanyaan BMP Terbuka dengan konteks yang lebih spesifik.");
    }
  } catch (e) {
    console.error("support_ai_failed", {error_name: auditErrorName(e)});
    await sendSupportReply(env, message, "AI support sedang tidak tersedia. Menu Bantuan dan Ekstensi tetap bisa dipakai.");
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

    const v21Canary = v21UiCanaryUser(env, userId);

    if (
      !isPrivateChat(message) &&
      commandName &&
      commandName !== "ask" &&
      BMP_GROUP_COMMANDS.has(commandName)
    ) {
      // Only BMP Terbuka commands fall back to our assistant panel. Unknown slash
      // commands are left alone so moderation bots such as Rose can handle them.
      await sendGroupBotPanel(env, message);
      return;
    }

    if (
      !isPrivateChat(message) &&
      v21Canary &&
      ["start", "menu", "help", "bmphelp"].includes(commandName)
    ) {
      await sendGroupBotPanel(env, message);
      return;
    }

    if (
      !isPrivateChat(message) &&
      !v21Canary &&
      commandName === "menu"
    ) {
      await tg(env, "sendMessage", {
        chat_id: chatId,
        text: "Menu akun BMP Terbuka dibuka lewat DM bot.",
        reply_parameters: {message_id: message.message_id},
        reply_markup: {
          inline_keyboard: [[{
            text: "Buka Menu Saya",
            url: legacyMenuDeepLink(env)
          }]]
        }
      });
      return;
    }

    if (v21Canary && commandName === "id") {
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
      if (v21Canary) {
        await sendSupporterMenu(env, message, access);
      } else {
        await sendLegacySupporterMenu(env, message, access);
      }
      return;
    }

    if (
      isPrivateChat(message) &&
      commandName === "start" &&
      String(command.args || "").toLowerCase() === "help_extension"
    ) {
      if (v21Canary) {
        await sendExtensionMenu(env, chatId, userId);
      } else {
        await sendLegacyMainMenu(env, chatId);
      }
      return;
    }

    if (
      isPrivateChat(message) &&
      commandName === "start" &&
      String(command.args || "").toLowerCase() === "ai"
    ) {
      if (v21Canary) {
        await sendAiMenu(env, chatId, message.from);
      } else {
        await sendLegacyMainMenu(env, chatId);
      }
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
      if (v21Canary) {
        await sendMainMenu(env, chatId, userId);
      } else {
        await sendLegacyMainMenu(env, chatId);
      }
      return;
    }

    if (isPrivateChat(message) && commandName === "help") {
      const access = await supportPrivilegeForMessage(env, message);
      if (v21Canary) {
        await sendHelpPanel(env, chatId, access, userId);
      } else {
        await sendLegacyHelpPanel(env, chatId, access);
      }
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
        if (v21Canary) {
          await sendMainMenu(env, chatId, userId);
        } else {
          await sendLegacyMainMenu(env, chatId);
        }
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
      if (v21Canary) {
        await sendReferralMenu(env, chatId, userId);
      } else {
        await sendLegacyMainMenu(env, chatId);
      }
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
      if (!v21UiCanaryUser(env, q.from?.id)) {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Menu ini sedang diuji terbatas."
        }).catch(() => {});
        return;
      }
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
    const v21Canary = v21UiCanaryUser(env, userId);

    if (callback.namespace === "menu") {
      await tg(env, "answerCallbackQuery", {
        callback_query_id: q.id
      }).catch(() => {});

      if (callback.action === "main") {
        if (v21Canary) {
          await sendMainMenu(env, chatId, userId, menuMessageId);
        } else {
          await sendLegacyMainMenu(env, chatId);
        }
        return;
      }
      if (callback.action === "account") {
        if (v21Canary) {
          await sendAccountMenu(env, chatId, q.from, menuMessageId);
        } else {
          await sendLegacyAccountMenu(env, chatId, userId);
        }
        return;
      }
      if (callback.action === "ai") {
        if (v21Canary) {
          await sendAiMenu(env, chatId, q.from, menuMessageId);
        } else {
          await sendLegacyMainMenu(env, chatId);
        }
        return;
      }
      if (callback.action === "extension") {
        if (v21Canary) {
          await sendExtensionMenu(env, chatId, userId, menuMessageId);
        } else {
          await sendLegacyMainMenu(env, chatId);
        }
        return;
      }
      if (callback.action === "supporter") {
        const callbackMessage = {...q.message, from: q.from};
        const access = await supportPrivilegeForMessage(env, callbackMessage);
        if (v21Canary) {
          await sendSupporterMenu(
            env,
            callbackMessage,
            access,
            menuMessageId
          );
        } else {
          await sendLegacySupporterMenu(env, callbackMessage, access);
        }
        return;
      }
      if (callback.action === "referral") {
        if (v21Canary) {
          await sendReferralMenu(env, chatId, userId, menuMessageId);
        } else {
          await sendLegacyReferralMenu(env, chatId, userId);
        }
        return;
      }
      if (callback.action === "activation") {
        if (v21Canary) {
          await sendActivationMenu(
            env,
            chatId,
            userId,
            menuMessageId
          );
        } else {
          await sendLegacyActivationMenu(env, chatId);
        }
        return;
      }
      if (callback.action === "help") {
        const callbackMessage = {...q.message, from: q.from};
        const access = await supportPrivilegeForMessage(
          env,
          callbackMessage
        );
        if (v21Canary) {
          await sendHelpPanel(
            env,
            chatId,
            access,
            userId,
            menuMessageId
          );
        } else {
          await sendLegacyHelpPanel(env, chatId, access);
        }
        return;
      }
    }

    if (callback.namespace === "ai") {
      if (!v21Canary) {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Menu ini sedang diuji terbatas."
        }).catch(() => {});
        return;
      }
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
      if (!v21Canary) {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Menu ini sedang diuji terbatas."
        }).catch(() => {});
        return;
      }
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
      if (!v21Canary) {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Menu ini sedang diuji terbatas."
        }).catch(() => {});
        return;
      }
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
      if (!v21Canary) {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Menu ini sedang diuji terbatas."
        }).catch(() => {});
        return;
      }
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
        if (!v21Canary) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Menu ini sedang diuji terbatas."
          }).catch(() => {});
          return;
        }
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
        if (!v21Canary) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Menu ini sedang diuji terbatas."
          }).catch(() => {});
          return;
        }
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
        if (!v21Canary) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Menu ini sedang diuji terbatas."
          }).catch(() => {});
          return;
        }
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
        if (!v21Canary) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Menu ini sedang diuji terbatas."
          }).catch(() => {});
          return;
        }
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
        if (v21Canary) {
          await sendSupporterTermsPanel(
            env,
            chatId,
            userId,
            menuMessageId
          );
        } else {
          await tg(env, "sendMessage", {
            chat_id: chatId,
            text: supporterTermsText()
          });
        }
        return;
      }

      if (callback.action === "wall-mode") {
        if (!v21Canary) {
          await tg(env, "answerCallbackQuery", {
            callback_query_id: q.id,
            text: "Menu ini sedang diuji terbatas."
          }).catch(() => {});
          return;
        }
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
        if (v21Canary) {
          await sendSupporterPackageConfirmation(
            env,
            userId,
            chatId,
            callback.packageId,
            menuMessageId
          );
        } else {
          await sendLegacySupporterPackageConfirmation(
            env,
            userId,
            chatId,
            callback.packageId
          );
        }
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

function strictControlChannel(value, {allowAll = false} = {}) {
  const channel = String(value || "").trim().toLowerCase();
  if (allowAll && channel === "all") return "all";
  return DISTRIBUTION_CHANNELS.includes(channel) ? channel : "";
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
    status_badge: {visible: false, kind: "info", text: ""},
    ads: sanitizeAdsState(null),
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
  const badge = raw.status_badge && typeof raw.status_badge === "object" ? raw.status_badge : {};
  const badgeKindRaw = safeCloudText(badge.kind, 24).toLowerCase();
  const badgeKind = ["info", "success", "warning", "community", "supporter"].includes(badgeKindRaw) ? badgeKindRaw : "info";
  const badgeText = safeCloudText(badge.text, 160);
  out.status_badge = {
    visible: badge.visible === true && Boolean(badgeText),
    kind: badgeKind,
    text: badgeText
  };

  out.ads = sanitizeAdsState(raw.ads);

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

function parseExtensionStateJson(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function readExtensionStateFromD1(env, channel) {
  if (!env?.BOT_DB || typeof env.BOT_DB.prepare !== "function") {
    return {available: false, state: null};
  }
  try {
    const row = await env.BOT_DB.prepare(
      "SELECT state_json FROM extension_control_state WHERE channel = ? LIMIT 1"
    ).bind(normalizeDistributionChannel(channel)).first();
    return {available: true, state: parseExtensionStateJson(row?.state_json)};
  } catch (error) {
    // Rolling deploy safety: before migration 0004 lands, continue serving the
    // existing KV/env state instead of breaking extension-state reads.
    console.warn("extension_control_state_d1_read_failed", {
      error_name: auditErrorName(error)
    });
    return {available: false, state: null};
  }
}

async function writeExtensionStateToD1(env, channel, state) {
  if (!env?.BOT_DB || typeof env.BOT_DB.prepare !== "function") return false;
  const normalized = normalizeDistributionChannel(channel);
  const clean = sanitizeExtensionState(state);
  try {
    await env.BOT_DB.prepare(
      "INSERT INTO extension_control_state(channel, state_json, updated_at) VALUES(?, ?, ?) " +
      "ON CONFLICT(channel) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at"
    ).bind(normalized, JSON.stringify(clean), Date.now()).run();
    return true;
  } catch (error) {
    console.warn("extension_control_state_d1_write_failed", {
      error_name: auditErrorName(error)
    });
    return false;
  }
}

async function writeExtensionState(env, channel, state) {
  const normalized = normalizeDistributionChannel(channel);
  const clean = sanitizeExtensionState(state);
  const d1Stored = await writeExtensionStateToD1(env, normalized, clean);

  let kvStored = false;
  if (env.PAIRINGS) {
    try {
      await env.PAIRINGS.put(extensionStateKey(normalized), JSON.stringify(clean));
      kvStored = true;
    } catch (error) {
      console.warn("extension_control_state_kv_write_failed", {
        error_name: auditErrorName(error)
      });
    }
  }

  if (!d1Stored && !kvStored) {
    throw new Error("extension_state_storage_unavailable");
  }
  return clean;
}

async function readExtensionState(env, channel) {
  const normalized = normalizeDistributionChannel(channel);
  const d1 = await readExtensionStateFromD1(env, normalized);
  if (d1.state) return sanitizeExtensionState(d1.state);

  let state = null;
  if (env.PAIRINGS) state = await env.PAIRINGS.get(extensionStateKey(normalized), "json");
  if (!state) {
    const raw = envString(
      env,
      channelEnvName(normalized, "STATE_JSON"),
      envString(env, "EXTENSION_STATE_JSON", "")
    );
    if (raw) state = parseExtensionStateJson(raw);
  }

  // First read after migration 0004 self-baselines the current state into D1.
  // This removes KV's cross-PoP propagation delay without requiring an owner
  // to republish every channel during the migration window.
  if (state && d1.available) {
    await writeExtensionStateToD1(env, normalized, state);
  }
  return sanitizeExtensionState(state);
}

async function extensionState(request, env, url) {
  const channel = normalizeDistributionChannel(url.searchParams.get("distribution_channel"));
  return json(await readExtensionState(env, channel), 200, corsHeaders(request));
}

async function adEvent(request, env) {
  if (!(await checkAdEventRateLimit(request, env))) {
    return json({error: "rate_limited"}, 429, corsHeaders(request));
  }
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return json({error: "payload_too_large"}, 413, corsHeaders(request));
  }
  const body = await request.json().catch(() => null);
  const event = sanitizeAdEvent(body);
  if (!event) {
    return json({error: "invalid_event"}, 400, corsHeaders(request));
  }

  // Accept metrics only for the campaign that is currently eligible on the
  // reported distribution channel. This prevents arbitrary campaign IDs from
  // polluting analytics and safely ignores late events from a replaced campaign.
  const state = await readExtensionState(env, event.distribution_channel);
  const ads = state.ads || {};
  const placementEnabled = event.placement === "card"
    ? ads.placements?.card === true
    : ads.placements?.interstitial === true && ads.interstitial?.enabled === true;
  const currentCampaign = Boolean(
    ads.active === true &&
    placementEnabled &&
    String(ads.campaign_id || "") === event.campaign_id &&
    Number(ads.revision || 0) === Number(event.revision || 0)
  );
  if (!currentCampaign) {
    return json({ok: true, ignored: true, reason: "stale_or_inactive_campaign"}, 202, corsHeaders(request));
  }

  const result = await recordAdEvent(env, event);
  if (!result.ok) {
    return json({error: result.reason || "invalid_event"}, 400, corsHeaders(request));
  }
  return json(result, 202, corsHeaders(request));
}

async function adminExtensionState(request, env, url) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }
  if (!env.PAIRINGS) return json({error: "PAIRINGS KV belum dikonfigurasi"}, 503, corsHeaders(request));
  const rawChannel = String(url.searchParams.get("distribution_channel") || "").trim().toLowerCase();
  const channel = rawChannel ? strictControlChannel(rawChannel) : "github";
  if (!channel) {
    return json({error: "invalid_distribution_channel"}, 400, corsHeaders(request));
  }
  const key = extensionStateKey(channel);

  if (request.method === "GET") {
    const existing = await env.PAIRINGS.get(key, "json");
    return json({channel, state: sanitizeExtensionState(existing)}, 200, corsHeaders(request));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({error: "JSON body tidak valid"}, 400, corsHeaders(request));
  const state = sanitizeExtensionState(body);
  await writeExtensionState(env, channel, state);
  return json({ok: true, channel, state}, 200, corsHeaders(request));
}

function controlAuthorized(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return Boolean(
    env.ADMIN_SETUP_TOKEN &&
    auth === `Bearer ${env.ADMIN_SETUP_TOKEN}`
  );
}

function controlHistoryIndexKey(channel) {
  return `control-history-index:${normalizeDistributionChannel(channel)}`;
}

function controlHistoryStateKey(channel, id) {
  return `control-history:${normalizeDistributionChannel(channel)}:${id}`;
}

function safeControlReason(value, fallback = "control_center_publish") {
  const clean = String(value || "")
    .replace(/[^a-zA-Z0-9_.:-]+/g, "_")
    .slice(0, 64);
  return clean || fallback;
}

function controlStateSummary(state) {
  const ads = state?.ads || {};
  const campaign = String(ads.campaign_id || "");
  if (campaign) {
    return `${ads.enabled ? "ads:on" : "ads:off"} • ${campaign} • r${Number(ads.revision || 0)}`;
  }
  const badge = state?.status_badge || {};
  if (badge.visible && badge.text) {
    return `badge • ${String(badge.text).slice(0, 72)}`;
  }
  return "surface state";
}

async function controlHistory(env, channel) {
  if (!env.PAIRINGS) return [];
  const key = controlHistoryIndexKey(channel);
  const raw = await env.PAIRINGS.get(key, "json");
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(item =>
      item &&
      typeof item === "object" &&
      /^[a-z0-9-]{6,80}$/i.test(String(item.id || ""))
    )
    .slice(0, CONTROL_HISTORY_LIMIT);
}

async function snapshotControlState(env, channel, state, reason) {
  if (!env.PAIRINGS) throw new Error("PAIRINGS KV belum dikonfigurasi");
  const id = `${Date.now().toString(36)}-${randomToken(5).replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
  const createdAt = Date.now();
  const snapshot = {
    id,
    channel: normalizeDistributionChannel(channel),
    created_at: createdAt,
    reason: safeControlReason(reason, "snapshot"),
    summary: controlStateSummary(state),
    state: sanitizeExtensionState(state)
  };
  await env.PAIRINGS.put(
    controlHistoryStateKey(channel, id),
    JSON.stringify(snapshot),
    {expirationTtl: CONTROL_HISTORY_TTL_SECONDS}
  );

  const current = await controlHistory(env, channel);
  const next = [
    {
      id,
      created_at: createdAt,
      reason: snapshot.reason,
      summary: snapshot.summary
    },
    ...current.filter(item => item.id !== id)
  ].slice(0, CONTROL_HISTORY_LIMIT);
  await env.PAIRINGS.put(controlHistoryIndexKey(channel), JSON.stringify(next));
  return snapshot;
}

async function controlVersionPolicy(env, channel) {
  const normalized = normalizeDistributionChannel(channel);
  const policy = await resolveVersionPolicy(env, normalized, channelPolicy(env, normalized));
  return {
    distribution_channel: policy.channel,
    latest_version: policy.latestVersion,
    minimum_version: policy.minimumVersion || null,
    force_after: policy.forceAfter,
    release_url: policy.releaseUrl,
    message: policy.message,
    store_ready: policy.storeReady,
    source: policy.source || "env_fallback"
  };
}

async function controlReadJson(request, maxBytes = 64 * 1024) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {ok: false, error: "payload_too_large"};
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return {ok: false, error: "invalid_json"};
  }
  return {ok: true, body};
}

async function controlSession(request, env) {
  if (!controlAuthorized(request, env)) {
    return json({error: "unauthorized"}, 401);
  }
  return json({
    ok: true,
    worker_version: APP_VERSION,
    channels: DISTRIBUTION_CHANNELS,
    history_limit: CONTROL_HISTORY_LIMIT,
    auth_mode: "admin_setup_token",
    cloudflare_access_recommended: true
  });
}

async function controlStateApi(request, env, url) {
  if (!controlAuthorized(request, env)) {
    return json({error: "unauthorized"}, 401);
  }
  if (!env.PAIRINGS) {
    return json({error: "PAIRINGS KV belum dikonfigurasi"}, 503);
  }
  const rawTarget = String(url.searchParams.get("distribution_channel") || "github").trim().toLowerCase();
  const strictTarget = strictControlChannel(rawTarget, {allowAll: true});
  if (!strictTarget) return json({error: "invalid_distribution_channel"}, 400);
  const channel = strictTarget === "all" ? "github" : strictTarget;

  if (request.method === "GET") {
    if (rawTarget === "all") {
      const states = {};
      const histories = {};
      const version_policy = {};
      for (const item of DISTRIBUTION_CHANNELS) {
        states[item] = await readExtensionState(env, item);
        histories[item] = await controlHistory(env, item);
        version_policy[item] = await controlVersionPolicy(env, item);
      }
      return json({ok: true, channel: "all", worker_version: APP_VERSION, version_policy, states, histories});
    }
    const state = await readExtensionState(env, channel);
    return json({
      ok: true,
      channel,
      worker_version: APP_VERSION,
      version_policy: await controlVersionPolicy(env, channel),
      state,
      history: await controlHistory(env, channel)
    });
  }

  const parsed = await controlReadJson(request);
  if (!parsed.ok) return json({error: parsed.error}, parsed.error === "payload_too_large" ? 413 : 400);
  const incoming = parsed.body.state;
  if (!incoming || typeof incoming !== "object") {
    return json({error: "state_required"}, 400);
  }

  const reason = safeControlReason(parsed.body.reason);
  if (rawTarget === "all") {
    try {
      await publishAllChannels({
        channels: DISTRIBUTION_CHANNELS,
        incoming,
        reason,
        sanitize: value => sanitizeExtensionState(value),
        read: item => readExtensionState(env, item),
        snapshot: (item, value, why) => snapshotControlState(env, item, value, why),
        write: (item, value) => writeExtensionState(env, item, value),
        verify: async (item, expected) => {
          const actual = await readExtensionState(env, item);
          const comparable = value => {
            const clean = sanitizeExtensionState(value);
            delete clean.generated_at;
            return JSON.stringify(clean);
          };
          return comparable(actual) === comparable(expected);
        }
      });
    } catch (error) {
      return json({
        error: "all_publish_failed",
        detail: String(error?.message || error).slice(0, 160),
        rollback_errors: Array.isArray(error?.rollback_errors) ? error.rollback_errors : []
      }, 409);
    }
    const states = {};
    const histories = {};
    for (const item of DISTRIBUTION_CHANNELS) {
      states[item] = await readExtensionState(env, item);
      histories[item] = await controlHistory(env, item);
    }
    return json({ok: true, channel: "all", states, histories});
  }

  const current = await readExtensionState(env, channel);
  const state = sanitizeExtensionState(incoming);
  await snapshotControlState(env, channel, current, "before_" + reason);
  await writeExtensionState(env, channel, state);

  return json({
    ok: true,
    channel,
    state: await readExtensionState(env, channel),
    history: await controlHistory(env, channel)
  });
}

async function controlValidateApi(request, env, url) {
  if (!controlAuthorized(request, env)) {
    return json({error: "unauthorized"}, 401);
  }
  const parsed = await controlReadJson(request);
  if (!parsed.ok) return json({error: parsed.error}, parsed.error === "payload_too_large" ? 413 : 400);
  const rawTarget = String(url.searchParams.get("distribution_channel") || "github").trim().toLowerCase();
  const strictTarget = strictControlChannel(rawTarget, {allowAll: true});
  if (!strictTarget) return json({error: "invalid_distribution_channel"}, 400);
  const state = sanitizeExtensionState(parsed.body);
  return json({
    ok: true,
    channel: strictTarget,
    state,
    ...(strictTarget === "all" ? {validated_channels: [...DISTRIBUTION_CHANNELS]} : {})
  });
}

async function controlPauseAds(request, env) {
  if (!controlAuthorized(request, env)) {
    return json({error: "unauthorized"}, 401);
  }
  if (!env.PAIRINGS) {
    return json({error: "PAIRINGS KV belum dikonfigurasi"}, 503);
  }
  const parsed = await controlReadJson(request, 8192);
  if (!parsed.ok) return json({error: parsed.error}, parsed.error === "payload_too_large" ? 413 : 400);
  const channel = strictControlChannel(parsed.body.distribution_channel);
  if (!channel) return json({error: "invalid_distribution_channel"}, 400);
  const current = await readExtensionState(env, channel);
  await snapshotControlState(env, channel, current, "before_emergency_pause_ads");

  const next = sanitizeExtensionState({
    ...current,
    ads: {
      ...(current.ads || {}),
      enabled: false
    }
  });
  await writeExtensionState(env, channel, next);

  return json({
    ok: true,
    channel,
    state: await readExtensionState(env, channel),
    history: await controlHistory(env, channel)
  });
}

async function controlRollback(request, env) {
  if (!controlAuthorized(request, env)) {
    return json({error: "unauthorized"}, 401);
  }
  if (!env.PAIRINGS) {
    return json({error: "PAIRINGS KV belum dikonfigurasi"}, 503);
  }
  const parsed = await controlReadJson(request, 8192);
  if (!parsed.ok) return json({error: parsed.error}, parsed.error === "payload_too_large" ? 413 : 400);
  const channel = strictControlChannel(parsed.body.distribution_channel);
  if (!channel) return json({error: "invalid_distribution_channel"}, 400);
  const id = String(parsed.body.history_id || "");
  if (!/^[a-z0-9-]{6,80}$/i.test(id)) {
    return json({error: "invalid_history_id"}, 400);
  }

  const snapshot = await env.PAIRINGS.get(controlHistoryStateKey(channel, id), "json");
  if (!snapshot?.state) {
    return json({error: "history_not_found"}, 404);
  }

  const current = await readExtensionState(env, channel);
  await snapshotControlState(env, channel, current, "before_rollback");
  const restored = sanitizeExtensionState(snapshot.state);
  await writeExtensionState(env, channel, restored);

  return json({
    ok: true,
    channel,
    restored_from: id,
    state: await readExtensionState(env, channel),
    history: await controlHistory(env, channel)
  });
}

async function telemetryApi(request, env) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 16384) {
    return json({error: "payload_too_large"}, 413, corsHeaders(request));
  }
  const body = await request.json().catch(() => null);
  const result = await ingestTelemetry(env, body);
  if (!result.ok) {
    const status = result.reason === "rate_limited" ? 429 : result.reason === "telemetry_not_configured" ? 503 : 400;
    return json({error: result.reason}, status, corsHeaders(request));
  }
  return json(result, 202, corsHeaders(request));
}

async function controlAnalyticsApi(request, env, url) {
  if (!controlAuthorized(request, env)) return json({error: "unauthorized"}, 401);
  const summary = await analyticsSummary(env, {
    period: url.searchParams.get("period") || "7d",
    channel: url.searchParams.get("channel") || ""
  });
  return json({ok: true, ...summary});
}

async function controlCommunityApi(request, env, url) {
  if (!controlAuthorized(request, env)) return json({error: "unauthorized"}, 401);
  const force = url.searchParams.get("force") === "1";
  return json({ok: true, ...(await communityStats(env, {force}))});
}

async function controlMediaApi(request, env, url) {
  if (!controlAuthorized(request, env)) return json({error: "unauthorized"}, 401);
  if (request.method === "POST") {
    const parsed = await controlReadJson(request, 15 * 1024 * 1024);
    if (!parsed.ok) return json({error: parsed.error}, parsed.error === "payload_too_large" ? 413 : 400);
    const result = await storeAdMedia(env, parsed.body);
    return json(result.ok ? result : {error: result.reason}, result.ok ? 201 : 400);
  }
  const prefix = "/control/api/media/";
  const id = decodeURIComponent(url.pathname.slice(prefix.length));
  const result = await revokeAdMedia(env, id);
  return json(result.ok ? result : {error: result.reason}, result.ok ? 200 : result.reason === "not_found" ? 404 : 400);
}

async function controlVersionPolicyApi(request, env) {
  if (!controlAuthorized(request, env)) return json({error: "unauthorized"}, 401);
  if (request.method === "POST") {
    const parsed = await controlReadJson(request, 16384);
    if (!parsed.ok) return json({error: parsed.error}, parsed.error === "payload_too_large" ? 413 : 400);
    const result = await writeGlobalVersionPolicy(env, parsed.body);
    if (!result.ok) return json({error: result.reason}, 400);
  }
  const override = await readGlobalVersionPolicy(env);
  const effective = {};
  for (const item of DISTRIBUTION_CHANNELS) effective[item] = await controlVersionPolicy(env, item);
  return json({ok: true, policy: override, effective});
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
  const policy = await resolveVersionPolicy(env, distributionChannel, channelPolicy(env, distributionChannel));
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
  const reauthFloor = await activationTokenReauthFloor(
    env,
    String(body.current_token || ""),
    installId
  );

  const record = {
    install_id: installId,
    extension_version: extensionVersion,
    distribution_channel: distributionChannel,
    minimum_expiry_ms: Number(reauthFloor.expiryMs || 0),
    minimum_expiry_member_ref: String(reauthFloor.memberRef || ""),
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


async function tokenRefresh(request, env) {
  const auth = String(request.headers.get("Authorization") || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return json(
      {error: "Token aktivasi diperlukan.", code: "missing_token"},
      401,
      corsHeaders(request)
    );
  }

  const body = await request.json().catch(() => ({}));
  const installId = String(body.install_id || "");

  if (!(await checkActivationRefreshRateLimit(env, installId))) {
    return json(
      {
        error: "Terlalu banyak permintaan pembaruan aktivasi. Coba lagi sebentar.",
        code: "rate_limited"
      },
      429,
      corsHeaders(request)
    );
  }

  let result;
  try {
    result = await refreshActivationToken(env, {
      token,
      installId,
      extensionVersion: String(body.extension_version || "")
    });
  } catch (error) {
    console.error("activation_refresh_failed", {
      error_name: auditErrorName(error)
    });
    return json(
      {error: "Aktivasi belum dapat diperbarui.", code: "refresh_failed"},
      503,
      corsHeaders(request)
    );
  }

  if (!result.ok) {
    const status = result.reason === "update_required"
      ? 426
      : result.reason === "membership_required"
        ? 403
        : result.reason === "legacy_token"
          ? 409
          : 401;

    const message = result.reason === "update_required"
      ? "Pembaruan aktivasi tersedia mulai BMP Terbuka " +
        TOKEN_REFRESH_MIN_VERSION + "."
      : result.reason === "membership_required"
        ? "Keanggotaan Buka BMP + Group Terbuka perlu dipenuhi untuk memperbarui aktivasi."
        : result.reason === "legacy_token"
          ? "Token lama belum mendukung pembaruan otomatis. Verifikasi ulang satu kali dari extension."
          : "Token aktivasi tidak valid untuk pembaruan.";

    return json({
      error: message,
      code: result.reason,
      minimum_version:
        result.minimumVersion || TOKEN_REFRESH_MIN_VERSION
    }, status, corsHeaders(request));
  }

  return json({
    ok: true,
    token: result.token,
    expires_at: result.expiresAt,
    changed: result.changed,
    supporter_bonus_applied: result.supporterBonusApplied
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


async function versionPolicy(request, env, url) {
  const currentVersion = String(url.searchParams.get("extension_version") || "").trim();
  const channel = normalizeDistributionChannel(url.searchParams.get("distribution_channel"));
  const policy = await resolveVersionPolicy(env, channel, channelPolicy(env, channel));

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


async function adminActivationLedgerMigrationDryRun(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }

  const result = await activationLedgerMigrationDryRun(env);
  return json(result, result.ok ? 200 : 409, corsHeaders(request));
}


async function adminActivationLedgerMigrationApply(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }

  const body = await request.json().catch(() => null);
  const result = await activationLedgerMigrationApply(env, body?.confirm);
  return json(result, result.ok ? 200 : 409, corsHeaders(request));
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


function telegramPrivateCommands() {
  return [
    {command: "start", description: "Buka BMP Terbuka"},
    {command: "menu", description: "Buka menu utama"},
    {command: "help", description: "Buka bantuan"},
    {command: "verify", description: "Verifikasi kode aktivasi"},
    {command: "ask", description: "Tanya BMP Terbuka Assistant"}
  ];
}

function telegramGroupCommands() {
  return [
    {command: "ask", description: "Tanya BMP Terbuka Assistant"}
  ];
}

async function syncTelegramCommandScopes(env) {
  const scopesToClear = [
    {type: "default"},
    {type: "all_private_chats"},
    {type: "all_group_chats"},
    {type: "all_chat_administrators"}
  ];

  for (const scope of scopesToClear) {
    await tg(env, "deleteMyCommands", {scope});
  }

  const privateCommands = telegramPrivateCommands();
  const groupCommands = telegramGroupCommands();

  await tg(env, "setMyCommands", {
    scope: {type: "all_private_chats"},
    commands: privateCommands
  });
  await tg(env, "setMyCommands", {
    scope: {type: "all_group_chats"},
    commands: groupCommands
  });
  await tg(env, "setMyCommands", {
    scope: {type: "all_chat_administrators"},
    commands: groupCommands
  });

  return {
    private_commands: privateCommands.map(item => item.command),
    group_commands: groupCommands.map(item => item.command)
  };
}

async function ensureTelegramCommandScopesCurrent(env) {
  if (String(env.TELEGRAM_COMMAND_MENU_MODE || "").toLowerCase() !== "minimal") {
    return;
  }

  if (env.PAIRINGS) {
    const marker = await env.PAIRINGS.get(TELEGRAM_COMMAND_SCOPE_STATE_KEY);
    if (marker === "ok") return;
  }

  await syncTelegramCommandScopes(env);

  if (env.PAIRINGS) {
    await env.PAIRINGS.put(TELEGRAM_COMMAND_SCOPE_STATE_KEY, "ok");
  }
}


async function adminSyncTelegramCommands(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_SETUP_TOKEN || auth !== `Bearer ${env.ADMIN_SETUP_TOKEN}`) {
    return json({error: "unauthorized"}, 401, corsHeaders(request));
  }

  const commands = await syncTelegramCommandScopes(env);
  return json({ok: true, ...commands}, 200, corsHeaders(request));
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
  const commands = await syncTelegramCommandScopes(env);
  return json({ok: true, webhook, result, ...commands});
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
          extension_state_status_badge: true,
          realtime_ads_contract: true,
          ad_event_ingest: true,
          ad_event_rate_limited: true,
          ad_event_campaign_validated: true,
          control_center: true,
          control_center_history_limit: CONTROL_HISTORY_LIMIT,
          control_center_auth_mode: "admin_setup_token",
          control_center_v02: true,
          telemetry_ingest: true,
          telemetry_hmac_configured: Boolean(env.TELEMETRY_HASH_KEY),
          ad_media_r2_bound: Boolean(env.AD_MEDIA),
          community_stats: true,
          global_version_policy: true,
          ads_analytics_bound: Boolean(env.ADS_ANALYTICS && typeof env.ADS_ANALYTICS.writeDataPoint === "function"),
          telegram_command_menu_mode: String(env.TELEGRAM_COMMAND_MENU_MODE || "legacy").toLowerCase(),
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
          bot_v2_activation_ledger_enabled: d1ActivationLedgerEnabled(env),
          bot_v21_ui_enabled: v21UiGlobalEnabled(env),
          bot_v21_ui_canary_enabled: v21UiCanaryEnabled(env),
          bot_v21_ui_canary_user_count: v21UiCanaryCount(env)
        }, 200, corsHeaders(request));
      }

      if (url.pathname === "/control" && request.method === "GET") {
        if (!env.ADMIN_SETUP_TOKEN) {
          return json({error: "control_center_not_configured"}, 503);
        }
        return controlCenterPage();
      }

      if (url.pathname === "/control/api/session" && request.method === "GET") {
        return await controlSession(request, env);
      }

      if (url.pathname === "/control/api/state" && ["GET", "POST"].includes(request.method)) {
        return await controlStateApi(request, env, url);
      }

      if (url.pathname === "/control/api/analytics" && request.method === "GET") {
        return await controlAnalyticsApi(request, env, url);
      }

      if (url.pathname === "/control/api/community" && request.method === "GET") {
        return await controlCommunityApi(request, env, url);
      }

      if (url.pathname === "/control/api/media" && request.method === "POST") {
        return await controlMediaApi(request, env, url);
      }

      if (url.pathname.startsWith("/control/api/media/") && request.method === "DELETE") {
        return await controlMediaApi(request, env, url);
      }

      if (url.pathname === "/control/api/version-policy" && ["GET", "POST"].includes(request.method)) {
        return await controlVersionPolicyApi(request, env);
      }

      if (url.pathname === "/control/api/validate" && request.method === "POST") {
        return await controlValidateApi(request, env, url);
      }

      if (url.pathname === "/control/api/pause-ads" && request.method === "POST") {
        return await controlPauseAds(request, env);
      }

      if (url.pathname === "/control/api/rollback" && request.method === "POST") {
        return await controlRollback(request, env);
      }

      if (url.pathname === "/v1/version" && request.method === "GET") {
        return await versionPolicy(request, env, url);
      }

      if (url.pathname === "/v1/extension-state" && request.method === "GET") {
        return await extensionState(request, env, url);
      }

      if (url.pathname.startsWith("/v1/media/") && request.method === "GET") {
        return await serveAdMedia(request, env, decodeURIComponent(url.pathname.slice("/v1/media/".length)));
      }

      if (url.pathname === "/v1/telemetry" && request.method === "POST") {
        return await telemetryApi(request, env);
      }

      if (url.pathname === "/v1/ad-event" && request.method === "POST") {
        return await adEvent(request, env);
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

      if (url.pathname === "/v1/token/refresh" && request.method === "POST") {
        return await tokenRefresh(request, env);
      }

      if (url.pathname === "/telegram/webhook" && request.method === "POST") {
        if (!telegramWebhookAuthorized(request, env)) {
          return json({error: "unauthorized"}, 401);
        }

        const update = await request.json();

        // Keep Telegram's command menu intentionally small while preserving typed
        // legacy commands for compatibility.
        await ensureTelegramCommandScopesCurrent(env).catch(error => {
          console.error("telegram_command_scope_cleanup_failed", {
            error_name: auditErrorName(error)
          });
        });

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

      if (url.pathname === "/admin/activation-ledger-migration-dry-run" && request.method === "GET") {
        return await adminActivationLedgerMigrationDryRun(request, env);
      }

      if (url.pathname === "/admin/activation-ledger-migration-apply" && request.method === "POST") {
        return await adminActivationLedgerMigrationApply(request, env);
      }

      if (url.pathname === "/admin/sync-commands" && request.method === "POST") {
        return await adminSyncTelegramCommands(request, env);
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