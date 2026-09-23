# Activation & Verification

BMP Terbuka uses community activation to connect users with update notices, security notices, support, and the community.

Activation does not ask for your reader password or source-portal credentials.

## First-Time Activation

Activation starts from the BMP Terbuka popup.

### 1. Open the Extension

After BMP Terbuka is installed, open the extension popup.

If it is not activated yet, the extension will show the activation/verification flow.

### 2. Start Telegram Verification

Press the activation option in the extension.

The extension opens the Telegram bot with a temporary pairing code.

That code links your extension installation to the verification flow. Do not share the activation code with other people.

### 3. Complete the Community Check

The bot may ask you to confirm membership in the required channel/group.

Follow the bot instructions until verification is complete.

### 4. Return to the Extension

After the bot reports a successful verification, return to the browser and open BMP Terbuka again.

The extension checks the pairing result automatically.

If the status has not changed yet, wait briefly and reopen the popup. Do not immediately uninstall the extension.

## If Telegram Opens Without the Code

If the Telegram deep link opens but the code is missing:

1. return to the extension popup;
2. copy the activation code shown there;
3. open the BMP Terbuka bot;
4. use the manual verification path shown by the extension/bot.

Do not enter another person's activation code.

## Activation Validity

A normal community activation token has a limited lifetime. The current BMP Terbuka release path uses a base activation period of about **14 days**.

This does not mean you need to reinstall the extension every two weeks. It allows access status to be refreshed over time.

## If Activation Expires

You **do not need to reinstall BMP Terbuka**.

Refresh or verify access again only when the extension asks for it.

In v1.1.0, the newer activation-token flow supports refresh when eligible. If refresh cannot be completed, the extension may request Telegram re-verification.

## Re-verification

Re-verification may be used when:

- a token has expired;
- an older token must move to the newer token scheme;
- community status needs to be checked again;
- the extension explicitly requests verification.

For migration from an older token to v1.1.0, re-verification is designed so an active valid token is not discarded before a validated replacement is available.

## Activation After an Update

A normal update should not require uninstalling the extension.

If the same extension is updated in place and browser storage remains intact, the token and local state are usually preserved.

If you uninstall, install a build with a different identity, or clear browser storage, the browser may treat it as a new installation and activation may be required again.

## Activation and Supporter Pass

Supporter Pass is not required for BMP Terbuka's core features.

Each Supporter payment adds a target activation bonus of **+14 days**, capped at a maximum target activation period of **60 days**.

In v1.1.0, Supporter state can be synchronized through supported token/refresh behavior. A token already stored on a device does not necessarily change at the exact moment of payment; the updated entitlement is applied when refresh or the next token issuance succeeds.

See [Supporter Pass](supporter) for package and payment rules.

## If Activation Fails

### Expired Code

Pairing codes are temporary.

If the code is too old or reported as expired, start again from the extension popup to create a new pairing session.

### Telegram Does Not Open

Copy the code from the popup if that option is available, then open the bot manually.

Official bot:

https://t.me/bukabmp_bot

### Joined but Still Not Detected

Make sure you joined with the same Telegram account being used for verification.

After joining, return to the bot and repeat the available check. If it still fails, do not repeatedly leave and rejoin the group; request support and explain which step failed.

### Bot Says Success but the Extension Is Still Inactive

Try:

1. return to the browser;
2. reopen the popup;
3. confirm the internet connection is available;
4. allow the pairing check to finish;
5. if the status still does not change, report the problem.

### Extension Keeps Asking for Verification

This does not mean you need to reinstall.

Complete re-verification from the popup. If it repeatedly happens within a short period, report the extension version, browser, platform, and a screenshot of the message.

## Do Not Send Sensitive Data

For activation support, do not send:

- passwords;
- OTPs;
- cookies;
- sessions;
- activation tokens;
- pairing secrets;
- other credentials;
- student IDs unless they are genuinely required.

The bot or an admin does not need your reader credentials to troubleshoot BMP Terbuka activation.

## Still Having Trouble?

See [Troubleshooting](troubleshooting) or use the support paths in [Bot & Community](bot).
