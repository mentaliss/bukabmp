import test from "node:test";
import assert from "node:assert/strict";

import {
  isAnonymousAdminMessage,
  isOfficialSupportGroup,
  parseBotCommand,
  supportInvocation
} from "../src/telegram/router.js";
import {detectSensitiveContent} from "../src/security/privacy-gate.js";
import {
  SUPPORTER_ACTIVATION_BONUS_DAYS,
  SUPPORTER_ACTIVATION_MAX_DAYS,
  SUPPORTER_CONTEXT_MAX_TURNS,
  parseSupportInvoicePayload,
  supporterPackage,
  supporterIsActive
} from "../src/features/supporter-model.js";

import {
  supportMenuText,
  supporterDeepLink,
  supporterTermsText
} from "../src/menus/supporter.js";

import {parseTelegramCallback} from "../src/telegram/callbacks.js";
import {claimTelegramUpdate, telegramUpdateKey} from "../src/security/idempotency.js";

import {
  createOpaqueReferralCode,
  parseReferralStartArg,
  referralDeepLink,
  referralEntitlementTotalDays,
  referralRewardDelta
} from "../src/features/referral.js";

test("telegram routing helpers preserve command and chat-scope behavior", () => {
  const env = {BOT_USERNAME: "bukabmp_bot", SUPPORT_GROUP_ID: "-10042"};
  assert.deepEqual(parseBotCommand("/ask halo", env), {command: "ask", args: "halo"});
  assert.equal(parseBotCommand("/ask@other_bot halo", env), null);
  assert.equal(isOfficialSupportGroup(env, {chat: {id: -10042, type: "supergroup"}}), true);
  assert.equal(isOfficialSupportGroup(env, {chat: {id: -10043, type: "supergroup"}}), false);
  assert.equal(isAnonymousAdminMessage({
    chat: {type: "supergroup"},
    sender_chat: {id: -10042},
    from: {id: 1087968824, is_bot: true, username: "GroupAnonymousBot"}
  }), true);
  assert.equal(supportInvocation({text: "/ask kode bmp"}, env).invoked, true);
});

test("privacy classifier preserves current sensitive-data boundaries", () => {
  assert.deepEqual(detectSensitiveContent({text: "email saya demo@example.invalid"}), {blocked: true, kind: "email"});
  assert.deepEqual(detectSensitiveContent({text: "password lupa"}), {blocked: false});
  assert.deepEqual(detectSensitiveContent({contact: {phone_number: "000"}}), {blocked: true, kind: "contact"});
  assert.deepEqual(detectSensitiveContent({text: "NIM saya 123456789"}), {blocked: true, kind: "nim"});
});

test("supporter model preserves live package and entitlement semantics", () => {
  assert.equal(SUPPORTER_ACTIVATION_BONUS_DAYS, 14);
  assert.equal(SUPPORTER_ACTIVATION_MAX_DAYS, 60);
  assert.equal(SUPPORTER_CONTEXT_MAX_TURNS, 6);
  assert.deepEqual(supporterPackage("day"), {id: "day", stars: 2, days: 1, title: "Supporter Pass — 1 Hari"});
  assert.deepEqual(supporterPackage("month"), {id: "month", stars: 50, days: 30, title: "Supporter Pass — 30 Hari"});
  assert.equal(supporterPackage("unknown"), null);
  assert.deepEqual(parseSupportInvoicePayload("support:v1:day:424242:AbCdEf12"), {
    package_id: "day",
    user_id: "424242",
    nonce: "AbCdEf12"
  });
  assert.equal(parseSupportInvoicePayload("support:v2:day:424242:AbCdEf12"), null);
  assert.equal(supporterIsActive({supporter_until: 2000}, 1000), true);
  assert.equal(supporterIsActive({supporter_until: 500}, 1000), false);
});

import {telegramWebhookAuthorized} from "../src/security/webhook-auth.js";
import {randomToken, sha256Hex} from "../src/security/crypto.js";

test("security helpers preserve webhook auth and token primitives", async () => {
  const env = {TELEGRAM_WEBHOOK_SECRET: "fixture-secret"};
  const good = new Request("https://worker.test/telegram/webhook", {
    headers: {"X-Telegram-Bot-Api-Secret-Token": "fixture-secret"}
  });
  const bad = new Request("https://worker.test/telegram/webhook", {
    headers: {"X-Telegram-Bot-Api-Secret-Token": "wrong"}
  });
  assert.equal(telegramWebhookAuthorized(good, env), true);
  assert.equal(telegramWebhookAuthorized(bad, env), false);
  assert.match(randomToken(12), /^[A-Za-z0-9_-]+$/);
  assert.equal((await sha256Hex("fixture")).length, 64);
});

