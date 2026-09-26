import { canvas, scene, playableGround, setEnvironmentLighting } from "./environment.js";
import { worldToGrid, gridToWorldCenter, isFootprintValid, getMaxNPCCapacity } from "./npcBrain.js";
import { state, showNotif, updateCardHighlights, deselectAllModes, updateResourceUI, iconEl } from "./ui.js";
import { markDirty } from "./db.js";
import { getFootprintSize, placeObject, removeObjectById, clearWorld, isYardReserved } from "./world.js";
import { toggleTrackNpc } from "./npcPanel.js";
import { openMillPanel } from "./millPanel.js";

let placedObjects, occupiedGrid, activeNPCs, ghosts, removeGhostBox;
let hoveredObjId = null;
let pointerDownPos = null;
let targetGhostPos = new BABYLON.Vector3(0, 0, 0);
let firefliesPS = null;
let onWorldChanged = () => {};
let onSyncNPCs = () => {};

export function getTargetGhostPos() { return targetGhostPos; }

export function initInputHandlers(deps) {
  placedObjects = deps.placedObjects;
  occupiedGrid = deps.occupiedGrid;
  activeNPCs = deps.activeNPCs;
  ghosts = deps.ghosts;
  removeGhostBox = deps.removeGhostBox;
  onWorldChanged = deps.onWorldChanged;
  onSyncNPCs = deps.onSyncNPCs;

  bindPointerEvents();
  bindKeyboardShortcuts();
  bindBuildMenu();
  bindTopbarButtons();
}

function findNpcRootFromMesh(mesh) {
  let node = mesh;
  while (node && node.parent) node = node.parent;
  return node;
}

function handleRemoveClick(objId) {
  removeObjectById(objId, (removedId) => {
    if (hoveredObjId === removedId) { hoveredObjId = null; removeGhostBox.isVisible = false; }
  });
  markDirty();
  updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
  onWorldChanged();
  onSyncNPCs();
}

const GHOST_VALID = new BABYLON.Color3(0.2, 0.95, 0.4);
const GHOST_VALID_GLOW = new BABYLON.Color3(0.1, 0.4, 0.2);
const GHOST_INVALID = new BABYLON.Color3(0.95, 0.2, 0.2);
const GHOST_INVALID_GLOW = new BABYLON.Color3(0.4, 0.1, 0.1);

let ghostKey = null;      // mode + buildType, so the ghost sweep runs on changes only
let ghostValid = null;    // last tint applied to the visible ghost
let pointerMoved = false;

function showOnlyActiveGhost() {
  const key = `${state.mode}:${state.buildType}`;
  if (key === ghostKey) return false;
  ghostKey = key;
  ghostValid = null;
  Object.keys(ghosts).forEach((k) => ghosts[k].setEnabled(state.mode === "plant" && k === state.buildType));
  return true;
}

function tintGhost(isValid) {
  if (isValid === ghostValid) return;
  ghostValid = isValid;
  const ghost = ghosts[state.buildType];
  if (!ghost) return;
  ghost.getChildMeshes().forEach((m) => {
    if (!m.material) return;
    m.material.diffuseColor = isValid ? GHOST_VALID : GHOST_INVALID;
    m.material.emissiveColor = isValid ? GHOST_VALID_GLOW : GHOST_INVALID_GLOW;
  });
}

