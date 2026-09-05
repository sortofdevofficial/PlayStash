import { playSound, initAmbientAudio, updateGusts } from "./audio.js";
import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm, updateFarmWiggle } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { createWallSegment, createGate } from "./models/wall.js";
import {
  canvas, engine, scene, camera, shadowGen,
  envMaterials, playableGround,
  setEnvironmentLighting, updateCameraControls,
  createLowPolyTree, createLowPolyStone
} from "./environment.js";
import {
  BUILD_SIZE, BOUND_MIN, BOUND_MAX, tileKey, worldToGrid, gridToWorldCenter,
  getFootprintTiles, isFootprintValid, isTileNearStructure, getMaxNPCCapacity,
  checkCampfireNPCSymmetry, updateNPCs, restoreNPC, setNpcIdSeed
} from "./npcBrain.js";
import { state, updateResourceUI, showNotif, showFloatingText, updateCardHighlights, deselectAllModes, addResourceClamped, getResourceCap } from "./ui.js";
import {
  authReady, loadSave, initAutosave, markDirty, getPlayerId,
  serializeWorld, RESOURCE_KEY_BY_SHORT, BUILD_CODE, TYPE_BY_CODE
} from "./db.js";

// Coarse pointer = finger/stylus rather than mouse. This is the standard way
// to detect "no keyboard, tapping instead of hovering" rather than guessing
// from screen width alone (a touch laptop is still a mouse-primary device;
// a small desktop window is still a mouse).
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
if (isTouchDevice) document.body.classList.add("touch-device");

const occupiedGrid = new Map();
const placedObjects = new Map();
const activeNPCs = [];
const buildCounters = {};
let pointerDownPos = null;
let hoveredObjId = null;
let selectedNpcId = null;
let trackedNpcId = null;
let firefliesPS = null;
let targetGhostPos = new BABYLON.Vector3(0, 0, 0);

function nextBuildKey(type) {
  buildCounters[type] = (buildCounters[type] || 0) + 1;
  return `${BUILD_CODE[type] || type}${buildCounters[type]}`;
}

function showNpcDetailPanel(npc) {
  selectedNpcId = npc.id;
  document.getElementById("npcDetailPanel").style.display = "block";
  document.getElementById("trackNpcBtn").style.background = (trackedNpcId === selectedNpcId) ? "#5cb85c" : "#e6dcce";
  updateNpcDetailPanel(npc);
}

function updateNpcDetailPanel(npc) {
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

function closeNpcDetailPanel() {
  selectedNpcId = null;
  trackedNpcId = null;
  document.getElementById("trackNpcBtn").style.background = "#e6dcce";
  document.getElementById("npcDetailPanel").style.display = "none";
}

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

// --- Mobile touch controls: replace keyboard-only WASD/Q/E/R ---
// Height buttons behave like holding Q/E: nudge every frame while pressed,
// not just once per tap, so raising/lowering feels the same as the keyboard.
let heightHoldDirection = 0; // -1 down, 0 idle, 1 up
function bindHoldButton(id, direction) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = (e) => { e.preventDefault(); heightHoldDirection = direction; };
  const stop = () => { heightHoldDirection = 0; };
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointerleave", stop);
  el.addEventListener("pointercancel", stop);
}
bindHoldButton("mobileUpBtn", 1);
bindHoldButton("mobileDownBtn", -1);

function applyMobileHeightHold(delta) {
  if (heightHoldDirection === 0) return;
  const vertSpeed = 0.45 * delta * 60; // matches the per-frame feel of the keyboard version
  camera.target.y = Math.max(0, camera.target.y + heightHoldDirection * vertSpeed);
}

document.getElementById("mobileRotateBtn").onclick = () => {
  state.buildRotation = (state.buildRotation + Math.PI / 2) % (Math.PI * 2);
  const activeGhost = ghosts[state.buildType];
  if (activeGhost) activeGhost.rotation.y = state.buildRotation;
};

initAmbientAudio();

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

const ONE_TILE_TYPES = new Set(["campfire", "well", "wall", "gate", "stone"]);
function sizeFor(type) { return ONE_TILE_TYPES.has(type) ? 1 : 2; }
function getFootprintSize() { return sizeFor(state.buildType); }

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

