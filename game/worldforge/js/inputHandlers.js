// All player input: canvas pointer events (placing/removing/harvesting/
// selecting an NPC), keyboard shortcuts, and the build-menu/topbar button
// clicks. Kept separate from world.js (which only knows how to create/
// destroy objects) and npcPanel.js (which only knows how to render one NPC's
// stats), so this file is purely "what does a click/keypress do".
import { canvas, scene, camera, engine, playableGround, setEnvironmentLighting } from "./environment.js";
import { worldToGrid, gridToWorldCenter, isFootprintValid, getMaxNPCCapacity } from "./npcBrain.js";
import { state, showNotif, showFloatingText, updateCardHighlights, deselectAllModes, addResourceClamped, updateResourceUI } from "./ui.js";
import { playSound } from "./audio.js";
import { markDirty } from "./db.js";
import { getFootprintSize, placeObject, removeObjectById } from "./world.js";
import { showNpcDetailPanel } from "./npcPanel.js";

let placedObjects, occupiedGrid, activeNPCs, ghosts, removeGhostBox;
let hoveredObjId = null;
let pointerDownPos = null;
let targetGhostPos = new BABYLON.Vector3(0, 0, 0);
let firefliesPS = null;
let onWorldChanged = () => {};
let onSyncNPCs = () => {};

export function getTargetGhostPos() { return targetGhostPos; }

// index.js owns the shared collections and the "something changed, re-sync
// stats/NPC counts" callbacks; this module just needs references to react to
// input, not to own the data itself.
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