function updateGhostFromPointer() {
  if (state.isSpectating) return;
  if (state.mode !== "plant" && state.mode !== "remove") {
    showOnlyActiveGhost(); // makes sure switching to a non-build mode clears them
    return;
  }

  const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m === playableGround || m.metadata?.objId);
  if (!pick.hit || !pick.pickedPoint) return;

  if (state.mode === "plant") {
    removeGhostBox.isVisible = false;
    showOnlyActiveGhost();

    const size = getFootprintSize();
    const g = worldToGrid(pick.pickedPoint);
    targetGhostPos = gridToWorldCenter(g.x, g.z, size);
    tintGhost(isFootprintValid(g.x, g.z, size, occupiedGrid) && !isYardReserved(g.x, g.z, size));
  } else {
    showOnlyActiveGhost();
    const targetId = pick.pickedMesh?.metadata?.objId;

    if (targetId && placedObjects.has(targetId)) {
      const data = placedObjects.get(targetId);
      const center = gridToWorldCenter(data.rootX, data.rootZ, data.size);
      removeGhostBox.position.set(center.x, 1.5, center.z);
      removeGhostBox.scaling.set(data.size, 1, data.size);
      removeGhostBox.isVisible = true;
      hoveredObjId = targetId;
    } else {
      removeGhostBox.isVisible = false;
      hoveredObjId = null;
    }
  }
}

function bindPointerEvents() {
  const groundPickFilter = (m) => m === playableGround || m.metadata?.objId;
  const npcPickFilter = (m) => Boolean(m.metadata?.npcId);

  // Babylon would otherwise ray-cast the whole scene on every pointermove to
  // fill info.pickInfo, which nothing below reads.
  scene.skipPointerMovePicking = true;

  scene.onPointerObservable.add((info) => {
    if (info.type === BABYLON.PointerEventTypes.POINTERMOVE) {
      // pointermove fires far faster than the scene renders, and outside build
      // modes nothing used the result. Coalesce to one pick per frame.
      pointerMoved = true;
      return;
    }

    if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) pointerDownPos = { x: scene.pointerX, y: scene.pointerY };

    if (info.type === BABYLON.PointerEventTypes.POINTERUP) {
      if (!pointerDownPos) return;
      const dragDist = Math.hypot(scene.pointerX - pointerDownPos.x, scene.pointerY - pointerDownPos.y);
      pointerDownPos = null;
      if (dragDist > 6) return;

      const evt = info.event;
      const pick = scene.pick(scene.pointerX, scene.pointerY, groundPickFilter);

      if (evt.button === 0 && state.mode === "none") {
        const npcPick = scene.pick(scene.pointerX, scene.pointerY, npcPickFilter);
        if (npcPick.hit && npcPick.pickedMesh) {
          const npcRoot = findNpcRootFromMesh(npcPick.pickedMesh);
          if (npcRoot) {
            const clickedNpc = activeNPCs.find((n) => n.id === npcRoot.name);
            if (clickedNpc) {
              toggleTrackNpc(clickedNpc.id);
              return;
            }
          }
        }
      }

      if (state.isSpectating) return;

      if (evt.button === 0 && state.mode === "none") {
        const targetMesh = pick.pickedMesh;
        if (targetMesh && targetMesh.metadata?.objId) {
          const objData = placedObjects.get(targetMesh.metadata.objId);
          if (objData && objData.type === "lumbermill") {
            openMillPanel(objData, placedObjects, activeNPCs);
            return;
          }
        }
      }

      if (evt.button === 2) {
        if (state.mode !== "none") {
          deselectAllModes(ghosts, removeGhostBox);
          return;
        }
      }

      if (state.mode === "remove") {
        let targetId = pick.pickedMesh?.metadata?.objId || hoveredObjId;
        if (targetId) handleRemoveClick(targetId);
      } else if (evt.button === 0 && state.mode === "plant") {
        if (pick.hit && pick.pickedPoint) {
          const g = worldToGrid(pick.pickedPoint);
          const entry = placeObject(g.x, g.z);
          if (entry) {
            updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
            onWorldChanged();
            onSyncNPCs();
          }
        }
      }
    }
  });

  scene.onBeforeRenderObservable.add(() => {
    if (!pointerMoved) return;
    pointerMoved = false;
    updateGhostFromPointer();
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

function rotateActiveGhost() {
  if (state.isSpectating) return;
  state.buildRotation = (state.buildRotation + Math.PI / 2) % (Math.PI * 2);
  const activeGhost = ghosts[state.buildType];
  if (activeGhost) activeGhost.rotation.y = state.buildRotation;
}

function bindKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (state.isSpectating) return;
    const tag = (e.target && e.target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key.toLowerCase() === "r" && state.mode === "plant") rotateActiveGhost();
    if (e.key === "Escape") deselectAllModes(ghosts, removeGhostBox);

    // The chips on the build cards are the contract here: 1-8 pick a building.
    const digit = Number(e.key);
    if (!e.repeat && digit >= 1 && digit <= 8) {
      const types = ["hut", "campfire", "farm", "tower", "well", "storage", "market", "lumbermill"];
      const type = types[digit - 1];
      const el = document.getElementById("card" + type.charAt(0).toUpperCase() + type.slice(1));
      if (el) el.click();
    }
  });

  const rotateBtn = document.getElementById("mobileRotateBtn");
  if (rotateBtn) rotateBtn.onclick = rotateActiveGhost;
}