function createPoofParticles(position, colorHex) {
  const ps = new BABYLON.ParticleSystem("poof", 30, scene);
  ps.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
  ps.emitter = position.clone();
  ps.emitter.y += 0.5;
  ps.color1 = BABYLON.Color4.FromHexString(colorHex + "FF");
  ps.color2 = BABYLON.Color4.FromHexString(colorHex + "AA");
  ps.colorDead = BABYLON.Color4.FromHexString(colorHex + "00");
  ps.minSize = 0.15;
  ps.maxSize = 0.45;
  ps.minLifeTime = 0.25;
  ps.maxLifeTime = 0.6;
  ps.emitRate = 120;
  ps.createPointEmitter(new BABYLON.Vector3(-1.5, 1, -1.5), new BABYLON.Vector3(1.5, 2.5, 1.5));
  ps.gravity = new BABYLON.Vector3(0, -3, 0);
  ps.targetStopDuration = 0.15;
  ps.disposeOnStop = true;
  ps.start();
}

function buildNode(type, objId) {
  if (type === "tree") return createLowPolyTree(objId, scene, envMaterials);
  if (type === "stone") return createLowPolyStone(objId, scene);
  if (type === "hut") return createLowPolyHut(objId, scene);
  if (type === "campfire") return createCampfire(objId, scene);
  if (type === "farm") return createFarm(objId, scene);
  if (type === "tower") return createWatchtower(objId, scene);
  if (type === "well") return createWell(objId, scene);
  if (type === "storage") return createStorage(objId, scene);
  if (type === "market") return createMarket(objId, scene);
  if (type === "wall") return createWallSegment(objId, scene);
  return createGate(objId, scene);
}

// Shared by player placement, wilderness regrowth and save restoration. Every
// side effect here is load-bearing: mesh metadata drives picking, the material
// clone stops instances sharing one material, and occupiedGrid drives pathing.
function instantiateObject(type, rootX, rootZ, size, rotation = 0, extra = {}) {
  const objId = `${type}_${rootX}_${rootZ}`;
  const node = buildNode(type, objId);
  const pos = gridToWorldCenter(rootX, rootZ, size);

  node.rotation.y = rotation;
  node.position.set(pos.x, 0, pos.z);

  node.getChildMeshes().forEach((m) => {
    m.metadata = { objId, rootX, rootZ, type, size };
    if (m.material) {
      m.material = m.material.clone("mat_" + objId + "_" + m.name);
      m.material.alpha = 1.0;
    }
    if (shadowGen) shadowGen.addShadowCaster(m);
  });

  const tiles = getFootprintTiles(rootX, rootZ, size);
  tiles.forEach((t) => occupiedGrid.set(tileKey(t.x, t.z), objId));

  const entry = { root: node, tiles, rootX, rootZ, type, size, ...extra };
  if (!entry.key) entry.key = nextBuildKey(type);
  placedObjects.set(objId, entry);
  return entry;
}

function spawnRandomWildernessNode() {
  const currentNodes = Array.from(placedObjects.values()).filter((o) => o.type === "tree" || o.type === "stone").length;
  if (currentNodes >= 35) return;

  const rx = Math.floor(Math.random() * (BOUND_MAX - BOUND_MIN - 2)) + BOUND_MIN + 1;
  const rz = Math.floor(Math.random() * (BOUND_MAX - BOUND_MIN - 2)) + BOUND_MIN + 1;

  if (!isFootprintValid(rx, rz, 2, occupiedGrid) || isTileNearStructure(rx, rz, placedObjects, 3)) return;

  const type = Math.random() > 0.5 ? "tree" : "stone";
  instantiateObject(type, rx, rz, sizeFor(type), 0, { health: 3 });
  markDirty();
  updateStats();
}

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

function syncNPCs() {
  checkCampfireNPCSymmetry(activeNPCs, placedObjects, scene, shadowGen || null, updateStats);
  markDirty();
}