function bindPointerEvents() {
  scene.onPointerObservable.add((info) => {
    const groundPickFilter = (m) => m === playableGround || m.metadata?.objId;

    if (info.type === BABYLON.PointerEventTypes.POINTERMOVE) {
      const pick = scene.pick(scene.pointerX, scene.pointerY, groundPickFilter);

      if (pick.hit && pick.pickedPoint) {
        if (state.mode === "plant") {
          removeGhostBox.isVisible = false;

          const size = getFootprintSize();
          const g = worldToGrid(pick.pickedPoint);
          targetGhostPos = gridToWorldCenter(g.x, g.z, size);

          const isValid = isFootprintValid(g.x, g.z, size, occupiedGrid);

          Object.keys(ghosts).forEach((k) => {
            const isCurrent = k === state.buildType;
            ghosts[k].setEnabled(isCurrent);
            if (isCurrent) {
              ghosts[k].getChildMeshes().forEach((m) => {
                if (m.material) {
                  m.material.diffuseColor = isValid ? new BABYLON.Color3(0.2, 0.95, 0.4) : new BABYLON.Color3(0.95, 0.2, 0.2);
                  m.material.emissiveColor = isValid ? new BABYLON.Color3(0.1, 0.4, 0.2) : new BABYLON.Color3(0.4, 0.1, 0.1);
                }
              });
            }
          });
        } else if (state.mode === "remove") {
          Object.values(ghosts).forEach((g) => g.setEnabled(false));
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
        const npcPick = scene.pick(scene.pointerX, scene.pointerY);
        if (npcPick.hit && npcPick.pickedMesh) {
          const npcRoot = findNpcRootFromMesh(npcPick.pickedMesh);
          if (npcRoot) {
            const clickedNpc = activeNPCs.find((n) => n.id === npcRoot.name);
            if (clickedNpc) {
              showNpcDetailPanel(clickedNpc);
              return;
            }
          }
        }

        // Direct tree chopping & stone mining in default explore mode
        const targetMesh = pick.pickedMesh;
        if (targetMesh && targetMesh.metadata?.objId) {
          const objData = placedObjects.get(targetMesh.metadata.objId);
          if (objData && (objData.type === "tree" || objData.type === "stone")) {
            if (objData.type === "tree") {
              const gained = addResourceClamped("wh", 4, placedObjects);
              playSound("chop");
              showFloatingText(gained > 0 ? "+4 Wheat 🌾" : "Storage full!", pick.pickedPoint, gained > 0 ? "#81C784" : "#e07263", scene, camera, engine);
            } else {
              const gained = addResourceClamped("stone", 4, placedObjects);
              playSound("mine");
              showFloatingText(gained > 0 ? "+4 Stone 🪨" : "Storage full!", pick.pickedPoint, gained > 0 ? "#E0E0E0" : "#e07263", scene, camera, engine);
            }

            objData.health = (objData.health || 3) - 1;
            if (objData.health <= 0) handleRemoveClick(targetMesh.metadata.objId);
            markDirty();
            updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
            return;
          }
        }
      }

      if (evt.button === 2) {
        // Right-click cancels active build or remove mode
        if (state.mode !== "none") {
          deselectAllModes(ghosts, removeGhostBox);
          return;
        }
      }

      if (state.mode === "remove") {
        let targetId = pick.pickedMesh?.metadata?.objId || hoveredObjId;
        if (targetId) handleRemoveClick(targetId);
      } else if (evt.button === 0 && state.mode === "plant") {
        const targetMesh = pick.pickedMesh;

        if (targetMesh && targetMesh.metadata?.objId) {
          const objData = placedObjects.get(targetMesh.metadata.objId);
          if (objData && (objData.type === "tree" || objData.type === "stone")) {
            if (objData.type === "tree") {
              const gained = addResourceClamped("wh", 4, placedObjects);
              playSound("chop");
              showFloatingText(gained > 0 ? "+4 Wheat 🌾" : "Storage full!", pick.pickedPoint, gained > 0 ? "#81C784" : "#e07263", scene, camera, engine);
            } else {
              const gained = addResourceClamped("stone", 4, placedObjects);
              playSound("mine");
              showFloatingText(gained > 0 ? "+4 Stone 🪨" : "Storage full!", pick.pickedPoint, gained > 0 ? "#E0E0E0" : "#e07263", scene, camera, engine);
            }

            objData.health = (objData.health || 3) - 1;
            if (objData.health <= 0) handleRemoveClick(targetMesh.metadata.objId);
            markDirty();
            updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
            return;
          }
        }

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

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

function rotateActiveGhost() {
  state.buildRotation = (state.buildRotation + Math.PI / 2) % (Math.PI * 2);
  const activeGhost = ghosts[state.buildType];
  if (activeGhost) activeGhost.rotation.y = state.buildRotation;
}

function bindKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") rotateActiveGhost();
    if (e.key === "Escape") deselectAllModes(ghosts, removeGhostBox);
  });

  const rotateBtn = document.getElementById("mobileRotateBtn");
  if (rotateBtn) rotateBtn.onclick = rotateActiveGhost;
}

function setBuildType(type) {
  if (state.mode === "plant" && state.buildType === type) deselectAllModes(ghosts, removeGhostBox);
  else {
    state.buildType = type;
    state.mode = "plant";
    document.getElementById("removeBtn").classList.remove("danger");
    removeGhostBox.isVisible = false;
    updateCardHighlights();
  }
}

function bindBuildMenu() {
  const types = ["hut", "campfire", "farm", "tower", "well", "storage", "market", "wall", "gate"];
  types.forEach((type) => {
    const id = "card" + type.charAt(0).toUpperCase() + type.slice(1);
    const el = document.getElementById(id);
    if (el) el.onclick = () => setBuildType(type);
  });
}

function bindTopbarButtons() {
  document.getElementById("removeBtn").onclick = () => {
    if (state.mode === "remove") deselectAllModes(ghosts, removeGhostBox);
    else {
      state.mode = "remove";
      document.getElementById("removeBtn").classList.add("danger");
      Object.values(ghosts).forEach((g) => g.setEnabled(false));
      updateCardHighlights();
    }
  };

  document.getElementById("dayBtn").onclick = () => {
    state.isNight = !state.isNight;
    setEnvironmentLighting(state.isNight);
    const dayBtn = document.getElementById("dayBtn");
    if (dayBtn) {
      dayBtn.textContent = state.isNight ? "☀️" : "🌙";
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
    if (!confirm("Clear the entire world? This also erases your saved world.")) return;
    Array.from(placedObjects.keys()).forEach((id) => removeObjectById(id, (removedId) => {
      if (hoveredObjId === removedId) { hoveredObjId = null; removeGhostBox.isVisible = false; }
    }));
    markDirty();
    onWorldChanged();
    showNotif("World Cleared", "warn");
  };
}