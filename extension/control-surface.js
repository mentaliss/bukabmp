/* The shared popup/side-panel client starts fail-closed, before popup.js. */
(() => {
  const params = new URL(location.href).searchParams;
  const surface = location.href.includes("/launcher.html") ? "launcher" : params.get("surface") === "sidepanel" ? "sidepanel" : "popup";
  let targetBrowserWindowId = null;
  let switching = false;
  const android = /Android/i.test(navigator.userAgent || "") ||
    !chrome.runtime.getManifest().permissions?.includes("sidePanel") ||
    typeof chrome.sidePanel?.open !== "function";
  let port = null;
  let lease = null;
  let windowId;
  let connectionGeneration=0;
  let revokeGeneration=0;
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  const button = document.getElementById("alternatePopup");
  const notice = document.getElementById("controlSurfaceNotice");
  const lock = () => { document.body.inert = true; lease = null; };
  const post = message => { try { port?.postMessage(message); } catch (_) { lock(); } };
  lock();
  if (surface === "sidepanel") document.documentElement.style.width = "100%";

  async function connect() {
    try {
      const current = await chrome.windows.getCurrent();
      windowId = current.id;
      if (surface === "launcher") {
        const normals = await chrome.windows.getAll({windowTypes:["normal"]});
        const preferred = Number(params.get("browserWindowId"));
        targetBrowserWindowId = (normals.find(win => win.focused) || normals.find(win => win.id === preferred) || normals[0])?.id ?? null;
      } else targetBrowserWindowId = windowId;
      const generation=++connectionGeneration;
      const connection=chrome.runtime.connect({name:"bmp-control-surface-v1"});
      port=connection;
      connection.onMessage.addListener(message => {
        if(generation!==connectionGeneration)return;
        if (message?.type === "revoke") {
          const revocation=++revokeGeneration;
          lock(); // Synchronous inert BEFORE acknowledgement.
          const acknowledge = () => {
            if(generation!==connectionGeneration || revocation!==revokeGeneration || port!==connection)return;
            // Local file operations belong to the existing UI lifecycle. Do not
            // close their document or grant another UI while they are in flight.
            if (globalThis.BMP_CONTROL_SURFACE?.handoffBlocked?.()) {
              setTimeout(acknowledge, 100);
              return;
            }
            try{connection.postMessage({type:"ack", lease:message.lease});}catch(_){return;}
            if (surface === "popup") window.close();
          };
          acknowledge();
        } else if (message?.type === "transitionError") {
          switching = false;
          if (notice.dataset) notice.dataset.transitionError = "true";
          notice.textContent = message.message;
        } else if (message?.type === "blocked") {
          lock();
          notice.textContent = message.message;
          // A surviving local-operation document retries after its authoritative
          // busy claim clears; no focus change is needed to unlock the UI.
          setTimeout(() => {
            if (generation === connectionGeneration && lease === null && document.visibilityState !== "hidden") post({type:"activate"});
          }, 1000);
        } else if (message?.type === "grant") {
          ++revokeGeneration;
          lease = message.lease;
          switching = false;
          document.body.inert = false;
          // A failed handoff notice survives the rollback grant for visibility.
          if (!notice.dataset?.transitionError) notice.textContent = "";
          readyResolve();
        }
      });
      connection.onDisconnect.addListener(() => {
        if(generation!==connectionGeneration)return;
        ++connectionGeneration;
        ++revokeGeneration;
        lock();
        notice.textContent = "Kontrol terputus. Buka kembali BMP Terbuka; proses yang berjalan tidak dibatalkan.";
        // MV3 worker restarts: reconnect fail-closed, never reuse the old lease.
        setTimeout(connect, 250);
      });
      post({type:"hello", surface, windowId, visible:document.visibilityState !== "hidden"});
    } catch (_) {
      notice.textContent = "Kontrol belum tersambung. Buka kembali BMP Terbuka.";
      setTimeout(connect, 500);
    }
  }

  if (android) {
    // Packaged Android retains the pre-existing popup and does not use leases.
    document.body.inert = false;
    readyResolve();
  } else {
    // Rendering must not wait for a coordinator grant: a visible surface always
    // renders its status. The lease only gates interaction (body.inert).
    readyResolve();
    connect();
    window.addEventListener("focus", () => post({type:"activate"}));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") { lock(); post({type:"hidden"}); }
      else post({type:"activate"});
    });
  }

  if (!android) {
    button.hidden = false;
    button.title = surface === "sidepanel" ? "Kecilkan" : "Buka Side Panel";
    button.setAttribute?.("aria-label", button.title);
    // Preserve the header's icon markup. Legacy toolbar popup remains supported.
    if (surface === "popup") button.textContent = "Buka Side Panel";
    button.addEventListener("click", () => {
      if (lease === null || switching) return;
      if (globalThis.BMP_CONTROL_SURFACE?.handoffBlocked?.()) {
        notice.textContent = "Tunggu operasi data lokal selesai sebelum berpindah tampilan.";
        return;
      }
      if (notice.dataset) delete notice.dataset.transitionError;
      notice.textContent = "";
      if (surface === "sidepanel") {
        switching = true;
        post({type:"minimize", lease});
        return;
      }
      if (targetBrowserWindowId === null) {
        notice.textContent = "Buka jendela browser biasa terlebih dahulu.";
        return;
      }
      switching = true;
      try {
        // No await, lookup or runtime message before this gesture-sensitive API.
        const opening = chrome.sidePanel.open({windowId:targetBrowserWindowId});
        Promise.resolve(opening).then(async () => {
          if (surface === "launcher") {
            // Opening the panel does not promise to focus its normal window.
            try { await chrome.windows.update(targetBrowserWindowId, {focused:true}); } catch (_) {}
            post({type:"panelOpened"});
          }
        }).catch(() => {
          switching = false;
          notice.textContent = "Side Panel tidak dapat dibuka oleh browser ini.";
        });
      } catch (_) {
        switching = false;
        notice.textContent = "Side Panel tidak dapat dibuka oleh browser ini.";
      }
    });
  }
  globalThis.BMP_CONTROL_SURFACE = {ready, get active() { return android || lease !== null; }};
})();