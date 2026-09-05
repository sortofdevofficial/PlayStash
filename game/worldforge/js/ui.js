--- START OF FILE ui.js ---

export const RESOURCE_BASE_CAP = 200;
export const STORAGE_CAP_BONUS = 150;

// Mapping technical keys to friendly names for UI notifications
export const RESOURCE_NAMES = {
  wh: "Wheat",
  stone: "Stone",
  food: "Food",
  water: "Water"
};

export const state = {
  mode: "none",
  buildType: null,
  buildRotation: 0,
  isNight: false,
  resources: { wh: 100, stone: 80, food: 30, water: 20 },
  BUILD_COSTS: {
    hut: { wh: 20, stone: 10, food: 0, water: 0 },
    campfire: { wh: 10, stone: 10, food: 0, water: 0 },
    farm: { wh: 15, stone: 5, food: 0, water: 5 },
    tower: { wh: 30, stone: 25, food: 10, water: 0 },
    well: { wh: 15, stone: 15, food: 0, water: 0 },
    storage: { wh: 25, stone: 10, food: 0, water: 0 },
    market: { wh: 20, stone: 20, food: 0, water: 0 },
    wall: { wh: 8, stone: 4, food: 0, water: 0 },
    gate: { wh: 12, stone: 6, food: 0, water: 0 }
  }
};

export function getResourceCap(placedObjects) {
  let storageCount = 0;
  if (placedObjects) {
    placedObjects.forEach((o) => { if (o.type === "storage") storageCount++; });
  }
  return RESOURCE_BASE_CAP + storageCount * STORAGE_CAP_BONUS;
}

export function addResourceClamped(key, amount, placedObjects) {
  if (!(key in state.resources)) return 0;
  const cap = getResourceCap(placedObjects);
  const before = state.resources[key] || 0;
  state.resources[key] = Math.max(0, Math.min(cap, before + amount));
  return state.resources[key] - before;
}

function setResourceText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove("value-pop");
  void el.offsetWidth; 
  el.classList.add("value-pop");
}

export function updateResourceUI(activeNPCsLength, maxCap, placedObjects) {
  const cap = getResourceCap(placedObjects);

  setResourceText("whCount", `${state.resources.wh}/${cap}`);
  setResourceText("stoneCount", `${state.resources.stone}/${cap}`);
  setResourceText("foodCount", `${state.resources.food}/${cap}`);
  setResourceText("waterCount", `${state.resources.water}/${cap}`);
  if (document.getElementById("storageCap")) document.getElementById("storageCap").textContent = cap;
  if (document.getElementById("popCount")) document.getElementById("popCount").textContent = `${activeNPCsLength}/${maxCap}`;
}

export function showNotif(msg, type = "success") {
  const container = document.getElementById("notifContainer");
  if (!container) return;
  while (container.children.length >= 2) container.removeChild(container.firstChild);

  const notif = document.createElement("div");
  notif.className = "mobile-notif";
  const badgeClass = type === "warn" ? "warn" : type === "info" ? "info" : "";
  notif.innerHTML = `<div class="notif-badge ${badgeClass}"></div><span>${msg}</span>`;

  container.appendChild(notif);
  requestAnimationFrame(() => {
    notif.classList.add("show");
    if (type === "warn") notif.classList.add("warn-shake");
  });
  setTimeout(() => notif.remove(), 1600);
}

export function showFloatingText(text, worldPos, color = "#81C784", scene, camera, engine) {
  const projected = BABYLON.Vector3.Project(
    worldPos, BABYLON.Matrix.Identity(), scene.getTransformMatrix(),
    camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
  );

  const popup = document.createElement("div");
  popup.textContent = text;
  popup.style.cssText = `
    position: absolute; left: ${projected.x}px; top: ${projected.y}px;
    color: ${color}; font-weight: bold; font-size: 15px; font-family: sans-serif;
    pointer-events: none; transition: transform 0.8s ease-out, opacity 0.8s ease-out;
    transform: translate(-50%, -100%); z-index: 1000; text-shadow: 0px 2px 4px rgba(0,0,0,0.8);
  `;
  document.body.appendChild(popup);

  requestAnimationFrame(() => {
    popup.style.transform = "translate(-50%, -180%)";
    popup.style.opacity = "0";
  });
  setTimeout(() => popup.remove(), 800);
}

export function updateCardHighlights() {
  ["hut", "campfire", "farm", "tower", "well", "storage", "market", "wall", "gate"].forEach((type) => {
    const el = document.getElementById(`card${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (el) el.classList.toggle("active", state.mode === "plant" && state.buildType === type);
  });
}

export function deselectAllModes(ghosts, removeGhostBox) {
  state.mode = "none";
  state.buildType = null;
  Object.values(ghosts).forEach((g) => g && g.setEnabled && g.setEnabled(false));
  if (removeGhostBox) removeGhostBox.isVisible = false;
  const rBtn = document.getElementById("removeBtn");
  if (rBtn) rBtn.classList.remove("danger");
  updateCardHighlights();
}