// Small presentational bits tied to cloud save: the topbar's save-status
// pill text, and the "Other Worlds" panel that lets a player browse other
// players' saved villages (read-only, via db.js's public G/{gameId} read).
import { listOtherWorlds } from "./db.js";

export function setSaveStatus(status) {
  const pill = document.getElementById("saveStatus");
  if (!pill) return;

  pill.dataset.state = status;
  pill.textContent = status === "saved"
    ? `Saved · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : status === "saving" ? "Saving…"
    : status === "error" ? "Save failed"
    : status === "offline" ? "Sign in to save"
    : status === "reload" ? "Reload to save"
    : "Cloud save on";
}

export function initOtherWorldsPanel() {
  const viewBtn = document.getElementById("viewWorldsBtn");
  const closeBtn = document.getElementById("closeOtherWorldsBtn");
  if (!viewBtn || !closeBtn) return;

  viewBtn.onclick = async () => {
    const panel = document.getElementById("otherWorldsPanel");
    const list = document.getElementById("otherWorldsList");
    const isOpen = panel.style.display !== "none";

    if (isOpen) { panel.style.display = "none"; return; }

    panel.style.display = "block";
    list.textContent = "Loading…";

    const worlds = await listOtherWorlds();
    if (worlds.length === 0) {
      list.textContent = "No other players' worlds found yet.";
      return;
    }

    list.innerHTML = "";
    worlds.forEach((w) => {
      const row = document.createElement("div");
      row.style.cssText = "background:rgba(255,255,255,0.08); border-radius:6px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center; gap:8px;";
      row.innerHTML = `
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          🏘️ ${w.buildingCount} builds · 👤 ${w.npcCount} villagers
        </span>
      `;
      list.appendChild(row);
    });
  };

  closeBtn.onclick = () => {
    document.getElementById("otherWorldsPanel").style.display = "none";
  };
}