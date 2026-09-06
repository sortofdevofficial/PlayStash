// The "NPCs" roster panel, opened via a topbar button: one row per active
// NPC showing name, hunger/happiness bars, current activity, and their
// latest thought about the world. Hidden by default - toggled open/closed
// rather than always visible.
let trackedNpcId = null;

const ACTIVITY_LABELS = {
  IDLE: "Idle",
  WALK: "Walking",
  CHOP: "Chopping wood",
  MINE: "Mining stone",
  FARM: "Farming",
  DRAW_WATER: "Drawing water",
  TRADE: "Trading",
  CLIMB: "Climbing tower",
  MANNING_WATCHTOWER: "On watch"
};

export function getTrackedNpcId() { return trackedNpcId; }
export function clearTrackedNpc() { trackedNpcId = null; }
export function toggleTrackNpc(id) { trackedNpcId = trackedNpcId === id ? null : id; }

// Called by npcBrain.js whenever an NPC starts a new activity or has
// something worth saying - replaces the old floating DOM thought-bubble
// system entirely (no element to create, show, hide, or clean up on
// despawn). The roster row below just reads npc.lastThought on its next
// tick, so this is a plain data write with no DOM work of its own.
export function setThought(npc, text) {
  npc.lastThought = text;
}

function moodFor(happiness) {
  return happiness < 40 ? "😞" : happiness < 75 ? "🙂" : "😊";
}

function rowHtml(npc) {
  const hunger = Math.max(0, Math.min(100, Math.floor(npc.hunger)));
  const happiness = Math.max(0, Math.min(100, Math.floor(npc.happiness)));
  const activity = ACTIVITY_LABELS[npc.a] || "Idle";
  const thought = npc.lastThought ? `"${npc.lastThought}"` : "…";
  const isTracked = trackedNpcId === npc.id;

  return `
    <div class="npc-row${isTracked ? " tracked" : ""}" data-npc-id="${npc.id}">
      <div class="npc-row-top">
        <span class="npc-row-name">${npc.name} ${moodFor(happiness)}</span>
        <button class="npc-row-track" data-track-id="${npc.id}" title="Follow with camera">${isTracked ? "🎥 Following" : "🎥"}</button>
      </div>
      <div class="npc-row-activity">${activity} — <em>${thought}</em></div>
      <div class="npc-stat-row">
        <div class="npc-stat-label"><span>Hunger</span><span>${hunger}%</span></div>
        <div class="npc-bar"><div class="npc-bar-fill hunger" style="width:${hunger}%;"></div></div>
      </div>
      <div class="npc-stat-row">
        <div class="npc-stat-label"><span>Happiness</span><span>${happiness}%</span></div>
        <div class="npc-bar"><div class="npc-bar-fill happy" style="width:${happiness}%;"></div></div>
      </div>
    </div>
  `;
}

// Wires up the open button (topbar), close button (panel header), and the
// per-row "follow with camera" click delegation. The panel itself starts
// with the "hidden" class already applied in the HTML.
export function initNpcPanel() {
  const panel = document.getElementById("npcListPanel");
  const openBtn = document.getElementById("npcListBtn");
  const closeBtn = document.getElementById("npcListClose");
  const rows = document.getElementById("npcListRows");

  if (openBtn && panel) {
    openBtn.onclick = () => panel.classList.toggle("hidden");
  }
  if (closeBtn && panel) {
    closeBtn.onclick = () => panel.classList.add("hidden");
  }

  if (!rows) return;

  // Event delegation: rows are re-rendered wholesale each tick, so binding to
  // the container once (rather than per-row) survives that re-render.
  rows.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-track-id]");
    if (!btn) return;
    toggleTrackNpc(btn.dataset.trackId);
  });
}

// Called every render frame by index.js. Rebuilding the whole list each call
// is simple and cheap at the population sizes this game supports (a handful
// of NPCs, capped by hut count) - no need for incremental DOM diffing.
export function tickNpcPanel(activeNPCs) {
  const rows = document.getElementById("npcListRows");
  const countEl = document.getElementById("npcListCount");
  if (!rows) return;

  if (countEl) countEl.textContent = String(activeNPCs.length);

  if (activeNPCs.length === 0) {
    rows.innerHTML = `<div style="font-size:11px; color:#94a3b8; text-align:center; padding:10px 0;">No NPCs yet</div>`;
    return;
  }

  if (trackedNpcId && !activeNPCs.some((n) => n.id === trackedNpcId)) clearTrackedNpc();

  rows.innerHTML = activeNPCs.map(rowHtml).join("");
}