import { audioCtx, isAudioMuted, setAudioMuted } from "./audio.js";

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