// The cozy title screen shown before the world loads. index.js awaits
// waitForPlay() as part of boot() so nothing touches the scene/render loop
// until the player has actually clicked in.
import { audioCtx } from "./audio.js";

let pendingPlayResolve = null;
let isAudioMuted = false;

export function waitForPlay(data) {
  return new Promise((resolve) => {
    pendingPlayResolve = resolve;
    showMainMenu(data);
  });
}

function showMainMenu(data) {
  const menu = document.getElementById("mainMenu");
  const statusEl = document.getElementById("menuStatus");
  const playBtn = document.getElementById("menuPlayBtn");
  const statsCard = document.getElementById("menuStatsCard");
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

  if (data) {
    const builds = data.b ? Object.keys(data.b).length : 0;
    const villagers = data.n ? Object.keys(data.n).length : 0;
    const woodVal = data.r ? (data.r.wo ?? data.r.wh ?? 0) : 0;
    const stoneVal = data.r ? (data.r.s ?? 0) : 0;

    statusEl.textContent = `Village saved · ${builds} structures · ${villagers} villagers`;

    if (statsCard) {
      statsCard.style.display = "flex";
      const statsGrid = statsCard.querySelector(".menu-stats-grid");
      if (statsGrid) {
        statsGrid.innerHTML = `
          <div class="menu-stat-pill">🛖 <span>${builds} Builds</span></div>
          <div class="menu-stat-pill">👤 <span>${villagers} Villagers</span></div>
          <div class="menu-stat-pill">🌾 <span>${woodVal} Wheat</span></div>
          <div class="menu-stat-pill">🪨 <span>${stoneVal} Stone</span></div>
        `;
      }
    }
    playBtn.textContent = "Continue";
  } else {
    statusEl.textContent = "A fresh wilderness awaits your village";
    if (statsCard) statsCard.style.display = "none";
    playBtn.textContent = "Start Village";
  }

  playBtn.disabled = false;

  playBtn.onclick = () => {
    playBtn.disabled = true;
    menu.classList.add("hidden");
    if (pendingPlayResolve) {
      pendingPlayResolve();
      pendingPlayResolve = null;
    }
    // Unmute & resume audio context
    if (audioCtx && audioCtx.state === "suspended" && !isAudioMuted) {
      audioCtx.resume();
    }
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
      isAudioMuted = !isAudioMuted;
      if (isAudioMuted) {
        if (audioCtx && audioCtx.state === "running") audioCtx.suspend();
        audioBtn.textContent = "🔇 Sound: Off";
      } else {
        if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
        audioBtn.textContent = "🔊 Sound: On";
      }
    };
  }
}