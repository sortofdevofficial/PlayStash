import { audioCtx, isAudioMuted, setAudioMuted } from "./audio.js";
import { showNotif } from "./ui.js";

let pendingPlayResolve = null;
let isMenuInitialized = false;

export function waitForPlay(data) {
  return new Promise((resolve) => {
    pendingPlayResolve = resolve;
    showMainMenu(data);
  });
}

export function showMainMenu(data, isMidGame = false) {
  const menu = document.getElementById("mainMenu");
  const statusEl = document.getElementById("menuStatus");
  const playBtn = document.getElementById("menuPlayBtn");
  const guideBtn = document.getElementById("menuGuideBtn");
  const audioBtn = document.getElementById("menuAudioBtn");
  const guideModal = document.getElementById("guideModal");
  const closeGuideBtn = document.getElementById("closeGuideBtn");

  if (!menu || !statusEl || !playBtn) {
    if (pendingPlayResolve) {
      pendingPlayResolve();
      pendingPlayResolve = null;
    }
    return;
  }

  menu.classList.remove("hidden");

  if (isMidGame) {
    playBtn.textContent = "Resume World";
  } else if (data) {
    const builds = data.b ? Object.keys(data.b).length : 0;
    const npcs = data.n ? Object.keys(data.n).length : 0;
    statusEl.textContent = `World saved: ${builds} buildings, ${npcs} NPCs`;
    playBtn.textContent = "Continue";
  } else {
    statusEl.textContent = "A fresh wilderness awaits";
    playBtn.textContent = "Start World";
  }

  playBtn.disabled = false;

  if (!isMenuInitialized) {
    isMenuInitialized = true;

    playBtn.onclick = () => {
      playBtn.disabled = true;
      menu.classList.add("hidden");
      if (pendingPlayResolve) {
        pendingPlayResolve();
        pendingPlayResolve = null;
      }
      if (audioCtx && audioCtx.state === "suspended" && !isAudioMuted()) {
        audioCtx.resume();
      }
      playBtn.disabled = false;
    };

    if (guideBtn && guideModal) {
      guideBtn.onclick = () => {
        guideModal.classList.remove("hidden");
      };
    }
    if (closeGuideBtn && guideModal) {
      closeGuideBtn.onclick = () => {
        guideModal.classList.add("hidden");
      };
    }
    if (guideModal) {
      guideModal.onclick = (e) => {
        if (e.target === guideModal) guideModal.classList.add("hidden");
      };
    }

    if (audioBtn) {
      audioBtn.onclick = () => {
        setAudioMuted(!isAudioMuted());
        audioBtn.textContent = isAudioMuted() ? "🔇 Sound: Off" : "🔊 Sound: On";
      };
    }
  }
}

// ---------------------------------------------------------------------------
// WELCOME BACK - friendly nudge when a player returns after an ad opened
// (popunder tab, or the page was left through an ad and they pressed Back).
// We can't see the ad itself, so we guess from timing: the page was left within 2s of a click
// and the player came back 3s - 30min later. Shown at most once per 10 minutes.
// ---------------------------------------------------------------------------
export function initWelcomeBack() {
  const CLICK_WINDOW_MS = 2000;
  const MIN_AWAY_MS = 3000;
  const MAX_AWAY_MS = 30 * 60 * 1000;
  const COOLDOWN_MS = 10 * 60 * 1000;
  const K_TRIP = "ps_adtrip";            // same keys as the PlayStash homepage, so the cooldown is shared
  const K_SHOWN = "ps_welcome_shown";
  let lastClick = 0;

  const store = {
    get(k) { try { return Number(sessionStorage.getItem(k) || 0); } catch (e) { return 0; } },
    set(k, v) { try { sessionStorage.setItem(k, String(v)); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };

  // Our own links / auth buttons are normal navigation, not an ad trip.
  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const own = el && el.closest("a[href], #signInBtn, #signOutBtn, #menuPlayStashBtn");
    lastClick = own ? 0 : Date.now();
  }, true);

  function markTrip() {
    if (lastClick && Date.now() - lastClick <= CLICK_WINDOW_MS) store.set(K_TRIP, Date.now());
  }

  function showWelcome() {
    const menu = document.getElementById("mainMenu");
    const playBtn = document.getElementById("menuPlayBtn");
    const menuOpen = menu && !menu.classList.contains("hidden");

    if (menuOpen && playBtn && playBtn.parentNode) {
      if (document.getElementById("menuWelcome")) return;
      const box = document.createElement("div");
      box.id = "menuWelcome";
      box.textContent = "👋 Welcome back! Ready when you are.";
      playBtn.parentNode.insertBefore(box, playBtn);
      playBtn.classList.add("pulse");
      setTimeout(() => { box.remove(); playBtn.classList.remove("pulse"); }, 9000);
    } else {
      showNotif("Welcome back to WorldForge 👋", "info", 4000);
    }
  }

  function maybeWelcome() {
    const left = store.get(K_TRIP);
    if (!left) return;
    store.del(K_TRIP);
    const away = Date.now() - left;
    if (away < MIN_AWAY_MS || away > MAX_AWAY_MS) return;
    if (Date.now() - store.get(K_SHOWN) < COOLDOWN_MS) return;
    store.set(K_SHOWN, Date.now());
    showWelcome();
  }

  document.addEventListener("visibilitychange", () => { if (document.hidden) markTrip(); else maybeWelcome(); });
  window.addEventListener("pagehide", markTrip);
  window.addEventListener("pageshow", maybeWelcome);
  maybeWelcome(); // fresh load after pressing Back from an ad page
}