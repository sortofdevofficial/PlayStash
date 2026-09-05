// Entry point. Owns the handful of collections every other module shares
// (placedObjects, activeNPCs, occupiedGrid, the build ghosts) and wires the
// split-out modules together. Each module below does one job:
//   world.js          - create/place/remove/restore world objects
//   inputHandlers.js  - pointer, keyboard, and build-menu/topbar clicks
//   npcPanel.js       - the villager inspector panel + camera tracking
//   mobileControls.js - touch-device detection + height-hold buttons
//   mainMenu.js       - the title screen gating boot() on Play
//   saveUI.js         - save-status pill + other-worlds browser panel
import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm, updateFarmWiggle } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { createWallSegment, createGate } from "./models/wall.js";
import { updateGusts, initAmbientAudio } from "./audio.js";
import {
  engine, scene, camera, updateCameraControls,
  playableGround, BUILD_SIZE
} from "./environment.js";
import {
  getMaxNPCCapacity, checkCampfireNPCSymmetry, updateNPCs
} from "./npcBrain.js";
import { state, updateResourceUI, addResourceClamped } from "./ui.js";
import { authReady, loadSave, initAutosave, markDirty, getPlayerId, serializeWorld, BUILD_CODE } from "./db.js";
import { initWorld, restoreWorld, instantiateObject, spawnRandomWildernessNode, removeObjectById } from "./world.js";
import { initInputHandlers, getTargetGhostPos } from "./inputHandlers.js";
import { initNpcPanel, tickNpcPanel, getTrackedNpcId, clearTrackedNpc } from "./npcPanel.js";
import { isTouchDevice, initMobileControls, applyMobileHeightHold } from "./mobileControls.js";
import { waitForPlay } from "./mainMenu.js";
import { setSaveStatus, initOtherWorldsPanel } from "./saveUI.js";

const occupiedGrid = new Map();
const placedObjects = new Map();
const activeNPCs = [];
const buildCounters = {};

function nextBuildKey(type) {
  buildCounters[type] = (buildCounters[type] || 0) + 1;
  return `${BUILD_CODE[type] || type}${buildCounters[type]}`;
}

function updateStats() {
  const itemEl = document.getElementById("itemCount");
  const npcEl = document.getElementById("npcCount");
  if (itemEl) itemEl.textContent = placedObjects.size;
  if (npcEl) npcEl.textContent = activeNPCs.length;
}

function onWorldChanged() {
  updateStats();
  updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
}

function syncNPCs() {
  checkCampfireNPCSymmetry(activeNPCs, placedObjects, scene, undefined, updateStats);
  markDirty();
}

scene.ambientColor = new BABYLON.Color3(0.5, 0.55, 0.6);

const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
pipeline.fxaaEnabled = true;
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.85;
pipeline.bloomWeight = 0.18;
pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.exposure = 1.0;
pipeline.imageProcessing.contrast = 1.0;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 0.4;

if (playableGround) {
  playableGround.position.set(0, 0, 0);
  playableGround.scaling.set(BUILD_SIZE + 40, 1, BUILD_SIZE + 40);
  playableGround.isVisible = true;
  playableGround.isPickable = true;
}

const ghosts = {
  hut: createLowPolyHut("ghostHut", scene),
  campfire: createCampfire("ghostCampfire", scene, true),
  farm: createFarm("ghostFarm", scene),
  tower: createWatchtower("ghostTower", scene),
  well: createWell("ghostWell", scene),
  storage: createStorage("ghostStorage", scene),
  market: createMarket("ghostMarket", scene),
  wall: createWallSegment("ghostWall", scene),
  gate: createGate("ghostGate", scene)
};

Object.values(ghosts).forEach((g) => {
  g.setEnabled(false);
  g.getChildMeshes().forEach((m) => {
    m.isPickable = false;
    const mat = new BABYLON.StandardMaterial("ghostMat_" + m.name, scene);
    mat.diffuseColor = new BABYLON.Color3(0.2, 0.95, 0.4);
    mat.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.2);
    mat.alpha = 0.5;
    mat.zOffset = -5;
    m.material = mat;
  });
});

const removeGhostBox = BABYLON.MeshBuilder.CreateBox("removeGhostBox", { width: 2, depth: 2, height: 3 }, scene);
const removeMat = new BABYLON.StandardMaterial("removeGhostMat", scene);
removeMat.diffuseColor = removeMat.emissiveColor = new BABYLON.Color3(1, 0.2, 0.2);
removeMat.alpha = 0.45;
removeMat.zOffset = -5;
removeGhostBox.material = removeMat;
removeGhostBox.isPickable = false;
removeGhostBox.isVisible = false;