import {
  androidHelpText,
  groupHelpText,
  supportHelpText,
  updateHelpText
} from "../src/menus/help.js";

test("help menu module preserves current user-visible copy", () => {
  assert.match(supportHelpText(), /Group Terbuka/);
  assert.match(supportHelpText({privileged: true}), /DM \+ Group Terbuka/);
  assert.match(androidHelpText(), /Microsoft Edge Canary/);
  assert.equal(groupHelpText(), "Group Terbuka: https://t.me/bukabmp/13");
  assert.match(updateHelpText(), /^Versi terbaru: v1\.0\.5/);
});

test("supporter menu module preserves live packages and benefits", () => {
  assert.equal(
    supporterDeepLink({BOT_USERNAME: "bukabmp_bot"}),
    "https://t.me/bukabmp_bot?start=support"
  );
  const menu = supportMenuText();
  assert.match(menu, /2 ⭐ — 1 hari/);
  assert.match(menu, /50 ⭐ — 30 hari/);
  assert.match(menu, /DM bot \+ AI support unlimited/);

  const terms = supporterTermsText();
  assert.match(terms, /\+14 hari/);
  assert.match(terms, /maksimum 60 hari/);
  assert.match(terms, /one-time, bukan subscription otomatis/);
});

test("callback parser only accepts known namespaces", () => {
  assert.deepEqual(
    parseTelegramCallback("verify:AbCdEf123456"),
    {namespace: "activation", action: "verify", pairId: "AbCdEf123456"}
  );
  assert.deepEqual(
    parseTelegramCallback("support:select:day"),
    {namespace: "supporter", action: "select", packageId: "day"}
  );
  assert.deepEqual(
    parseTelegramCallback("support:buy:month"),
    {namespace: "supporter", action: "buy", packageId: "month"}
  );
  assert.deepEqual(
    parseTelegramCallback("support:terms"),
    {namespace: "supporter", action: "terms"}
  );
  assert.equal(parseTelegramCallback("support:buy:year"), null);
  assert.equal(parseTelegramCallback("admin:delete:user"), null);
  assert.equal(parseTelegramCallback("verify:bad!"), null);
});

test("KV replay helper rejects a sequential duplicate update id", async () => {
  const kv = new Map();
  const env = {
    PAIRINGS: {
      async get(key) { return kv.get(String(key)) ?? null; },
      async put(key, value) { kv.set(String(key), String(value)); }
    }
  };
  const first = await claimTelegramUpdate(env, 12345);
  const second = await claimTelegramUpdate(env, 12345);
  assert.equal(first.process, true);
  assert.equal(second.process, false);
  assert.equal(telegramUpdateKey(12345), "telegram-update:12345");
});

test("referral core preserves the frozen inviter entitlement schedule", () => {
  assert.equal(referralEntitlementTotalDays(0), 0);
  assert.equal(referralEntitlementTotalDays(1), 2);
  assert.equal(referralEntitlementTotalDays(2), 4);
  assert.equal(referralEntitlementTotalDays(3), 7);
  assert.equal(referralEntitlementTotalDays(4), 9);
  assert.equal(referralEntitlementTotalDays(5), 12);
  assert.equal(referralEntitlementTotalDays(9), 12);
  assert.equal(referralEntitlementTotalDays(10), 20);
  assert.equal(referralEntitlementTotalDays(19), 20);
  assert.equal(referralEntitlementTotalDays(20), 40);
  assert.equal(referralEntitlementTotalDays(29), 40);
  assert.equal(referralEntitlementTotalDays(30), 60);
  assert.equal(referralEntitlementTotalDays(31), 62);

  assert.deepEqual(referralRewardDelta(3, 4), {
    entitlementTotalDays: 7,
    creditedDeltaDays: 3
  });
  assert.deepEqual(referralRewardDelta(5, 12), {
    entitlementTotalDays: 12,
    creditedDeltaDays: 0
  });
});

test("referral links use opaque codes and strict start parsing", () => {
  const code = createOpaqueReferralCode();
  assert.match(code, /^[A-Za-z0-9_-]{12,40}$/);
  assert.equal(parseReferralStartArg("ref_" + code), code);
  assert.equal(parseReferralStartArg("ref_424242"), null);
  assert.equal(parseReferralStartArg("support"), null);
  assert.equal(
    referralDeepLink({BOT_USERNAME: "bukabmp_bot"}, code),
    "https://t.me/bukabmp_bot?start=ref_" + code
  );
});

test("referred-user +1 day policy is intentionally absent from referral core", () => {
  const source = referralRewardDelta.toString() + referralEntitlementTotalDays.toString();
  assert.doesNotMatch(source, /referred.*1\s*day/i);
});
