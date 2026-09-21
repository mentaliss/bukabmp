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
