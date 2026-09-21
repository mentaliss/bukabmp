import {tg} from "../telegram/api.js";

const MENU_TTL_SECONDS = 30 * 24 * 60 * 60;

function menuStateKey(userId) {
  return "bot-menu:" + String(userId);
}

async function rememberMenu(env, userId, chatId, messageId) {
  if (!env?.PAIRINGS || !userId || !messageId) return;
  await env.PAIRINGS.put(
    menuStateKey(userId),
    JSON.stringify({
      chat_id: String(chatId),
      message_id: Number(messageId)
    }),
    {expirationTtl: MENU_TTL_SECONDS}
  ).catch(() => {});
}

async function forgetMenu(env, userId) {
  if (!env?.PAIRINGS?.delete || !userId) return;
  await env.PAIRINGS.delete(menuStateKey(userId)).catch(() => {});
}

export async function renderMenu(
  env,
  {
    chatId,
    userId,
    messageId = null,
    text,
    replyMarkup,
    disableWebPagePreview = true
  }
) {
  const body = {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
    disable_web_page_preview: disableWebPagePreview
  };

  if (messageId) {
    try {
      const edited = await tg(env, "editMessageText", {
        ...body,
        message_id: Number(messageId)
      });
      await rememberMenu(env, userId, chatId, messageId);
      return edited;
    } catch (error) {
      if (String(error?.message || "").includes("message is not modified")) {
        await rememberMenu(env, userId, chatId, messageId);
        return {message_id: Number(messageId)};
      }
    }
  }

  if (env?.PAIRINGS && userId) {
    const previous = await env.PAIRINGS.get(menuStateKey(userId), "json")
      .catch(() => null);
    if (
      previous &&
      String(previous.chat_id) === String(chatId) &&
      Number(previous.message_id) > 0
    ) {
      await tg(env, "deleteMessage", {
        chat_id: chatId,
        message_id: Number(previous.message_id)
      }).catch(() => {});
    }
    await forgetMenu(env, userId);
  }

  const sent = await tg(env, "sendMessage", body);
  await rememberMenu(env, userId, chatId, sent?.message_id);
  return sent;
}

export async function renderCallbackMenu(env, q, text, replyMarkup) {
  return await renderMenu(env, {
    chatId: q.message.chat.id,
    userId: q.from?.id,
    messageId: q.message.message_id,
    text,
    replyMarkup
  });
}