function placeObject(rootX, rootZ) {
  const cost = state.BUILD_COSTS[state.buildType];
  const shortfall = Object.keys(cost).find((key) => (state.resources[key] || 0) < cost[key]);
  if (shortfall) return showNotif(`Not enough ${shortfall}!`, "warn");

  const size = getFootprintSize();
  if (!isFootprintValid(rootX, rootZ, size, occupiedGrid)) return showNotif("Tile Blocked!", "warn");

  Object.keys(cost).forEach((key) => { state.resources[key] -= cost[key]; });

  const entry = instantiateObject(state.buildType, rootX, rootZ, size, state.buildRotation);

  playSound("place");
  createPoofParticles(entry.root.position, "#E6DCCE");

  markDirty();
  updateStats();
  updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
  showNotif(`Placed ${state.buildType}`);
  syncNPCs();
}

function disposeRoot(root) {
  if (scene.particleSystems) {
    scene.particleSystems
      .filter((ps) => ps.emitter === root || (ps.emitter && ps.emitter.parent === root))
      .forEach((ps) => { ps.stop(); ps.dispose(); });
  }
  const lights = scene.lights.filter((l) => l.parent === root);
  lights.forEach((l) => l.dispose());
  root.dispose(false, true);
}

function removeObjectById(objId) {
  const data = placedObjects.get(objId);
  if (!data) return;

  data.tiles.forEach((t) => occupiedGrid.delete(tileKey(t.x, t.z)));

  if (data.root) {
    createPoofParticles(data.root.position, data.type === "tree" ? "#4CAF50" : "#FFFFFF");
    disposeRoot(data.root);
  }

  placedObjects.delete(objId);

  activeNPCs.forEach((npc) => {
    if (npc.targetObjId === objId) {
      npc.targetObjId = null;
      npc.path = [];
      npc.a = "IDLE";
    }
  });

  if (hoveredObjId === objId) { hoveredObjId = null; removeGhostBox.isVisible = false; }
  updateStats();
  updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
  syncNPCs();
}

function findNpcRootFromMesh(mesh) {
  let node = mesh;
  while (node && node.parent) node = node.parent;
  return node;
}

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

        document.getElementById("cursorPos").textContent = `c: ${g.x},${g.z}`;
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
    }

    if (evt.button === 2 || state.mode === "remove") {
      let targetId = pick.pickedMesh?.metadata?.objId || hoveredObjId;
      if (targetId) removeObjectById(targetId);
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
          if (objData.health <= 0) removeObjectById(targetMesh.metadata.objId);
          markDirty();
          updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
          return;
        }
      }

      if (pick.hit && pick.pickedPoint) {
        const g = worldToGrid(pick.pickedPoint);
        placeObject(g.x, g.z);
      }
    }
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") {
    state.buildRotation = (state.buildRotation + Math.PI / 2) % (Math.PI * 2);
    const activeGhost = ghosts[state.buildType];
    if (activeGhost) activeGhost.rotation.y = state.buildRotation;
  }
});

document.getElementById("cardHut").onclick = () => setBuildType("hut");
document.getElementById("cardCampfire").onclick = () => setBuildType("campfire");
document.getElementById("cardFarm").onclick = () => setBuildType("farm");
document.getElementById("cardTower").onclick = () => setBuildType("tower");
document.getElementById("cardWell").onclick = () => setBuildType("well");
document.getElementById("cardStorage").onclick = () => setBuildType("storage");
document.getElementById("cardMarket").onclick = () => setBuildType("market");
document.getElementById("cardWall").onclick = () => setBuildType("wall");
document.getElementById("cardGate").onclick = () => setBuildType("gate");

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
  document.getElementById("dayBtn").textContent = state.isNight ? "Day Mode" : "Night Mode";

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
  } else {
    if (firefliesPS) firefliesPS.stop();
  }
};

document.getElementById("clearBtn").onclick = () => {
  if (!confirm("Clear the entire world? This also erases your saved world.")) return;
  Array.from(placedObjects.keys()).forEach((id) => removeObjectById(id));
  markDirty();
  updateStats();
  showNotif("World Cleared", "warn");
};

function updateStats() {
  document.getElementById("itemCount").textContent = placedObjects.size;
  document.getElementById("npcCount").textContent = activeNPCs.length;
}