initWorld({ scene, placedObjects, occupiedGrid, activeNPCs, buildCounters, onStatsChanged: onWorldChanged, nextBuildKey });
initInputHandlers({ placedObjects, occupiedGrid, activeNPCs, ghosts, removeGhostBox, onWorldChanged, onSyncNPCs: syncNPCs });
initNpcPanel();
initOtherWorldsPanel();
if (isTouchDevice) initMobileControls();

function startWorldTicks() {
  setInterval(spawnRandomWildernessNode, 3500);

  setInterval(() => {
    const farmCount = Array.from(placedObjects.values()).filter((o) => o.type === "farm").length;
    if (farmCount > 0) {
      addResourceClamped("food", farmCount * 2, placedObjects);
      markDirty();
      updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
    }
  }, 5000);
}

let elapsedTime = 0;

function updateCameraControlsWithMobile(delta) {
  updateCameraControls();
  applyMobileHeightHold(delta);
}

function startRenderLoop() {
  engine.runRenderLoop(() => {
    const delta = engine.getDeltaTime() / 1000;
    elapsedTime += delta;
    updateGusts();

    const trackedNpcId = getTrackedNpcId();
    if (trackedNpcId) {
      const tNpc = activeNPCs.find((n) => n.id === trackedNpcId);
      if (tNpc) {
        camera.target = BABYLON.Vector3.Lerp(camera.target, tNpc.root.position, 0.05);
      } else {
        clearTrackedNpc();
      }
    } else {
      updateCameraControlsWithMobile(delta);
    }

    const rotateBtn = document.getElementById("mobileRotateBtn");
    if (rotateBtn) rotateBtn.style.display = state.mode === "plant" ? "flex" : "none";

    if (state.mode === "plant") {
      const activeGhost = ghosts[state.buildType];
      if (activeGhost && activeGhost.isEnabled()) {
        activeGhost.position = BABYLON.Vector3.Lerp(activeGhost.position, getTargetGhostPos(), 0.35);
        activeGhost.rotation.y = state.buildRotation;
      }
    }

    tickNpcPanel(activeNPCs);

    placedObjects.forEach((obj) => {
      if (obj.type === "farm" && obj.root) updateFarmWiggle(obj.root, elapsedTime);
    });
    if (ghosts.farm) updateFarmWiggle(ghosts.farm, elapsedTime);

    updateNPCs(delta, activeNPCs, placedObjects, occupiedGrid, scene, camera, engine, (id) => removeObjectById(id));
    scene.render();
  });
}

// Races a promise against a timeout so a hung/blocked network call can never
// strand the player on the static "Loading village..." HTML forever - it
// falls back to `fallback` and lets the game continue offline instead.
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

async function boot() {
  let uid = null;
  let data = null;
  try {
    // authReady()/loadSave() previously had no try/catch here at all, so any
    // Firebase error or hang would stop boot() dead before it ever reached
    // waitForPlay() - the menu's Play button would stay disabled forever
    // with no error visible anywhere. This guarantees we always proceed.
    uid = await withTimeout(authReady(), 6000, null);
    data = uid ? await withTimeout(loadSave(), 6000, null) : null;
  } catch (err) {
    console.warn("[boot] Cloud save unavailable, continuing offline:", err);
  }

  try { initAmbientAudio(); } catch (e) {}

  if (data) {
    restoreWorld(data);
    syncNPCs();
  } else {
    for (let i = 0; i < 25; i++) spawnRandomWildernessNode();
  }

  updateStats();
  updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);

  // Rendering starts now, before the menu is even shown - the world is
  // already alive (fire flickering, villagers walking) behind the overlay,
  // which is what makes the menu read as a cozy window into the village
  // rather than a blank loading wall with nothing happening underneath it.
  startRenderLoop();

  await waitForPlay(data);

  // Everything that mutates the world/economy waits until after Play is
  // clicked, so nothing ticks away unseen while the player is still reading
  // the menu.
  startWorldTicks();
  initAutosave({ placedObjects, activeNPCs, state }, setSaveStatus);
  setSaveStatus(uid ? "ready" : "offline");
}

updateResourceUI(0, 0, placedObjects);
boot();

// Exposed for debugging the serialized payload without a signed-in session.
window.__worldforge = {
  placedObjects, activeNPCs, state, occupiedGrid,
  serializeWorld, restoreWorld, instantiateObject, getPlayerId
};

window.addEventListener("resize", () => engine.resize());
// iOS/Android report stale window dimensions for a moment right after a
// rotation, so a resize fired immediately still uses the old aspect ratio.
// Waiting one tick past the OS animation settles on the correct size.
window.addEventListener("orientationchange", () => setTimeout(() => engine.resize(), 300));