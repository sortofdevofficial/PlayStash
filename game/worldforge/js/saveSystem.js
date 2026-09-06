// Small presentational bits tied to cloud save: the topbar's save-status
// pill text, and the "Other Worlds" panel that lets a player browse and
// visit other players' saved worlds. Visiting renders the other world in
// place, in this same tab and scene (see visitWorld.js) - no navigation.
// index.js still honours ?view={uid} on boot for hand-shared deep links.
import { listOtherWorlds } from "./db.js";
import { visitUid, isVisiting } from "./visitWorld.js";

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

export function initOtherWorldsPanel() {
  const viewBtn = document.getElementById("viewWorldsBtn");
  const closeBtn = document.getElementById("closeOtherWorldsBtn");
  const panel = document.getElementById("otherWorldsPanel");
  const list = document.getElementById("otherWorldsList");
  if (!viewBtn || !closeBtn || !panel || !list) return;

  // Delegated once at init rather than per row, so it survives re-rendering
  // the list and is not re-attached every time the panel is opened.
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest(".visit-world-btn");
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.textContent = "Loading…";
    try {
      if (await visitUid(btn.dataset.uid, btn.dataset.name || null)) {
        panel.style.display = "none";
        return;
      }
    } finally {
      // Without this a rejected visit leaves the row disabled forever.
      if (!isVisiting()) {
        btn.disabled = false;
        btn.textContent = "Visit";
      }
    }
  });

  viewBtn.onclick = async () => {
    const isOpen = panel.style.display !== "none";

    if (isOpen || isVisiting()) { panel.style.display = "none"; return; }

    panel.style.display = "block";
    list.textContent = "Loading…";

    const worlds = await listOtherWorlds();
    if (worlds.length === 0) {
      list.textContent = "No other players' worlds found yet.";
      return;
    }

    list.replaceChildren();
    worlds.forEach((w) => {
      const row = document.createElement("div");
      row.style.cssText = "background:rgba(255,255,255,0.08); border-radius:6px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center; gap:8px;";

      // Both strings originate in another player's save, so they are only ever
      // assigned as text - never interpolated into markup.
      const info = document.createElement("span");
      info.style.cssText = "overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;";

      const name = document.createElement("b");
      name.style.color = "#fff";
      name.textContent = w.name || `Player ${w.uid.slice(0, 6)}`;

      const stats = document.createElement("span");
      stats.style.cssText = "font-size:10px; color:#94a3b8;";
      stats.textContent = `🏘️ ${w.buildingCount} builds · 👤 ${w.npcCount} NPCs`;

      info.append(name, document.createElement("br"), stats);

      const visit = document.createElement("button");
      visit.className = "visit-world-btn";
      visit.style.cssText = "padding:4px 10px; font-size:11px; flex-shrink:0;";
      visit.textContent = "Visit";
      visit.dataset.uid = w.uid;
      visit.dataset.name = w.name || "";

      row.append(info, visit);
      list.appendChild(row);
    });
  };

  closeBtn.onclick = () => {
    panel.style.display = "none";
  };
}