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

  function positivePageCount(value, maxPages) {
    const n = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > maxPages) return null;
    return n;
  }

  function detectTotalPages(maxPages) {
    const candidates = [];
    const seen = new Set();

    const addCandidate = (value, score, source) => {
      const n = positivePageCount(value, maxPages);
      if (!n) return;
      const key = `${n}:${score}:${source}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({pages: n, score, source});
    };

    // Prefer explicit page-count metadata / PDF-style counters when present.
    const attrSelectors = [
      "[data-total-pages]",
      "[data-page-count]",
      "[data-pages]"
    ];
    for (const el of document.querySelectorAll(attrSelectors.join(","))) {
      for (const attr of ["data-total-pages", "data-page-count", "data-pages"]) {
        if (el.hasAttribute(attr)) addCandidate(el.getAttribute(attr), 120, attr);
      }
    }

    const strongSelectors = [
      "#numPages",
      "[id*='numPages' i]",
      "[class*='numPages' i]",
      "[id*='pageCount' i]",
      "[class*='pageCount' i]",
      "[id*='totalPage' i]",
      "[class*='totalPage' i]"
    ];
    for (const el of document.querySelectorAll(strongSelectors.join(","))) {
      const nums = String(el.textContent || "").match(/\d{1,4}/g) || [];
      if (nums.length) addCandidate(nums[nums.length - 1], 115, "page-count-element");
    }

    for (const el of document.querySelectorAll(
      "input[id*='page' i][max], input[name*='page' i][max]"
    )) {
      addCandidate(el.getAttribute("max"), 110, "page-input-max");
    }

    // RBV's reader exposes a toolbar counter like "1 / 63".
    // Scan short element labels only, and give extra weight to page/viewer context.
    for (const el of document.querySelectorAll("body *")) {
      const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 40) continue;

      let m = text.match(/^(\d{1,4})\s*\/\s*(\d{1,4})$/);
      if (!m) {
        m = text.match(/^(?:page|halaman)\s*(\d{1,4})\s*(?:of|dari|\/)\s*(\d{1,4})$/i);
      }
      if (!m) continue;

      const current = Number.parseInt(m[1], 10);
      const total = Number.parseInt(m[2], 10);
      if (!Number.isInteger(current) || current < 1 || current > total) continue;

      let context = "";
      let node = el;
      for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
        context += " " + [
          node.id || "",
          typeof node.className === "string" ? node.className : "",
          node.getAttribute?.("aria-label") || ""
        ].join(" ");
      }

      let score = 90;
      if (/page|halaman|viewer|toolbar|pager/i.test(context)) score += 15;
      if (current === 1) score += 5;
      addCandidate(total, score, "visible-page-counter");
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  async function detectTotalPagesWithRetry(maxPages) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const found = detectTotalPages(maxPages);
      if (found) return found;
      await sleep(250);
    }
    return null;
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

    if (resp.status === 401) {
      return {
        kind: "login_required",
        status: resp.status,
        reason: "HTTP 401"
      };
    }

    if (resp.status >= 500 || (resp.status >= 400 && resp.status !== 404)) {
      return {
        kind: "network_error",
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
    const detected = await detectTotalPagesWithRetry(maxPages);
    const totalPages = detected?.pages || null;
    const pageLimit = totalPages || maxPages;

    for (let page = 1; page <= pageLimit; page++) {
      await chrome.runtime.sendMessage({
        type: "PAGE_PROGRESS",
        module,
        page,
        totalPages
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
        if (totalPages) {
          await chrome.runtime.sendMessage({
            type: "MODULE_RESULT",
            module,
            result: "error",
            page,
            reason:
              `Halaman ${page}/${totalPages} tidak menghasilkan image ` +
              `(HTTP ${r.status || 0}, ${r.contentType || "no content-type"}). ` +
              "Modul tidak disimpan agar PDF tidak terpotong."
          });
          return;
        }

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

      if (totalPages && page === pageLimit) {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          module,
          result: "complete",
          pages: downloaded,
          totalPages
        });
        return;
      }

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
