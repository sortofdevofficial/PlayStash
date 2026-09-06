// The "NPCs" roster panel, opened via a topbar button: one row per active
// NPC showing name, hunger/happiness bars, current activity, and their
// latest thought about the world. Hidden by default - toggled open/closed
// rather than always visible.
let trackedNpcId = null;
let panelEl = null;
let rowsEl = null;
let countEl = null;
let lastSignature = null;

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

function statRow(label, value, fillClass) {
  const wrap = document.createElement("div");
  wrap.className = "npc-stat-row";

  const labels = document.createElement("div");
  labels.className = "npc-stat-label";
  const labelText = document.createElement("span");
  labelText.textContent = label;
  const valueText = document.createElement("span");
  valueText.textContent = `${value}%`;
  labels.append(labelText, valueText);

  const bar = document.createElement("div");
  bar.className = "npc-bar";
  const fill = document.createElement("div");
  fill.className = `npc-bar-fill ${fillClass}`;
  fill.style.width = `${value}%`;
  bar.append(fill);

  wrap.append(labels, bar);
  return wrap;
}

function buildRow(npc) {
  const hunger = Math.max(0, Math.min(100, Math.floor(npc.hunger)));
  const happiness = Math.max(0, Math.min(100, Math.floor(npc.happiness)));
  const activity = ACTIVITY_LABELS[npc.a] || "Idle";
  const isTracked = trackedNpcId === npc.id;

  const row = document.createElement("div");
  row.className = `npc-row${isTracked ? " tracked" : ""}`;
  row.dataset.npcId = npc.id;

  const top = document.createElement("div");
  top.className = "npc-row-top";

  // name and lastThought are restored from the player's cloud save, so they are
  // only ever assigned as text - never interpolated into markup.
  const name = document.createElement("span");
  name.className = "npc-row-name";
  name.textContent = `${npc.name} ${moodFor(happiness)}`;

  const track = document.createElement("button");
  track.className = "npc-row-track";
  track.dataset.trackId = npc.id;
  track.title = "Follow with camera";
  track.textContent = isTracked ? "🎥 Following" : "🎥";

  top.append(name, track);

  const activityRow = document.createElement("div");
  activityRow.className = "npc-row-activity";
  const thought = document.createElement("em");
  thought.textContent = npc.lastThought ? `"${npc.lastThought}"` : "…";
  activityRow.append(`${activity} — `, thought);

  row.append(
    top,
    activityRow,
    statRow("Hunger", hunger, "hunger"),
    statRow("Happiness", happiness, "happy")
  );
  return row;
}

// Wires up the open button (topbar), close button (panel header), and the
// per-row "follow with camera" click delegation. The panel itself starts
// with the "hidden" class already applied in the HTML.
export function initNpcPanel() {
  panelEl = document.getElementById("npcListPanel");
  rowsEl = document.getElementById("npcListRows");
  countEl = document.getElementById("npcListCount");

  const openBtn = document.getElementById("npcListBtn");
  const closeBtn = document.getElementById("npcListClose");

  if (openBtn && panelEl) {
    openBtn.onclick = () => panelEl.classList.toggle("hidden");
  }
  if (closeBtn && panelEl) {
    closeBtn.onclick = () => panelEl.classList.add("hidden");
  }

  if (!rowsEl) return;

  // Event delegation: rows are re-rendered wholesale when their content
  // changes, so binding to the container once (rather than per-row) survives
  // that re-render.
  rowsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-track-id]");
    if (!btn) return;
    toggleTrackNpc(btn.dataset.trackId);
  });
}

// Called every render frame by index.js. Rebuilding the roster is skipped
// unless a value the rows actually display has changed - reparsing identical
// markup 60x a second was pure jank and reset hover/selection state each time.
function signatureFor(activeNPCs) {
  return activeNPCs.map((npc) => [
    npc.id,
    npc.name,
    Math.floor(npc.hunger),
    Math.floor(npc.happiness),
    npc.a,
    npc.lastThought || "",
    trackedNpcId === npc.id ? 1 : 0
  ].join("\u0001")).join("\u0002");
}

export function tickNpcPanel(activeNPCs) {
  if (!rowsEl || (panelEl && panelEl.classList.contains("hidden"))) return;

  const count = String(activeNPCs.length);
  if (countEl && countEl.textContent !== count) countEl.textContent = count;

  if (trackedNpcId && !activeNPCs.some((n) => n.id === trackedNpcId)) clearTrackedNpc();

  const signature = signatureFor(activeNPCs);
  if (signature === lastSignature) return;
  lastSignature = signature;

  if (activeNPCs.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "font-size:11px; color:#94a3b8; text-align:center; padding:10px 0;";
    empty.textContent = "No NPCs yet";
    rowsEl.replaceChildren(empty);
    return;
  }

  rowsEl.replaceChildren(...activeNPCs.map(buildRow));
}