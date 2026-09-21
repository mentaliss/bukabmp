import {sendExtensionPage} from "./extension.js";

export async function sendActivationMenu(
  env,
  chatId,
  userId = null,
  messageId = null
) {
  return await sendExtensionPage(
    env,
    chatId,
    userId,
    messageId,
    "activation"
  );
}
