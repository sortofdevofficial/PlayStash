// The always-visible "Villagers" roster in the right stack: one row per
// active NPC showing name, hunger/happiness bars, current activity, and
// their latest thought. Replaces the old click-to-inspect single panel and
// the floating thought bubbles - everything lives in one scannable list
// instead of requiring a click or a tooltip that vanishes after 3 seconds.
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

export function initNpcPanel() {
  const rows = document.getElementById("npcListRows");
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
// of villagers, capped by hut count) - no need for incremental DOM diffing.
export function tickNpcPanel(activeNPCs) {
  const rows = document.getElementById("npcListRows");
  const countEl = document.getElementById("npcListCount");
  if (!rows) return;

  if (countEl) countEl.textContent = String(activeNPCs.length);

  if (activeNPCs.length === 0) {
    rows.innerHTML = `<div style="font-size:11px; color:#94a3b8; text-align:center; padding:10px 0;">No villagers yet</div>`;
    return;
  }

  if (trackedNpcId && !activeNPCs.some((n) => n.id === trackedNpcId)) clearTrackedNpc();

  rows.innerHTML = activeNPCs.map(rowHtml).join("");
}