import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm, updateFarmWiggle } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { updateGusts, initAmbientAudio } from "./audio.js";
import {
  engine, scene, camera, updateCameraControls,
  playableGround,
  startDisasterSystem
} from "./environment.js";
import {
  getMaxNPCCapacity, checkCampfireNPCSymmetry, updateNPCs
} from "./npcBrain.js";
import { state, updateResourceUI, showNotif } from "./ui.js";
import {
  authReady, loadSave, loadWorldByUid, initAutosave, markDirty,
  getPlayerId, serializeWorld, BUILD_CODE, signInWithGoogle, signOutUser, getCurrentUser
} from "./db.js";
import { initWorld, restoreWorld, instantiateObject, spawnRandomWildernessNode, removeObjectById } from "./world.js";
import { initInputHandlers, getTargetGhostPos } from "./inputHandlers.js";
import { initNpcPanel, tickNpcPanel, getTrackedNpcId, clearTrackedNpc } from "./npcPanel.js";
import { isTouchDevice, initMobileControls, applyMobileHeightHold } from "./mobileControls.js";
import { waitForPlay } from "./mainMenu.js";
import { setSaveStatus, initOtherWorldsPanel } from "./saveUI.js";
import { initVisitWorld } from "./visitWorld.js";

const spectateUid = new URLSearchParams(window.location.search).get("view");

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
  if (!state.isSpectating) markDirty();
}

function updateAuthUI() {
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const user = getCurrentUser();

  if (user && !user.isAnonymous) {
    if (signInBtn) signInBtn.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "flex";
  } else {
    if (signInBtn) signInBtn.style.display = "flex";
    if (signOutBtn) signOutBtn.style.display = "none";
  }
}

function initAuthHandlers() {
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");

  if (signInBtn) {
    signInBtn.addEventListener("click", async () => {
      try {
        await signInWithGoogle();
        showNotif("Signed in successfully!", "info");
        window.location.reload();
      } catch (err) {
        showNotif("Sign in failed", "warn");
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        await signOutUser();
        showNotif("Signed out", "info");
        window.location.reload();
      } catch (err) {
        showNotif("Sign out failed", "warn");
      }
    });
  }
}

function showSpectateBanner(uid) {
  const banner = document.createElement("div");
  banner.id = "spectateBanner";
  banner.textContent = `👁️ Viewing another player's world (read-only)`;
  banner.style.cssText = `
    position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
    z-index: 5000; background: rgba(37, 99, 235, 0.9); color: #fff;
    font-size: 12px; font-weight: 700; padding: 8px 18px; border-radius: 20px;
    border: 1px solid rgba(147, 197, 253, 0.5); backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: nowrap;
  `;
  document.body.appendChild(banner);
  document.body.classList.add("spectating");
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
  market: createMarket("ghostMarket", scene)
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
initVisitWorld(placedObjects, activeNPCs);
initOtherWorldsPanel();
initAuthHandlers();
if (isTouchDevice) initMobileControls();

function startWorldTicks() {
  setInterval(spawnRandomWildernessNode, 3500);
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
    uid = await withTimeout(authReady(), 6000, null);
    updateAuthUI();

    if (spectateUid) {
      data = await withTimeout(loadWorldByUid(spectateUid), 6000, null);
    } else {
      data = uid ? await withTimeout(loadSave(), 6000, null) : null;
    }
  } catch (err) {
    console.warn("[boot] Cloud save unavailable, continuing offline:", err);
  }

  try { initAmbientAudio(); } catch (e) {}

  if (data) {
    restoreWorld(data);
    syncNPCs();
  } else if (!spectateUid) {
    for (let i = 0; i < 25; i++) spawnRandomWildernessNode();
  }

  updateStats();
  updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);

  startRenderLoop();

  if (spectateUid) {
    state.isSpectating = true;
    showSpectateBanner(spectateUid);
    setSaveStatus("spectating");
    return;
  }

  await waitForPlay(data);

  startWorldTicks();
  startDisasterSystem(activeNPCs, (name) => showNotif(`${name} incoming!`, "warn"));
  initAutosave({ placedObjects, activeNPCs, state }, setSaveStatus);
  setSaveStatus(uid ? "ready" : "offline");
}

updateResourceUI(0, 0, placedObjects);
boot();

window.__worldforge = {
  placedObjects, activeNPCs, state, occupiedGrid,
  serializeWorld, restoreWorld, instantiateObject, getPlayerId
};

window.addEventListener("resize", () => engine.resize());
window.addEventListener("orientationchange", () => setTimeout(() => engine.resize(), 300));