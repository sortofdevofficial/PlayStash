// Small presentational bits tied to cloud save: the topbar's save-status
// pill text, and the "Other Worlds" panel that lets a player browse and
// visit other players' saved worlds. Visiting works by navigating to this
// same page with ?view={uid} in the URL - index.js reads that on boot and
// switches into a fully read-only spectate mode (see state.isSpectating).
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
    : status === "spectating" ? "Spectating (read-only)"
    : "Cloud save on";
}

// Builds a ?view={uid} URL against the current page, preserving no other
// query params - a visit link should always start clean rather than
// inheriting whatever params happened to be on the page that opened it.
function visitUrlFor(uid) {
  const url = new URL(window.location.href);
  url.search = `?view=${encodeURIComponent(uid)}`;
  return url.toString();
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
      const displayName = w.name || `Player ${w.uid.slice(0, 6)}`;
      const row = document.createElement("div");
      row.style.cssText = "background:rgba(255,255,255,0.08); border-radius:6px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center; gap:8px;";
      row.innerHTML = `
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
          <b style="color:#fff;">${displayName}</b><br/>
          <span style="font-size:10px; color:#94a3b8;">🏘️ ${w.buildingCount} builds · 👤 ${w.npcCount} NPCs</span>
        </span>
        <a class="visit-world-btn" href="${visitUrlFor(w.uid)}" target="_blank" rel="noopener"
           style="padding:4px 10px; font-size:11px; flex-shrink:0; text-decoration:none; display:inline-block;">Visit</a>
      `;
      list.appendChild(row);
    });
  };

  closeBtn.onclick = () => {
    document.getElementById("otherWorldsPanel").style.display = "none";
  };
}