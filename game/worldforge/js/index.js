import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm, updateFarmWiggle } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { createLumbermill } from "./models/lumbermill.js";
import { updateGusts, initAmbientAudio } from "./audio.js";
import {
  engine, scene, camera, updateCameraControls,
  playableGround,
  startDisasterSystem
} from "./environment.js";
import {
  getMaxNPCCapacity, checkCampfireNPCSymmetry, updateNPCs, objectsOfType
} from "./npcBrain.js";
import { state, updateResourceUI, showNotif, iconEl } from "./ui.js";
import {
  authReady, loadSave, loadWorldByUid, initAutosave, markDirty,
  getPlayerId, serializeWorld, BUILD_CODE, signInWithGoogle, signOutUser, getCurrentUser, getJoinTimes, initPresence
} from "./db.js";
import { initWorld, restoreWorld, instantiateObject, spawnRandomWildernessNode, removeObjectById, tickWoodlots } from "./world.js";
import { initInputHandlers, getTargetGhostPos } from "./inputHandlers.js";
import { initNpcPanel, tickNpcPanel, getTrackedNpcId, clearTrackedNpc } from "./npcPanel.js";
import { isTouchDevice, initMobileControls, applyMobileHeightHold } from "./mobileControls.js";
import { waitForPlay, showMainMenu, initWelcomeBack } from "./mainMenu.js";
import { setSaveStatus, initOtherWorldsPanel } from "./saveUI.js";
import { initVisitWorld } from "./visitWorld.js";


const spectateUid = new URLSearchParams(window.location.search).get("view");

const occupiedGrid = new Map();
const placedObjects = new Map();
const activeNPCs = [];
const buildCounters = {};

function updateCountsUI(wfCount, psCount) {
  const wfEls = [
    document.getElementById("wfOnlineCountText"),
    document.getElementById("topbarWfOnlineCount"),
    document.getElementById("panelWfOnlineCount")
  ];
  const psEls = [
    document.getElementById("psOnlineCountText"),
    document.getElementById("topbarPsOnlineCount"),
    document.getElementById("panelPsOnlineCount")
  ];

  wfEls.forEach((el) => { if (el) el.textContent = wfCount; });
  psEls.forEach((el) => { if (el) el.textContent = psCount; });
}

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

function formatJoinDate(ts) {
  if (!ts) return "Offline";
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

async function updateJoinedTimeUI(uid) {
  const psTextEl = document.getElementById("joinedPlayStashText");
  const wfTextEl = document.getElementById("joinedWorldForgeText");

  if (!uid) {
    if (psTextEl) psTextEl.textContent = "Offline";
    if (wfTextEl) wfTextEl.textContent = "Offline";
    return;
  }

  const times = await getJoinTimes(uid);
  if (psTextEl) psTextEl.textContent = formatJoinDate(times.playstash);
  if (wfTextEl) wfTextEl.textContent = formatJoinDate(times.worldforge);
}

function updateAuthUI() {
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const user = getCurrentUser();

  if (user && !user.isAnonymous) {
    if (signInBtn) signInBtn.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "flex";
    updateJoinedTimeUI(user.uid);
  } else {
    if (signInBtn) signInBtn.style.display = "flex";
    if (signOutBtn) signOutBtn.style.display = "none";
    updateJoinedTimeUI(null);
  }
}

function initAuthHandlers() {
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");

  if (signInBtn) {
    signInBtn.addEventListener("click", async () => {
      try {
        await signInWithGoogle();
        showNotif("Signed in successfully", "info");
        window.location.reload();
      } catch (err) {
        showNotif("Sign in failed", "warn");
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        showNotif("Why?", "warn");
        await signOutUser();
        window.location.reload();
      } catch (err) {
        showNotif("Sign out failed", "warn");
      }
    });
  }
}

function initPlayStashHandler() {
  const playStashBtn = document.getElementById("menuPlayStashBtn");
  if (playStashBtn) {
    playStashBtn.addEventListener("click", () => {
      window.location.href = playStashBtn.dataset.href || "../../";
    });
  }
}

function initMenuHandler() {
  const menuBtn = document.getElementById("menuBtn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      showMainMenu(null, true);
    });
  }
}

function showSpectateBanner(uid) {
  const banner = document.createElement("div");
  banner.id = "spectateBanner";
  banner.replaceChildren(iconEl("ic-eye"), " Viewing another player's world (read-only)");
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

scene.ambientColor = new BABYLON.Color3(0.42, 0.42, 0.46); // Softer ambient — less washed-out at noon

const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
pipeline.fxaaEnabled = true;
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.82;
pipeline.bloomWeight = 0.16; // Gentle bloom — cozy glow without blowing out highlights
pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.exposure = 0.92; // Darker exposure — cozier, less blinding midday
pipeline.imageProcessing.contrast = 1.05;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 0.40; // Slightly stronger vignette for cozy framing

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
  market: createMarket("ghostMarket", scene),
  // The ghost carries the woodlot fence too: those tiles really are reserved
  // the moment the mill lands (the validity check tints the ghost red over
  // them), so the preview should show the ground the player is about to commit.
  lumbermill: createLumbermill("ghostLumbermill", scene)
};

