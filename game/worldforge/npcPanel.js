// The right-side "click a villager" inspector panel: showing/updating their
// hunger/happiness bars, and the camera-follow ("track") toggle. Isolated
// from inputHandlers.js so the panel's own DOM/state churn doesn't clutter
// the pointer-event logic, and from index.js's render loop, which only needs
// to know the currently-selected/tracked ids to keep the panel and camera
// in sync each frame.
let selectedNpcId = null;
let trackedNpcId = null;

export function getSelectedNpcId() { return selectedNpcId; }
export function getTrackedNpcId() { return trackedNpcId; }
export function clearTrackedNpc() {
  trackedNpcId = null;
  const btn = document.getElementById("trackNpcBtn");
  if (btn) btn.style.background = "#e6dcce";
}

export function showNpcDetailPanel(npc) {
  selectedNpcId = npc.id;
  document.getElementById("npcDetailPanel").style.display = "block";
  document.getElementById("trackNpcBtn").style.background = (trackedNpcId === selectedNpcId) ? "#5cb85c" : "#e6dcce";
  updateNpcDetailPanel(npc);
}

export function updateNpcDetailPanel(npc) {
  const hunger = Math.max(0, Math.min(100, Math.floor(npc.hunger)));
  const happiness = Math.max(0, Math.min(100, Math.floor(npc.happiness)));
  const mood = happiness < 40 ? "Sad 😞" : happiness < 75 ? "Content 🙂" : "Happy 😊";

  document.getElementById("npcDetailName").textContent = npc.name;
  document.getElementById("npcHungerVal").textContent = `${hunger}%`;
  document.getElementById("npcHungerFill").style.width = `${hunger}%`;
  document.getElementById("npcHappyVal").textContent = `${happiness}%`;
  document.getElementById("npcHappyFill").style.width = `${happiness}%`;
  document.getElementById("npcDetailMood").textContent = mood;
}

export function closeNpcDetailPanel() {
  selectedNpcId = null;
  trackedNpcId = null;
  document.getElementById("trackNpcBtn").style.background = "#e6dcce";
  document.getElementById("npcDetailPanel").style.display = "none";
}

export function initNpcPanel() {
  document.getElementById("npcDetailClose").onclick = closeNpcDetailPanel;

  document.getElementById("trackNpcBtn").onclick = () => {
    if (trackedNpcId === selectedNpcId) {
      trackedNpcId = null;
      document.getElementById("trackNpcBtn").style.background = "#e6dcce";
    } else {
      trackedNpcId = selectedNpcId;
      document.getElementById("trackNpcBtn").style.background = "#5cb85c";
    }
  };
}

// Called every render frame by index.js: keeps the open panel's bars live if
// its NPC is still selected, and closes the panel if that NPC no longer exists
// (e.g. it starved, or the player removed the campfire that was hosting it).
export function tickNpcPanel(activeNPCs) {
  if (!selectedNpcId) return;
  const selectedNpc = activeNPCs.find((n) => n.id === selectedNpcId);
  if (selectedNpc) updateNpcDetailPanel(selectedNpc);
  else closeNpcDetailPanel();
}