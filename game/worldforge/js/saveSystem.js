// Small presentational bits tied to cloud save: the topbar's save-status
// pill text, and the "Other Worlds" panel that lets a player browse and
// visit other players' saved villages (read-only, via db.js's public
// G/{gameId} read).
import { listOtherWorlds } from "./db.js";
import { startVisit } from "./visitWorld.js";

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

// index.js passes its live placedObjects/activeNPCs through so the Visit
// button can hand them to visitWorld.js without this module needing to own
// or import that state itself.
export function initOtherWorldsPanel(placedObjects, activeNPCs) {
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
      const displayName = w.name || `Player ${w.uid.slice(0, 6)}`;
      const row = document.createElement("div");
      row.style.cssText = "background:rgba(255,255,255,0.08); border-radius:6px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center; gap:8px;";
      row.innerHTML = `
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
          <b style="color:#fff;">${displayName}</b><br/>
          <span style="font-size:10px; color:#94a3b8;">🏘️ ${w.buildingCount} builds · 👤 ${w.npcCount} villagers</span>
        </span>
        <button class="visit-world-btn" data-uid="${w.uid}" data-name="${displayName}" style="padding:4px 10px; font-size:11px; flex-shrink:0;">Visit</button>
      `;
      list.appendChild(row);
    });

    // Delegated click: rows are rebuilt each time the panel opens, so binding
    // once on the list container survives that rebuild.
    list.onclick = (e) => {
      const btn = e.target.closest(".visit-world-btn");
      if (!btn) return;
      panel.style.display = "none";
      startVisit(btn.dataset.uid, btn.dataset.name, placedObjects, activeNPCs);
    };
  };

  closeBtn.onclick = () => {
    document.getElementById("otherWorldsPanel").style.display = "none";
  };
}