function restoreWorld(data) {
  // Builds first: getResourceCap depends on how many storage buildings exist,
  // so restoring resources before them would clamp to the base 200 cap.
  if (data.b) {
    Object.entries(data.b).forEach(([key, node]) => {
      const code = key.replace(/\d+$/, "");
      const type = TYPE_BY_CODE[code];
      if (!type) return;

      const [cx, cz] = String(node?.c || "").split(",").map(Number);
      if (!Number.isFinite(cx) || !Number.isFinite(cz)) return;

      const extra = { key };
      // Only damaged nodes carry `hl`; full health is the omitted default.
      if (type === "tree" || type === "stone") extra.health = Number.isFinite(node.hl) ? node.hl : 3;

      const quadrant = Number.isFinite(node.r) ? ((Math.round(node.r) % 4) + 4) % 4 : 0;
      instantiateObject(type, cx, cz, sizeFor(type), quadrant * (Math.PI / 2), extra);

      buildCounters[type] = Math.max(buildCounters[type] || 0, Number(key.slice(code.length)) || 0);
    });
  }

  // Zero resources are omitted from the save, so on an existing save a missing
  // field means zero - not the fresh-world default still sitting in state.
  const cap = getResourceCap(placedObjects);
  Object.entries(RESOURCE_KEY_BY_SHORT).forEach(([short, internal]) => {
    const value = data.r ? data.r[short] : 0;
    state.resources[internal] = Number.isFinite(value) ? Math.max(0, Math.min(cap, value)) : 0;
  });

  if (data.n) {
    let maxId = 0;
    Object.entries(data.n).forEach(([id, node]) => {
      if (!node) return;
      restoreNPC({ ...node, id }, activeNPCs, scene);
      maxId = Math.max(maxId, Number(id) || 0);
    });
    setNpcIdSeed(maxId);
  }
}

function setSaveStatus(status) {
  const pill = document.getElementById("saveStatus");
  if (!pill) return;

  pill.dataset.state = status;
  pill.textContent = status === "saved"
    ? `Saved · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : status === "saving" ? "Saving…"
    : status === "error" ? "Save failed"
    : status === "offline" ? "Sign in to save"
    : status === "reload" ? "Reload to save"
    : "Cloud save on";
}

let elapsedTime = 0;

function startRenderLoop() {
  engine.runRenderLoop(() => {
    const delta = engine.getDeltaTime() / 1000;
    elapsedTime += delta;
    updateGusts();

    if (trackedNpcId) {
      const tNpc = activeNPCs.find((n) => n.id === trackedNpcId);
      if (tNpc) {
        camera.target = BABYLON.Vector3.Lerp(camera.target, tNpc.root.position, 0.05);
      } else {
        trackedNpcId = null;
        document.getElementById("trackNpcBtn").style.background = "#e6dcce";
      }
    } else {
      updateCameraControls();
      applyMobileHeightHold(delta);
    }

    const rotateBtn = document.getElementById("mobileRotateBtn");
    if (rotateBtn) rotateBtn.style.display = state.mode === "plant" ? "flex" : "none";

    if (state.mode === "plant") {
      const activeGhost = ghosts[state.buildType];
      if (activeGhost && activeGhost.isEnabled()) {
        activeGhost.position = BABYLON.Vector3.Lerp(activeGhost.position, targetGhostPos, 0.35);
        activeGhost.rotation.y = state.buildRotation;
      }
    }

    if (selectedNpcId) {
      const selectedNpc = activeNPCs.find((n) => n.id === selectedNpcId);
      if (selectedNpc) updateNpcDetailPanel(selectedNpc);
      else closeNpcDetailPanel();
    }

    placedObjects.forEach((obj) => {
      if (obj.type === "farm" && obj.root) updateFarmWiggle(obj.root, elapsedTime);
    });
    if (ghosts.farm) updateFarmWiggle(ghosts.farm, elapsedTime);

    updateNPCs(delta, activeNPCs, placedObjects, occupiedGrid, scene, camera, engine, removeObjectById);
    scene.render();
  });
}

async function boot() {
  const uid = await authReady();
  const data = uid ? await loadSave() : null;

  if (data) {
    restoreWorld(data);
    syncNPCs();
  } else {
    for (let i = 0; i < 25; i++) spawnRandomWildernessNode();
  }

  updateStats();
  updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);

  // Ticks and the render loop start only now: firing them mid-restore would
  // mutate placedObjects and resources while they are still being populated.
  startWorldTicks();
  initAutosave({ placedObjects, activeNPCs, state }, setSaveStatus);
  setSaveStatus(uid ? "ready" : "offline");
  startRenderLoop();
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