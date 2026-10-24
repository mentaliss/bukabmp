/* Read-only job monitor: the background service worker owns every job state. */
(() => {
  const $ = id => document.getElementById(id);
  const labels = {
    IDLE:"Tidak ada proses",
    PREPARING:"Menyiapkan proses",
    DOWNLOADING_M:"Mengunduh modul",
    OCR:"Memproses teks",
    DONE:"Selesai",
    END_CANDIDATE:"Selesai",
    STOPPED:"Dihentikan",
    STOPPED_BY_USER:"Dihentikan",
    ERROR:"Gagal",
    BLOCKED:"Akses ditolak",
    LOGIN_REQUIRED:"Login diperlukan",
    INTERRUPTED:"Proses terputus",
    MISSING_GAP:"Modul belum tersedia",
    MISSING_UNCONFIRMED:"Modul belum terkonfirmasi"
  };
  const tone = status => {
    if (/^(DOWNLOADING_M|OCR|PREPARING|OPENING_M)/.test(String(status||""))) return "run";
    if (/^(DONE|END_CANDIDATE)/.test(String(status||""))) return "done";
    if (/^(ERROR|BLOCKED|LOGIN_REQUIRED)/.test(String(status||""))) return "error";
    if (/^(MISSING_|INTERRUPTED|STOPPED)/.test(String(status||""))) return "warn";
    return "";
  };
  const label = status => {
    if (/^OPENING_M/.test(String(status||""))) return "Membuka modul";
    if (/^DOWNLOADING_M/.test(String(status||""))) return "Mengunduh modul";
    if (/^M\d+_PDF_READY$/.test(String(status||""))) return "Modul selesai";
    return labels[status] || (status ? String(status) : "Tidak ada proses");
  };

  let pending = false;
  let lastState = null;
  let lastPendingResume = null;
  async function refresh() {
    if (pending || !globalThis.BMP_CONTROL_SURFACE?.active) return;
    pending = true;
    try {
      const response = await chrome.runtime.sendMessage({type:"GET_STATE"});
      if (!response?.ok || !response.state) throw new Error("Status belum tersedia.");
      if (!globalThis.BMP_CONTROL_SURFACE?.active) return;
      lastState = response.state;
      lastPendingResume = response.pendingResume || null;
      render(response.state);
    } catch (_) {
      $("launcherStatus").textContent = "Status belum tersambung";
    } finally { pending = false; }
  }

  // Item 10 (keputusan Owner 2026-10-11): tombol kontekstual di launcher.
  // Launcher adalah window monitor, bukan tab reader, jadi direct path popup
  // tidak berlaku di sini — jalur yang benar selalu OPEN_READER_AND_RESUME
  // (handler mencari/membuka tab reader sendiri). Konteks: loginResume saat
  // LOGIN_REQUIRED (redownload dipaksa mati, kontrak Batch 3) atau
  // pendingResume yang belum ter-resume.
  function computeResumeContext() {
    if (lastState?.running) return null;
    if (String(lastState?.status || "") === "LOGIN_REQUIRED") {
      const lr = lastState?.loginResume;
      if (lr && lr.code) return {
        code: String(lr.code).toUpperCase(),
        startModule: Number(lr.startModule) || 1,
        maxModule: Number(lr.maxModule) || 9,
        redownload: false,
        mergeRequested: Boolean(lr.mergeRequested)
      };
    }
    const p = lastPendingResume;
    if (p && p.code) return {
      code: String(p.code).toUpperCase(),
      startModule: Number(p.startModule) || 1,
      maxModule: Number(p.maxModule) || 9,
      redownload: Boolean(p.redownload),
      mergeRequested: Boolean(p.mergeRequested)
    };
    return null;
  }

  async function resumeAction() {
    const ctx = computeResumeContext();
    if (!ctx) return;
    const btn = $("resumeJob");
    const notice = $("launcherNotice");
    btn.disabled = true;
    notice.textContent = "";
    try {
      // nextModule presisi + deteksi needsReader, pola yang sama dengan popup:
      // modul pertama yang belum ter-cache di rentang plan.
      let nextModule = ctx.startModule;
      let cachedSet = null;
      try {
        const snap = await chrome.runtime.sendMessage({type:"GET_CACHE_SNAPSHOT", code: ctx.code});
        if (snap?.ok) cachedSet = new Set(Array.isArray(snap.modules) ? snap.modules : []);
      } catch (_) {/* snapshot gagal -> anggap semua perlu diproses */}
      let needsReader = ctx.redownload || ctx.mergeRequested || !cachedSet;
      if (!needsReader) {
        // Semua modul awal masih diasumsikan ter-cache; satu modul yang belum
        // ter-cache berarti modul itu butuh reader dan jadi titik lanjut.
        for (let m = ctx.startModule; m <= ctx.maxModule; m++) {
          if (!cachedSet.has(m)) { needsReader = true; nextModule = m; break; }
        }
      } else {
        for (let m = ctx.startModule; m <= ctx.maxModule; m++) {
          if (!cachedSet || !cachedSet.has(m)) { nextModule = m; break; }
        }
      }
      let res;
      if (!needsReader) {
        // Semua modul sudah ter-cache dan tanpa merge: proses lokal murni,
        // tidak butuh tab reader (kontrak popup plan.process.length===0).
        res = await chrome.runtime.sendMessage({
          type:"START_JOB", tabId:null, code:ctx.code,
          startModule:ctx.startModule, maxModule:ctx.maxModule,
          redownload:false, mergeRequested:false
        });
        if (res?.ok) notice.textContent = "Proses dimulai.";
      } else {
        res = await chrome.runtime.sendMessage({type:"OPEN_READER_AND_RESUME", ...ctx, nextModule});
        if (res?.ok) {
          notice.textContent = "Menyiapkan reader — lanjut otomatis begitu siap.";
        }
      }
      if (!res?.ok) notice.textContent = res?.error || "Gagal memulai proses.";
    } catch (e) {
      notice.textContent = "Gagal memulai proses: " + String(e?.message || e);
    } finally {
      btn.disabled = false;
      refresh();
    }
  }

  function render(state) {
    const dot = $("launcherDot");
    const status = state.status || "IDLE";
    $("launcherStatus").textContent = label(status);
    dot.className = "dot" + (tone(status) ? ` ${tone(status)}` : "");
    $("launcherContext").textContent = state.code
      ? `${state.code}${state.currentModule ? ` · Modul ${state.currentModule}` : ""}`
      : "";

    const wrap = $("launcherProgressWrap");
    const page = Number(state.pageIndex || 0);
    const total = Number(state.pageTotal || 0);
    const downloading = /^DOWNLOADING_M/.test(status);
    if (downloading && total > 0 && page > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((page / total) * 100)));
      wrap.hidden = false;
      $("launcherPages").textContent = `Halaman ${page} / ${total}`;
      $("launcherPercent").textContent = `${pct}%`;
      $("launcherBar").style.width = `${pct}%`;
      $("launcherOcr").textContent = String(state.ocrProgress || "");
    } else {
      wrap.hidden = true;
    }

    $("stop").hidden = !state.running;

    // Tombol kontekstual (Item 10): muncul hanya bila ada plan tertunda dan
    // job tidak sedang berjalan. Label mengikuti konteksnya.
    const ctx = computeResumeContext();
    const resumeSection = $("resumeWrap");
    resumeSection.hidden = !ctx;
    if (ctx) {
      const loginResume = String(state.status || "") === "LOGIN_REQUIRED" && !!state.loginResume?.code;
      $("resumeJob").textContent = loginResume ? "Lanjutkan setelah login" : "Lanjutkan proses";
    }
  }

  $("stop").addEventListener("click", () => {
    $("stop").disabled = true;
    chrome.runtime.sendMessage({type:"STOP_JOB"}).finally(() => {
      $("stop").disabled = false;
      refresh();
    });
  });

  $("resumeJob").addEventListener("click", () => {
    resumeAction();
  });

  globalThis.BMP_CONTROL_SURFACE.ready.then(refresh);
  setInterval(refresh, 1000);
})();
