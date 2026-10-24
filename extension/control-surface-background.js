/* UI ownership only. No job state or cancellation belongs in this coordinator. */
(() => {
  const PORT = "bmp-control-surface-v1";
  const desktop = !/Android/i.test(globalThis.navigator?.userAgent || "") &&
    chrome.runtime.getManifest().permissions?.includes("sidePanel") &&
    typeof chrome.sidePanel?.open === "function";
  let transitionIntent = 0;
  let launcherWindowId = null;
  const launcherURL = chrome.runtime.getURL("launcher.html");
  async function launchers() {
    if (!chrome.windows.getAll) return [];
    const windows = await chrome.windows.getAll({populate:true, windowTypes:["popup"]});
    return windows.filter(win => win.tabs?.some(tab => tab.url?.split(/[?#]/)[0] === launcherURL));
  }
  async function removeLaunchers() {
    for (const win of await launchers()) await chrome.windows.remove(win.id);
    launcherWindowId = null;
  }
  async function localBusy() {
    // Uses the active background's document-aware guard, including worker restarts.
    return typeof uiLocalOperationBusy === "function" ? await uiLocalOperationBusy() : false;
  }
  async function closePanels(except) {
    if (await localBusy()) throw new Error("Tunggu operasi data lokal selesai sebelum berpindah tampilan.");
    if (chrome.windows.getAll && (except === undefined || typeof chrome.sidePanel.close === "function")) {
      for (const win of await chrome.windows.getAll({windowTypes:["normal"]})) panelWindows.add(win.id);
    } else if (except !== undefined && chrome.runtime.getContexts) {
      for (const context of await chrome.runtime.getContexts({contextTypes:["SIDE_PANEL"]})) {
        if (Number.isInteger(context.windowId)) panelWindows.add(context.windowId);
      }
    }
    if (except !== undefined && typeof chrome.sidePanel.close !== "function" && [...panelWindows].some(id => id !== except)) {
      throw new Error("Tutup Side Panel di jendela lain terlebih dahulu; browser ini belum mendukung penutupan per jendela.");
    }
    for (const id of panelWindows) if (id !== except) await closePanel(id, except === undefined);
    panelWindows.clear();
    if (except !== undefined) panelWindows.add(except);
  }
  async function minimize(client, lease, intent) {
    if (!desktop || !client.connected || owner !== client || client.lease !== lease || client.surface !== "sidepanel") return;
    try {
      if (await localBusy()) throw new Error("Tunggu operasi data lokal selesai sebelum berpindah tampilan.");
      const existing = await launchers();
      if (intent !== transitionIntent) return;
      await revoke();
      if (intent !== transitionIntent) { if (client.connected) await acquire(client); return; }
      await closePanels(); // Physically close BEFORE creating the standalone window.
      if (intent !== transitionIntent) return;
      if (existing.length) {
        for (const duplicate of existing.slice(1)) await chrome.windows.remove(duplicate.id);
        launcherWindowId = existing[0].id;
        await chrome.windows.update(launcherWindowId, {focused:true});
      } else {
        const win = await chrome.windows.create({type:"popup", url:launcherURL+"?browserWindowId="+client.windowId,
          width:320, height:210, focused:true});
        launcherWindowId = win.id;
      }
    } catch (error) {
      post(client, {type:"transitionError", message:String(error.message || error)});
      if (client.connected) await acquire(client);
    }
  }
  let owner = null;
  let sequence = 0;
  let focusedWindowId = null;
  let queue = Promise.resolve();
  const clients = new Set();
  // Keep physical panel evidence even after its document disconnects.
  const panelWindows = new Set();
  let popupResetTimer;
  let popupTransaction = null;
  const resetPopup = transaction => {
    if (!desktop) return Promise.resolve();
    if (transaction && popupTransaction !== transaction) return Promise.resolve();
    if (!transaction && popupTransaction) return Promise.resolve();
    if(transaction){clearTimeout(popupResetTimer);popupTransaction=null;}
    return chrome.action.setPopup({popup:""});
  };
  const enqueue = task => { queue = queue.then(task).catch(() => {}); };
  const post = (client, message) => {
    if (!client.connected) return false;
    try { client.port.postMessage(message); return true; } catch (_) { return false; }
  };

  async function closePanel(windowId, allowGlobalFallback = true) {
    if (!desktop) return;
    if (typeof chrome.sidePanel.close === "function") {
      try { await chrome.sidePanel.close({windowId}); return; }
      catch (error) { if (!allowGlobalFallback) throw error; }
    }
    if (!allowGlobalFallback) throw new Error("Tutup Side Panel di jendela lain terlebih dahulu.");
    // Older Chromium has no close(). Disabling closes the panel; always restore
    // availability, even if the browser rejects the close operation.
    if (typeof chrome.sidePanel.setOptions === "function") {
      try { await chrome.sidePanel.setOptions({enabled:false}); }
      finally { await chrome.sidePanel.setOptions({enabled:true, path:"popup.html?surface=sidepanel"}); }
    } else throw new Error("Browser tidak dapat menutup Side Panel dengan aman.");
  }

  async function revoke() {
    const previous = owner;
    if (!previous) return null;
    // Never grant on timeout: an unresponsive old document must not overlap.
    await new Promise(resolve => {
      previous.ack = resolve;
      if (!post(previous, {type:"revoke", lease:previous.lease})) resolve();
    });
    previous.ack = null;
    if (owner === previous) owner = null;
    return previous;
  }

  async function acquire(client) {
    if (!client.connected || !client.visible || !client.initialized) return;
    if (typeof chrome.windows?.get === "function") {
      try {
        // Authoritative focus state corrects the onFocusChanged hint, which can
        // lag behind a just-opened Side Panel and otherwise leave it inert.
        if ((await chrome.windows.get(client.windowId)).focused) focusedWindowId = client.windowId;
        else return;
      } catch (_) { return; }
    } else if (focusedWindowId !== null && client.windowId !== focusedWindowId) {
      return;
    }
    if (owner === client) { post(client, {type:"grant", lease:client.lease}); return; }
    if (desktop && client.surface !== "launcher" && await localBusy()) {
      post(client, {type:"blocked", message:"Tunggu operasi data lokal selesai sebelum berpindah tampilan."});
      return;
    }
    await revoke();
    if (desktop && client.surface === "sidepanel") {
      try { await removeLaunchers(); await closePanels(client.windowId); }
      catch (error) { post(client, {type:"blocked", message:String(error.message || error)}); return; }
    }
    if (!client.connected || !client.visible ||
      (focusedWindowId !== null && client.windowId !== focusedWindowId)) return;
    if (desktop && client.surface === "launcher") {
      try {
        if (await localBusy()) throw new Error("Operasi data lokal masih berjalan.");
        await closePanels();
        const current = await launchers();
        for (const win of current) if (win.id !== client.windowId) await chrome.windows.remove(win.id);
        launcherWindowId = client.windowId;
      } catch (error) { post(client, {type:"blocked", message:String(error.message || error)}); return; }
    }
    if (desktop && client.surface === "popup") {
      try {
        // Include current window even when owner vanished or worker restarted.
        panelWindows.add(client.windowId);
        if (typeof chrome.windows?.getAll === "function") {
          for (const win of await chrome.windows.getAll({windowTypes:["normal"]})) panelWindows.add(win.id);
        }
        for (const windowId of panelWindows) await closePanel(windowId);
        panelWindows.clear();
      } catch (_) {
        post(client, {type:"blocked", message:"Side Panel belum dapat ditutup dengan aman. Tutup popup dan gunakan Side Panel."});
        return; // Never grant while physical panel closure failed.
      }
    }
    if (!client.connected || !client.visible ||
      (focusedWindowId !== null && client.windowId !== focusedWindowId)) return;
    if (typeof chrome.windows?.get === "function") {
      try { if (!(await chrome.windows.get(client.windowId)).focused) return; } catch (_) { return; }
    }
    if (!client.connected || !client.visible ||
      (focusedWindowId !== null && client.windowId !== focusedWindowId)) return;
    client.lease = ++sequence;
    owner = client;
    if (!post(client, {type:"grant", lease:client.lease})) owner = null;
  }

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT) return;
    // A content script must not be able to take ownership of extension UI.
    const senderURL = port.sender?.url?.split(/[?#]/)[0];
    if ((port.sender?.tab && senderURL !== launcherURL) || ![chrome.runtime.getURL("popup.html"), launcherURL].includes(senderURL)) return;
    const client = {port, connected:true, initialized:false, visible:true};
    clients.add(client);
    port.onMessage.addListener(message => {
      if (message?.type === "ack" && message.lease === client.lease) {
        client.ack?.();
      } else if (message?.type === "hello" && !client.initialized) {
        if (!["popup", "sidepanel", "launcher"].includes(message.surface) || !Number.isInteger(message.windowId)) return;
        if ((message.surface === "launcher") !== (senderURL === launcherURL)) return;
        client.initialized = true;
        client.surface = message.surface;
        client.windowId = message.windowId;
        client.visible = message.visible !== false;
        if (client.surface === "sidepanel") { panelWindows.add(client.windowId); ++transitionIntent; }
        if (client.surface === "popup" && (!popupTransaction || popupTransaction.client.windowId===client.windowId)) {
          resetPopup(popupTransaction || undefined).catch(() => {});
        }
        enqueue(() => acquire(client));
      } else if (message?.type === "minimize" && desktop && client.initialized) {
        const intent = transitionIntent;
        enqueue(() => minimize(client, message.lease, intent));
      } else if (message?.type === "panelOpened" && desktop && client.surface === "launcher") {
        enqueue(async () => {
          if (owner === client) await revoke();
          await removeLaunchers();
        });
      } else if (message?.type === "temporaryPopup" && desktop && client.initialized) {
        // The worker survives the initiating panel being destroyed by close().
        const transaction={client,token:message.token};
        popupTransaction=transaction;
        clearTimeout(popupResetTimer);
        popupResetTimer = setTimeout(() => resetPopup(transaction).catch(() => {}), 5000);
      } else if (message?.type === "resetPopup" && desktop) {
        if(popupTransaction?.client===client && popupTransaction.token===message.token)resetPopup(popupTransaction).catch(() => {});
      } else if (message?.type === "activate" && client.initialized) {
        client.visible = true;
        enqueue(() => acquire(client));
      } else if (message?.type === "hidden") {
        client.visible = false;
        enqueue(async () => { if (owner === client) await revoke(); });
      }
    });
    port.onDisconnect.addListener(() => {
      client.connected = false;
      if (desktop && popupTransaction?.client===client) resetPopup(popupTransaction).catch(() => {});
      client.ack?.();
      clients.delete(client);
      if (owner === client) owner = null;
      // Disconnect releases UI ownership, never STOP_JOB or any pipeline action.
    });
  });

  chrome.windows?.onFocusChanged?.addListener(windowId => {
    focusedWindowId = windowId;
    enqueue(async () => {
      if (owner && owner.windowId !== windowId) await revoke();
      const candidate = [...clients].reverse().find(c =>
        c.initialized && c.visible && c.windowId === windowId);
      if (candidate) await acquire(candidate);
    });
  });

  if (!desktop) return; // Android / unsupported browsers keep the original popup.
  const configure = async () => {
    await resetPopup();
    if (typeof chrome.sidePanel.setPanelBehavior === "function") {
      try { await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}); } catch (_) {}
    }
  };
  // Register synchronously: open() must remain inside the action user gesture.
  chrome.action.onClicked.addListener(tab => {
    ++transitionIntent;
    panelWindows.add(tab.windowId);
    try { Promise.resolve(chrome.sidePanel.open({windowId:tab.windowId})).then(() => enqueue(async () => {
      if (await localBusy()) return;
      if (owner?.surface === "launcher") await revoke();
      await removeLaunchers();
    })).catch(() => {}); } catch (_) {}
  });
  // Browser-managed toolbar opening may bypass action.onClicked entirely.
  chrome.sidePanel.onOpened?.addListener(info => {
    ++transitionIntent;
    if (Number.isInteger(info.windowId)) panelWindows.add(info.windowId);
    enqueue(async () => {
      if (await localBusy()) return;
      if (owner?.surface === "launcher") await revoke();
      await removeLaunchers();
    });
  });
  configure().catch(() => {});
  chrome.runtime.onInstalled?.addListener(() => configure().catch(() => {}));
  chrome.runtime.onStartup?.addListener(() => configure().catch(() => {}));
})();