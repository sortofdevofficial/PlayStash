export const RESOURCE_BASE_CAP = 200;
export const STORAGE_CAP_BONUS = 150;

// Mapping technical keys to friendly names for UI notifications
export const RESOURCE_NAMES = {
  wh: "Wood",
  stone: "Stone",
  food: "Food",
  water: "Water"
};

// Export the state object
export const state = {
  mode: "none",
  buildType: null,
  buildRotation: 0,
  isNight: false,
  isSpectating: false,
  resources: { wh: 100, stone: 80, food: 30, water: 20 },
  BUILD_COSTS: {
    hut: { wh: 20, stone: 10, food: 0, water: 0 },
    campfire: { wh: 10, stone: 10, food: 0, water: 0 },
    farm: { wh: 15, stone: 5, food: 0, water: 5 },
    tower: { wh: 30, stone: 25, food: 0, water: 0 },
    well: { wh: 15, stone: 15, food: 0, water: 0 },
    storage: { wh: 25, stone: 10, food: 0, water: 0 },
    market: { wh: 20, stone: 20, food: 0, water: 0 }
  }
};

/**
 * Calculate the resource cap based on placed objects.
 * Includes bonus capacity from storage objects.
 */
export function getResourceCap(placedObjects) {
  let storageCount = 0;
  if (placedObjects) {
    placedObjects.forEach((o) => {
      if (o.type === "storage") storageCount++;
    });
  }
  return RESOURCE_BASE_CAP + storageCount * STORAGE_CAP_BONUS;
}

/**
 * Add a clamped amount of a resource to the state.
 * Ensures the value never goes below 0 or above the cap.
 */
export function addResourceClamped(key, amount, placedObjects) {
  if (!(key in state.resources)) return 0;
  const cap = getResourceCap(placedObjects);
  const before = state.resources[key] || 0;
  const newAmount = Math.max(0, Math.min(cap, before + amount));
  state.resources[key] = newAmount;
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

/**
 * Update the resource counters in the UI.
 */
export function updateResourceUI(activeNPCsLength, maxCap, placedObjects) {
  const cap = getResourceCap(placedObjects);
  setResourceText("whCount", `${state.resources.wh}/${cap}`);
  setResourceText("stoneCount", `${state.resources.stone}/${cap}`);
  setResourceText("foodCount", `${state.resources.food}/${cap}`);
  setResourceText("waterCount", `${state.resources.water}/${cap}`);
  if (document.getElementById("storageCap")) {
    document.getElementById("storageCap").textContent = cap;
  }
  if (document.getElementById("popCount")) {
    document.getElementById("popCount").textContent = `${activeNPCsLength}/${maxCap}`;
  }
}

/**
 * Show a notification in the notifContainer.
 * Gracefully handles missing container.
 */
export function showNotif(msg, type = "success") {
  const container = document.getElementById("notifContainer");
  if (!container) {
    console.warn("Notification container not found.");
    return;
  }
  while (container.children.length >= 2) {
    container.removeChild(container.firstChild);
  }

  const notif = document.createElement("div");
  notif.className = "mobile-notif";
  const badge = document.createElement("div");
  badge.className = `notif-badge ${type === "warn" ? "warn" : type === "info" ? "info" : ""}`;
  const text = document.createElement("span");
  text.textContent = msg;
  notif.append(badge, text);

  container.appendChild(notif);
  requestAnimationFrame(() => {
    notif.classList.add("show");
    if (type === "warn") notif.classList.add("warn-shake");
  });
  setTimeout(() => notif.remove(), 1600);
}

/**
 * Display floating text at a world position.
 * Requires BABYLON to be available.
 */
export function showFloatingText(text, worldPos, color = "#81C784", scene, camera, engine) {
  if (!window.BABYLON) {
    console.error("BABYLON library not loaded.");
    return;
  }

  const projected = window.BABYLON.Vector3.Project(
    worldPos, 
    window.BABYLON.Matrix.Identity(), 
    scene.getTransformMatrix(), 
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

/**
 * Highlight card elements based on the current building mode.
 */
export function updateCardHighlights() {
  ["hut", "campfire", "farm", "tower", "well", "storage", "market"].forEach((type) => {
    const el = document.getElementById(`card${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (el) el.classList.toggle("active", state.mode === "plant" && state.buildType === type);
  });
}

/**
 * Deselect all modes and reset the state.
 */
export function deselectAllModes(ghosts, removeGhostBox) {
  state.mode = "none";
  state.buildType = null;
  Object.values(ghosts).forEach((g) => g && g.setEnabled && g.setEnabled(false));
  if (removeGhostBox) removeGhostBox.isVisible = false;
  const rBtn = document.getElementById("removeBtn");
  if (rBtn) rBtn.classList.remove("danger");
  updateCardHighlights();
}