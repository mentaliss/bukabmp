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
    if (!/^[1-9]\d*$/.test(String(value ?? "").trim())) return null;
    const n = Number(String(value).trim());
    if (!Number.isInteger(n) || n < 1 || n > maxPages) return null;
    return n;
  }

  function detectTotalPages(maxPages, strict = false) {
    const candidates = [];
    const seen = new Set();

    const addCandidate = (value, score, source) => {
      const n = positivePageCount(value, strict ? Number.MAX_SAFE_INTEGER : maxPages);
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

    if (strict && (new Set(candidates.map(c => c.pages)).size > 1 || candidates.some(c => c.pages > maxPages))) {
      throw new Error("Jumlah halaman reader bertentangan atau melebihi batas; modul tidak disimpan.");
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
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

  function renderedPageAssociation(el) {
    const candidates = new Set();
    for (let node = el, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
      for (const attr of ["data-page-number", "data-page", "data-pagenum"]) {
        const value = node.getAttribute?.(attr);
        if (/^[1-9]\d{0,2}$/.test(value || "")) candidates.add(Number(value));
      }
      const match = String(node.id || "").match(/^(?:page|pagecontainer|pagecanvas|canvaspage)[_-]?(\d+)$/i);
      if (match && Number(match[1]) > 0) candidates.add(Number(match[1]));
    }
    if (el.tagName === "IMG") {
      try {
        const u = new URL(el.currentSrc || el.src, location.href);
        if (u.origin === new URL(location.href).origin && u.pathname === "/reader/services/view.php") {
          const page = u.searchParams.get("page");
          if (/^[1-9]\d{0,2}$/.test(page || "")) candidates.add(Number(page));
        }
      } catch (_) {}
    }
    return {page: candidates.size === 1 ? [...candidates][0] : null,
      mapping: candidates.size === 1 ? "DOM_OR_RENDERED_IMAGE" : candidates.size ? "CONFLICT" : "UNKNOWN"};
  }
  // Load each official page through browser IMG, never fetch/XHR.
  async function loadBrowserPageImage(cfg, page, stillActive) {
    verifyRenderedDocument(cfg);
    const image = document.createElement("img");
    image.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;pointer-events:none";
    image.alt = "";
    const url = `/reader/services/view.php?doc=M${cfg.module}&format=jpg&subfolder=${encodeURIComponent(cfg.code + "/")}&page=${page}`;
    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearInterval(cancelTimer);
          image.onload = image.onerror = null;
          if (error) reject(error); else resolve();
        };
        const timer = setTimeout(() => finish(new Error(`Pemuatan gambar halaman ${page} melewati batas waktu.`)), 20000);
        const cancelTimer = setInterval(() => {
          if (!stillActive()) finish(new Error("Pemrosesan dibatalkan."));
        }, 100);
        image.onload = () => finish();
        image.onerror = () => finish(new Error(`Reader tidak memuat gambar halaman ${page}; tidak ada retry fetch/XHR.`));
        try {
          document.body.append(image);
          image.src = url;
        } catch (_) {
          finish(new Error("Pemasangan gambar reader gagal."));
        }
      });
      if (!stillActive()) throw new Error("Pemrosesan dibatalkan.");
      verifyRenderedDocument(cfg, image);
      if (renderedPageAssociation(image).page !== page || !image.complete ||
          image.naturalWidth < 600 || image.naturalHeight < 600 ||
          image.naturalWidth * image.naturalHeight > 16000000) {
        throw new Error(`Gambar halaman ${page} salah atau masih placeholder.`);
      }
      return image;
    } catch (error) {
      image.remove();
      throw error;
    }
  }

  function verifyRenderedDocument(cfg, image = null) {
    const expectedFolder = `${String(cfg.code || "").toUpperCase()}/`;
    for (const value of [location.href, ...(image ? [image.currentSrc || image.src] : [])]) {
      const url = new URL(value, location.href);
      const doc = url.searchParams.get("doc");
      if (url.origin !== "https://pustaka.ut.ac.id" ||
          !["/reader/index.php", "/reader/services/view.php"].includes(url.pathname) ||
          ![`M${cfg.module}`, `M${cfg.module}.pdf`].includes(doc) ||
          url.searchParams.get("subfolder")?.toUpperCase() !== expectedFolder) {
        throw new Error("Identitas modul reader belum sesuai job; proses dihentikan.");
      }
    }
  }

  async function captureRenderedImage(image, page, seen, stillActive) {
    const width = image.naturalWidth, height = image.naturalHeight;
    const source = image.currentSrc || image.src;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    try {
      const ctx = canvas.getContext("2d", {willReadFrequently: true});
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      let uniform = true, transparent = true;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] !== 0) transparent = false;
        if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] ||
            pixels[i + 2] !== pixels[2] || pixels[i + 3] !== pixels[3]) uniform = false;
        if (!uniform && !transparent) break;
      }
      // An intentional blank also needs review, not silent omission.
      if (uniform || transparent) throw new Error(`Halaman ${page} tampak blank; proses dihentikan untuk pemeriksaan.`);
      const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", pixels));
      const hash = `${width}x${height}:` + [...hashBytes].map(n => n.toString(16).padStart(2, "0")).join("");
      if (!stillActive()) return null;
      if (seen.has(hash)) throw new Error(`Halaman ${page} identik dengan halaman ${seen.get(hash)}; proses dihentikan.`);
      const blob = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Ekspor gambar melewati batas waktu.")), 5000);
        canvas.toBlob(value => {
          clearTimeout(timer);
          if (value?.size) resolve(value); else reject(new Error("Ekspor gambar gagal."));
        }, "image/png");
      });
      const dataUrl = await blobToDataUrl(blob);
      if (!stillActive()) return null;
      if (!image.complete || image.naturalWidth !== width || image.naturalHeight !== height ||
          (image.currentSrc || image.src) !== source || renderedPageAssociation(image).page !== page) {
        throw new Error(`Gambar halaman ${page} berubah saat disalin; proses dihentikan.`);
      }
      seen.set(hash, page);
      return dataUrl;
    } catch (e) {
      if (e?.name === "SecurityError") throw new Error("Reader tidak mengizinkan pembacaan piksel gambar.");
      throw e;
    } finally {
      canvas.width = 0; canvas.height = 0;
    }
  }

  let activeRunId = "";

  async function runRenderedModule(cfg) {
    const {runId, module, maxPages, delayMs} = cfg;
    const stillActive = () => Boolean(runId) && activeRunId === runId;
    const seen = new Map();
    // Terminal module outcomes are reported as typed signals so the background
    // can arm the LOGIN_REQUIRED resume context (Batch 3 contract) or stop
    // safely on server rejection; a generic "error" would hide both and kill
    // the auto-resume chain. Clearing the active run lets READER_READY re-arm
    // after re-login.
    let terminated = false;
    async function reportTerminal(result) {
      if (terminated || !stillActive()) return;
      terminated = true;
      activeRunId = "";
      activeRunKey = "";
      await chrome.runtime.sendMessage({type: "MODULE_RESULT", runId, module, result});
    }
    try {
      let totalPages = null, previousTotal = null, stableTotal = 0;
      for (let attempt = 0; attempt < 120 && stillActive(); attempt++) {
        if (passwordVisible()) return reportTerminal("login_required");
        if (pageRejected()) return reportTerminal("blocked");
        verifyRenderedDocument(cfg);
        const detected = detectTotalPages(maxPages, true);
        if (detected?.pages && detected.pages === previousTotal) stableTotal++;
        else { previousTotal = detected?.pages || null; stableTotal = 0; }
        if (stableTotal >= 2) { totalPages = detected.pages; break; }
        await sleep(500);
      }
      if (!stillActive()) return;
      if (!totalPages) throw new Error("Jumlah halaman belum dapat dipastikan; modul tidak disimpan.");
      for (let page = 1; page <= totalPages && stillActive(); page++) {
        await chrome.runtime.sendMessage({type: "PAGE_PROGRESS", runId, module, page, totalPages});
        if (!stillActive()) return;
        if (passwordVisible()) return reportTerminal("login_required");
        if (pageRejected()) return reportTerminal("blocked");
        const image = await loadBrowserPageImage(cfg, page, stillActive);
        if (!stillActive()) { image.remove(); return; }
        let dataUrl;
        try {
          verifyRenderedDocument(cfg, image);
          if (detectTotalPages(maxPages, true)?.pages !== totalPages) throw new Error("Jumlah halaman reader berubah; modul tidak disimpan.");
          dataUrl = await captureRenderedImage(image, page, seen, stillActive);
        }
        finally { image.remove(); }
        if (!stillActive() || !dataUrl) return;
        verifyRenderedDocument(cfg, image);
        if (detectTotalPages(maxPages, true)?.pages !== totalPages) throw new Error("Jumlah halaman reader berubah; modul tidak disimpan.");
        const ocr = await chrome.runtime.sendMessage({type: "OCR_PAGE", runId, module, page, dataUrl});
        if (!stillActive()) return;
        if (!ocr?.ok) throw new Error(ocr?.error || "OCR halaman gagal.");
        verifyRenderedDocument(cfg);
        if (detectTotalPages(maxPages, true)?.pages !== totalPages) throw new Error("Jumlah halaman reader berubah; modul tidak disimpan.");
        if (page < totalPages) await sleep(Math.max(700, delayMs || 0));
      }
      if (stillActive()) await chrome.runtime.sendMessage({type: "MODULE_RESULT", runId, module, result: "complete", pages: totalPages, totalPages});
    } catch (e) {
      if (stillActive()) await chrome.runtime.sendMessage({type: "MODULE_RESULT", runId, module, result: "error", reason: e?.message || "Pemrosesan gambar reader gagal."});
    }
  }

  async function runModule(cfg) {
    return runRenderedModule(cfg);
  }

  let activeRunKey = "";

  // Reader readiness: the page must be interactive, not on a login wall, and
  // not rejected before a pending job may auto-resume on this tab. READY is
  // fired once per reader load; background re-arms it per navigation.
  let readySent = false;
  let wallSent = false;
  const sendReady = () => {
    if (readySent || activeRunId) return;
    if (pageRejected()) return;
    if (passwordVisible()) {
      // Keputusan Owner (Batch 18, 2026-10-13): login wall TIDAK BOLEH diam.
      // READY yang ditahan tanpa kabar membuat plan pendingResume tetap hidup
      // dan memicu auto-resume begitu user login — jalur auto yang sudah
      // dibatalkan. Lapor wall sekali supaya background membuang plan dan
      // menuntun ke tombol manual.
      if (!wallSent) {
        wallSent = true;
        // Batch 25: sendMessage bisa THROW sinkron bila tab ini masih memegang
        // context ekstensi generasi lama (ekstensi di-update/reload saat tab
        // terbuka) — "Extension context invalidated". .catch() pada nilai balik
        // tidak menangkap throw sinkron, jadi dibungkus try/catch. Sinyal wall
        // hilang, tapi background punya plan watchdog yang akan memuat ulang
        // tab ini sehingga content script segar terinjeksi.
        try {
          chrome.runtime.sendMessage({
            type: "READER_LOGIN_WALL",
            url: location.href
          }).catch(() => {});
        } catch (_) {}
      }
      return;
    }
    readySent = true;
    // Batch 25: alasan sama seperti WALL di atas — READY yang gagal terkirim
    // karena context stale dipulihkan oleh plan watchdog background (reload tab).
    try {
      chrome.runtime.sendMessage({
        type: "READER_READY",
        url: location.href
      }).catch(() => {});
    } catch (_) {}
  };
  if (document.readyState === "complete") setTimeout(sendReady, 350);
  else window.addEventListener("load", () => setTimeout(sendReady, 350), {once: true});
  new MutationObserver(sendReady).observe(document.body, {
    childList: true,
    subtree: true
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "BMP_RESET_READY") {
      readySent = false;
      wallSent = false;
      setTimeout(sendReady, 350);
      sendResponse({ok: true});
      return;
    }
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