// One material for every ghost child: they are all the same translucent green,
// and a StandardMaterial per mesh meant 286 duplicate materials in a scene whose
// actual village only needed ~90.
const ghostMat = new BABYLON.StandardMaterial("ghostMat", scene);
ghostMat.diffuseColor = new BABYLON.Color3(0.2, 0.95, 0.4);
ghostMat.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.2);
ghostMat.alpha = 0.5;
ghostMat.zOffset = -5;

Object.values(ghosts).forEach((g) => {
  g.setEnabled(false);
  g.getChildMeshes().forEach((m) => {
    m.isPickable = false;
    m.material = ghostMat;
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

// #rightStack is anchored by --stackTop. It used to sit 14px from the top, the
// same band the topbar occupies, so an open panel covered the very button that
// toggles it. The topbar wraps, so its bottom edge has to be measured.
function syncStackTop() {
  const bar = document.getElementById("topbar");
  if (!bar) return;
  document.documentElement.style.setProperty(
    "--stackTop",
    Math.ceil(bar.getBoundingClientRect().bottom + 8) + "px"
  );
}

initWorld({ scene, placedObjects, occupiedGrid, activeNPCs, buildCounters, onStatsChanged: onWorldChanged, nextBuildKey });
initInputHandlers({ placedObjects, occupiedGrid, activeNPCs, ghosts, removeGhostBox, onWorldChanged, onSyncNPCs: syncNPCs });
initNpcPanel();
initVisitWorld(placedObjects, activeNPCs);
initOtherWorldsPanel();
initAuthHandlers();
initPlayStashHandler();
initMenuHandler();
initWelcomeBack();
if (isTouchDevice) initMobileControls();

// The topbar grows as its counts and save pill populate, and re-wraps when the
// window changes, so the stack anchor has to follow it rather than be measured
// once.
const topbarEl = document.getElementById("topbar");
if (topbarEl) {
  syncStackTop();
  new ResizeObserver(syncStackTop).observe(topbarEl);
}

function startWorldTicks() {
  setInterval(spawnRandomWildernessNode, 3500);
}

let elapsedTime = 0;

function updateCameraControlsWithMobile(delta) {
  updateCameraControls();
  applyMobileHeightHold(delta);
}

let rotateBtnEl = null;
let rotateBtnShown = null;

function updateRotateButton() {
  const show = state.mode === "plant";
  if (show === rotateBtnShown) return;
  rotateBtnShown = show;
  rotateBtnEl = rotateBtnEl || document.getElementById("mobileRotateBtn");
  if (rotateBtnEl) rotateBtnEl.style.display = show ? "flex" : "none";
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

    updateRotateButton();

    if (state.mode === "plant") {
      const activeGhost = ghosts[state.buildType];
      if (activeGhost && activeGhost.isEnabled()) {
        activeGhost.position = BABYLON.Vector3.Lerp(activeGhost.position, getTargetGhostPos(), 0.35);
        activeGhost.rotation.y = state.buildRotation;
      }
    }

    tickNpcPanel(activeNPCs);

    for (const farm of objectsOfType("farm")) {
      if (farm.root) updateFarmWiggle(farm.root, elapsedTime);
    }
    if (ghosts.farm) updateFarmWiggle(ghosts.farm, elapsedTime);

    tickWoodlots(delta);

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

  // Show "you" immediately so badges never sit on 0 while connecting.
  updateCountsUI(1, 0);
  // Presence starts once auth settles (or times out), so database rules that need a signed-in user work.
  const authPromise = authReady();
  authPromise.then(() => initPresence((wfCount, psCount) => updateCountsUI(wfCount, psCount), "worldforge"));

  try {
    uid = await withTimeout(authPromise, 6000, null);
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
  startDisasterSystem(activeNPCs, (name, icon) => showNotif(`${name} incoming!`, "warn", 2400, icon));
  initAutosave({ placedObjects, activeNPCs, state }, setSaveStatus);
  setSaveStatus(uid ? "ready" : "offline");
}

updateResourceUI(0, 0, placedObjects);
boot();

if (new URLSearchParams(location.search).get("debug") === "1") window.__worldforge = {
  placedObjects, activeNPCs, state, occupiedGrid,
  serializeWorld, restoreWorld, instantiateObject, getPlayerId
};

window.addEventListener("resize", () => engine.resize());
window.addEventListener("orientationchange", () => setTimeout(() => engine.resize(), 300));