function setBuildType(type) {
  if (state.isSpectating) return;
  if (state.mode === "plant" && state.buildType === type) deselectAllModes(ghosts, removeGhostBox);
  else {
    state.buildType = type;
    state.mode = "plant";
    document.getElementById("removeBtn").classList.remove("danger");
    removeGhostBox.isVisible = false;
    updateCardHighlights();
    pointerMoved = true;
  }
}

function bindBuildMenu() {
  const types = ["hut", "campfire", "farm", "tower", "well", "storage", "market", "lumbermill"];
  types.forEach((type) => {
    const id = "card" + type.charAt(0).toUpperCase() + type.slice(1);
    const el = document.getElementById(id);
    if (el) el.onclick = () => setBuildType(type);
  });
}

function bindTopbarButtons() {
  document.getElementById("removeBtn").onclick = () => {
    if (state.isSpectating) return;
    if (state.mode === "remove") deselectAllModes(ghosts, removeGhostBox);
    else {
      state.mode = "remove";
      document.getElementById("removeBtn").classList.add("danger");
      Object.values(ghosts).forEach((g) => g.setEnabled(false));
      updateCardHighlights();
      pointerMoved = true;
    }
  };

  document.getElementById("dayBtn").onclick = () => {
    state.isNight = !state.isNight;
    setEnvironmentLighting(state.isNight);
    const dayBtn = document.getElementById("dayBtn");
    if (dayBtn) {
      dayBtn.replaceChildren(iconEl(state.isNight ? "ic-sun" : "ic-moon"));
      dayBtn.title = state.isNight ? "Switch to Day" : "Switch to Night";
    }

    if (state.isNight) {
      if (!firefliesPS) {
        firefliesPS = new BABYLON.ParticleSystem("fireflies", 60, scene);
        firefliesPS.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
        firefliesPS.emitter = new BABYLON.Vector3(0, 2, 0);
        firefliesPS.createBoxEmitter(new BABYLON.Vector3(0, 1, 0), new BABYLON.Vector3(0, 1, 0), new BABYLON.Vector3(-40, 0, -40), new BABYLON.Vector3(40, 6, 40));
        firefliesPS.color1 = new BABYLON.Color4(0.8, 1.0, 0.4, 0.8);
        firefliesPS.color2 = new BABYLON.Color4(0.5, 0.9, 0.2, 0.4);
        firefliesPS.colorDead = new BABYLON.Color4(0.2, 0.4, 0.1, 0.0);
        firefliesPS.minSize = 0.06;
        firefliesPS.maxSize = 0.16;
        firefliesPS.minLifeTime = 1.5;
        firefliesPS.maxLifeTime = 4.0;
        firefliesPS.emitRate = 20;
        firefliesPS.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
      }
      firefliesPS.start();
    } else if (firefliesPS) {
      firefliesPS.stop();
    }
  };

  document.getElementById("clearBtn").onclick = () => {
    if (state.isSpectating) return;
    if (!confirm("Clear the entire world? This also erases your saved world.")) return;
    hoveredObjId = null;
    removeGhostBox.isVisible = false;
    clearWorld();
    markDirty();
    onWorldChanged();
    onSyncNPCs();
    showNotif("World Cleared", "warn");
  };
}