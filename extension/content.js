(() => {
  if (window.__BMP_TERBUKA__) return;
  window.__BMP_TERBUKA__ = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function passwordVisible() {
    const elems = [...document.querySelectorAll('input[type="password"]')];
    return elems.some(el => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" &&
             s.visibility !== "hidden" &&
             r.width > 0 &&
             r.height > 0;
    });
  }

  function bodyText() {
    return (document.body?.innerText || "").toLowerCase();
  }

  function pageRejected() {
    const t = bodyText();
    return t.includes("request rejected") ||
           t.includes("403 akses ditolak") ||
           t.includes("support id");
  }

  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  async function fetchPage(code, moduleNo, pageNo) {
    const url =
      `/reader/services/view.php?doc=M${moduleNo}` +
      `&format=jpg&subfolder=${encodeURIComponent(code)}/&page=${pageNo}`;

    let resp;
    try {
      resp = await fetch(url, {
        method: "GET",
        credentials: "include",
        redirect: "follow",
        cache: "no-store"
      });
    } catch (e) {
      return {kind: "network_error", reason: String(e)};
    }

    const contentType = (resp.headers.get("content-type") || "").toLowerCase();

    if (resp.status === 403 || resp.status === 429) {
      return {
        kind: "blocked",
        status: resp.status,
        reason: `HTTP ${resp.status}`
      };
    }

    if (!contentType.startsWith("image/")) {
      let text = "";
      try {
        text = (await resp.text()).toLowerCase();
      } catch (_) {}

      if (text.includes("request rejected") ||
          text.includes("support id") ||
          text.includes("403 akses ditolak") ||
          text.includes("akses ditolak")) {
        return {
          kind: "blocked",
          status: resp.status,
          reason: "Request Rejected / response blokir"
        };
      }

      if (text.includes("password") &&
          (text.includes("username") ||
           text.includes("single sign-on") ||
           text.includes("login"))) {
        return {
          kind: "login_required",
          status: resp.status,
          reason: "Response login"
        };
      }

      return {
        kind: "not_image",
        status: resp.status,
        contentType
      };
    }

    if (!resp.ok) {
      return {
        kind: "not_image",
        status: resp.status,
        contentType
      };
    }

    const blob = await resp.blob();
    if (blob.size < 300) {
      return {
        kind: "not_image",
        status: resp.status,
        contentType,
        reason: "Image terlalu kecil"
      };
    }

    return {
      kind: "image",
      status: resp.status,
      contentType,
      size: blob.size,
      dataUrl: await blobToDataUrl(blob)
    };
  }

  async function runModule(cfg) {
    const {code, module, delayMs, maxPages} = cfg;

    if (pageRejected()) {
      await chrome.runtime.sendMessage({
        type: "MODULE_RESULT",
        module,
        result: "blocked",
        page: 0,
        reason: "Halaman viewer sudah Request Rejected"
      });
      return;
    }

    if (passwordVisible()) {
      await chrome.runtime.sendMessage({
        type: "MODULE_RESULT",
        module,
        result: "login_required"
      });
      return;
    }

    let downloaded = 0;

    for (let page = 1; page <= maxPages; page++) {
      await chrome.runtime.sendMessage({
        type: "PAGE_PROGRESS",
        module,
        page
      });

      const r = await fetchPage(code, module, page);

      if (r.kind === "blocked") {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          module,
          result: "blocked",
          page,
          reason: r.reason || `HTTP ${r.status}`
        });
        return;
      }

      if (r.kind === "login_required") {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          module,
          result: "login_required",
          page
        });
        return;
      }

      if (r.kind === "network_error") {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          module,
          result: "error",
          page,
          reason: r.reason
        });
        return;
      }

      if (r.kind !== "image") {
        if (page === 1 && downloaded === 0) {
          await chrome.runtime.sendMessage({
            type: "MODULE_RESULT",
            module,
            result: "missing_module",
            page: 1,
            reason:
              `Page 1 bukan image (HTTP ${r.status}, ` +
              `${r.contentType || "no content-type"})`
          });
          return;
        }

        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          module,
          result: "complete",
          pages: downloaded
        });
        return;
      }

      // OCR is intentionally awaited page-by-page:
      // no giant in-memory queue, no request burst to BMP.
      const ocr = await chrome.runtime.sendMessage({
        type: "OCR_PAGE",
        module,
        page,
        dataUrl: r.dataUrl
      });

      if (!ocr?.ok) {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          module,
          result: "error",
          page,
          reason: ocr?.error || "OCR page gagal"
        });
        return;
      }

      downloaded++;
      await sleep(Math.max(700, delayMs));
    }

    await chrome.runtime.sendMessage({
      type: "MODULE_RESULT",
      module,
      result: "error",
      page: maxPages,
      reason:
        `Mencapai maxPages=${maxPages}; modul tidak dianggap selesai.`
    });
  }

  let activeRunKey = "";

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "START_MODULE") {
      const runKey = `${String(msg.code || "")}:M${Number(msg.module || 0)}`;
      if (activeRunKey === runKey) {
        sendResponse({ok: true, alreadyRunning: true});
        return;
      }

      activeRunKey = runKey;
      sendResponse({ok: true});
      runModule(msg)
        .catch(async e => {
          try {
            await chrome.runtime.sendMessage({
              type: "MODULE_RESULT",
              module: msg.module,
              result: "error",
              reason: String(e)
            });
          } catch (_) {}
        })
        .finally(() => {
          if (activeRunKey === runKey) activeRunKey = "";
        });
    }
  });
})();
