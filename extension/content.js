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

      // Ignore generic fractions outside an actual page/viewer control.
      // A false low total would silently truncate a module.
      if (!/page|halaman|viewer|toolbar|pager/i.test(context)) continue;
      let score = 105;
      if (current === 1) score += 5;
      addCandidate(total, score, "visible-page-counter");
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  async function detectTotalPagesWithRetry(maxPages) {
    let previousPages = null;
    let stableReads = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const found = detectTotalPages(maxPages);
      if (found) {
        if (found.pages === previousPages) {
          stableReads++;
          if (stableReads >= 2) return found;
        } else {
          previousPages = found.pages;
          stableReads = 0;
        }
      } else {
        previousPages = null;
        stableReads = 0;
      }
      await sleep(250);
    }
    // No stable count: use safe sentinel probing instead of trusting a
    // transient toolbar value such as an initial "1 / 1".
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

  let activeRunId = "";

  async function runModule(cfg) {
    const {runId, code, module, delayMs, maxPages} = cfg;
    const stillActive = () => Boolean(runId) && activeRunId === runId;
    if (!stillActive()) return;

    if (pageRejected()) {
      await chrome.runtime.sendMessage({
        type: "MODULE_RESULT",
        runId,
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
        runId,
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
      if (!stillActive()) return;
      await chrome.runtime.sendMessage({
        type: "PAGE_PROGRESS",
        runId,
        module,
        page,
        totalPages
      });

      const r = await fetchPage(code, module, page);
      if (!stillActive()) return;

      if (r.kind === "blocked") {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          runId,
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
          runId,
          module,
          result: "login_required",
          page
        });
        return;
      }

      if (r.kind === "network_error") {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          runId,
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
            runId,
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
            runId,
            module,
            result: "missing_module",
            page: 1,
            reason:
              `Page 1 bukan image (HTTP ${r.status}, ` +
              `${r.contentType || "no content-type"})`
          });
          return;
        }

        // With no trusted page count, one missing/non-image response is not
        // enough to declare end-of-module: a single missing page in the middle
        // would silently produce a truncated PDF. Confirm the sentinel with the
        // following page. Known page-count modules never need this extra probe.
        const nextProbe = await fetchPage(code, module, page + 1);
        if (!stillActive()) return;

        if (nextProbe.kind === "blocked") {
          await chrome.runtime.sendMessage({
            type: "MODULE_RESULT",
            runId,
            module,
            result: "blocked",
            page: page + 1,
            reason: nextProbe.reason || `HTTP ${nextProbe.status}`
          });
          return;
        }
        if (nextProbe.kind === "login_required") {
          await chrome.runtime.sendMessage({
            type: "MODULE_RESULT",
            runId,
            module,
            result: "login_required",
            page: page + 1
          });
          return;
        }
        if (nextProbe.kind === "network_error") {
          await chrome.runtime.sendMessage({
            type: "MODULE_RESULT",
            runId,
            module,
            result: "error",
            page: page + 1,
            reason: nextProbe.reason
          });
          return;
        }
        if (nextProbe.kind === "image") {
          await chrome.runtime.sendMessage({
            type: "MODULE_RESULT",
            runId,
            module,
            result: "error",
            page,
            reason:
              `Halaman ${page} tidak tersedia tetapi halaman ${page + 1} masih ada. ` +
              "Modul tidak disimpan agar PDF tidak terpotong."
          });
          return;
        }

        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          runId,
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
        runId,
        module,
        page,
        dataUrl: r.dataUrl
      });

      if (!ocr?.ok) {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          runId,
          module,
          result: "error",
          page,
          reason: ocr?.error || "OCR page gagal"
        });
        return;
      }

      if (!stillActive()) return;
      downloaded++;

      if (totalPages && page === pageLimit) {
        await chrome.runtime.sendMessage({
          type: "MODULE_RESULT",
          runId,
          module,
          result: "complete",
          pages: downloaded,
          totalPages
        });
        return;
      }

      await sleep(Math.max(700, delayMs));
    }

    if (!stillActive()) return;
    await chrome.runtime.sendMessage({
      type: "MODULE_RESULT",
      runId,
      module,
      result: "error",
      page: maxPages,
      reason:
        `Mencapai maxPages=${maxPages}; modul tidak dianggap selesai.`
    });
  }

  let activeRunKey = "";

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "STOP_MODULE") {
      const runId = String(msg.runId || "");
      if (!runId || activeRunId === runId) {
        activeRunId = "";
        activeRunKey = "";
      }
      sendResponse({ok: true});
      return;
    }

    if (msg.type === "START_MODULE") {
      const runId = String(msg.runId || "");
      if (!runId) {
        sendResponse({ok: false, error: "runId proses tidak tersedia."});
        return;
      }
      const runKey = `${runId}:${String(msg.code || "")}:M${Number(msg.module || 0)}`;
      if (activeRunKey === runKey && activeRunId === runId) {
        sendResponse({ok: true, alreadyRunning: true});
        return;
      }

      // A newer generation supersedes any unfinished module loop from an
      // earlier STOP/restart. Old messages carry the old runId and are ignored
      // by the background/offscreen layers as a second line of defense.
      activeRunId = runId;
      activeRunKey = runKey;
      sendResponse({ok: true});
      runModule(msg)
        .catch(async e => {
          if (activeRunId !== runId) return;
          try {
            await chrome.runtime.sendMessage({
              type: "MODULE_RESULT",
              runId,
              module: msg.module,
              result: "error",
              reason: String(e)
            });
          } catch (_) {}
        })
        .finally(() => {
          if (activeRunKey === runKey && activeRunId === runId) {
            activeRunKey = "";
            activeRunId = "";
          }
        });
    }
  });
})();
