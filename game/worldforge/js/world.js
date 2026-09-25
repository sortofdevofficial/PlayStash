import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { createLumbermill } from "./models/lumbermill.js";
import { createWallSegment, createGate } from "./models/wall.js";
import { envMaterials, createLowPolyTree, createLowPolyStone, shadowGen, claimScatter, releaseScatter } from "./environment.js";
import {
  BOUND_MIN, BOUND_MAX, tileKey, gridToWorldCenter,
  getFootprintTiles, isFootprintValid, isTileNearStructure, restoreNPC, setNpcIdSeed,
  objectsOfType, indexObject, unindexObject
} from "./npcBrain.js";
import { state, showNotif, getResourceCap, RESOURCE_NAMES, addResourceClamped } from "./ui.js";
import { playSound } from "./audio.js";
import { RESOURCE_KEY_BY_SHORT, TYPE_BY_CODE, markDirty } from "./db.js";

const ONE_TILE_TYPES = new Set(["campfire", "well", "stone", "wall", "gate"]);
export function sizeFor(type) { return ONE_TILE_TYPES.has(type) ? 1 : 2; }
export function getFootprintSize() { return sizeFor(state.buildType); }

let scene, placedObjects, occupiedGrid, activeNPCs, buildCounters, onStatsChanged, nextBuildKey;

export function initWorld(deps) {
  scene = deps.scene;
  placedObjects = deps.placedObjects;
  occupiedGrid = deps.occupiedGrid;
  activeNPCs = deps.activeNPCs;
  buildCounters = deps.buildCounters;
  onStatsChanged = deps.onStatsChanged;
  nextBuildKey = deps.nextBuildKey;
}

export function buildNode(type, objId) {
  if (type === "tree") return createLowPolyTree(objId, scene, envMaterials);
  if (type === "stone") return createLowPolyStone(objId, scene);
  if (type === "hut") return createLowPolyHut(objId, scene);
  if (type === "campfire") return createCampfire(objId, scene);
  if (type === "farm") return createFarm(objId, scene);
  if (type === "tower") return createWatchtower(objId, scene);
  if (type === "well") return createWell(objId, scene);
  if (type === "storage") return createStorage(objId, scene);
  if (type === "wall") return createWallSegment(objId, scene);
  if (type === "gate") return createGate(objId, scene);
  if (type === "market") return createMarket(objId, scene);
  if (type === "lumbermill") return createLumbermill(objId, scene);
  console.warn("[world] Unknown build type:", type);
  return null;
}

let nodeCount = 0; // standing trees + stones, for the wilderness spawn cap

// The shadow map re-renders every registered caster, so a village of a hundred
// buildings used to push ~1,040 meshes through it per frame. Ropes, lanterns,
// buckets and moss are far below one texel of a 1024² map covering the whole
// valley, yet cost the same draw setup as a roof.
const MIN_CASTER_EXTENT = 0.16;

function shadowCasters(meshes) {
  const worthIt = meshes.filter((m) => {
    const ext = m.getBoundingInfo().boundingBox.extendSize;
    const s = m.scaling;
    return Math.max(ext.x * s.x, ext.y * s.y, ext.z * s.z) >= MIN_CASTER_EXTENT;
  });
  return worthIt.length ? worthIt : meshes;
}

export function instantiateObject(type, rootX, rootZ, size, rotation = 0, extra = {}) {
  const objId = `${type}_${rootX}_${rootZ}`;
  const node = buildNode(type, objId);
  if (!node) return null;
  const pos = gridToWorldCenter(rootX, rootZ, size);

  node.rotation.y = rotation;
  node.position.set(pos.x, 0, pos.z);

  // Otherwise stones end up sitting on the building's own floor. Runs for saved
  // worlds too, since restoreWorld goes through here.
  claimScatter(objId, rootX, rootZ, size);

  const meshes = node.getChildMeshes();
  meshes.forEach((m) => {
    m.metadata = { objId, rootX, rootZ, type, size };
  });
  if (shadowGen) shadowCasters(meshes).forEach((m) => shadowGen.addShadowCaster(m));

  const tiles = getFootprintTiles(rootX, rootZ, size);
  tiles.forEach((t) => occupiedGrid.set(tileKey(t.x, t.z), objId));

  const entry = { id: objId, root: node, tiles, rootX, rootZ, type, size, ...extra };
  if (!entry.key) entry.key = nextBuildKey(type);
  placedObjects.set(objId, entry);

  indexObject(entry);
  if (type === "tree" || type === "stone") nodeCount++;

  return entry;
}

export function spawnRandomWildernessNode() {
  if (nodeCount >= WILDERNESS_NODE_CAP) return;

  const rx = Math.floor(Math.random() * (BOUND_MAX - BOUND_MIN - 2)) + BOUND_MIN + 1;
  const rz = Math.floor(Math.random() * (BOUND_MAX - BOUND_MIN - 2)) + BOUND_MIN + 1;

  if (!isFootprintValid(rx, rz, 2, occupiedGrid) || isTileNearStructure(rx, rz, placedObjects, 3)) return;

  // A world with a mill gets its timber from that mill's woodlot and nowhere
  // else, which is what makes the building worth the space. Without one,
  // trees drop in the wild as they always have, so existing saves play on.
  const type = hasLumbermill() ? "stone" : (Math.random() > 0.5 ? "tree" : "stone");
  instantiateObject(type, rx, rz, sizeFor(type), 0, { health: 3 });
  markDirty();
  onStatsChanged();
}

// ============================================================
// LUMBERMILL WOODLOTS
// Each mill claims a square of forest around itself and coaxes trees back into
// it. Crew size drives both halves of the loop: more NPCs chop more trees, and
// the lot regrows faster so a full staff cannot strip it bare.
// ============================================================
export const MAX_WORKERS = 4;
export const WOODLOT_CAP = 6;         // standing trees a single lot supports
const WILDERNESS_NODE_CAP = 35;
const WOODLOT_PAD = 3;                // tiles of forest a mill claims past its footprint
const WOODLOT_REGROW_S = 12;          // seconds per sprout with one worker
const WOODLOT_MIN_S = 3;              // floor, so a big crew can't outrun the chop

export function woodlotRegrowSeconds(mill) {
  return Math.max(WOODLOT_MIN_S, WOODLOT_REGROW_S / Math.max(1, mill.workers || 0));
}

export function hasLumbermill() { return objectsOfType("lumbermill").size > 0; }

export function woodlotBounds(mill) {
  return {
    x0: Math.max(BOUND_MIN, mill.rootX - WOODLOT_PAD),
    x1: Math.min(BOUND_MAX, mill.rootX + mill.size - 1 + WOODLOT_PAD),
    z0: Math.max(BOUND_MIN, mill.rootZ - WOODLOT_PAD),
    z1: Math.min(BOUND_MAX, mill.rootZ + mill.size - 1 + WOODLOT_PAD)
  };
}

/**
 * Staffing is the player's dial on output. Lowering it releases the surplus
 * crew immediately so no NPC keeps walking toward a lot that no longer needs
 * them; raising it just leaves the next idle villager to claim the opening.
 */
export function setMillWorkers(mill, workers) {
  const n = Math.max(0, Math.min(MAX_WORKERS, Math.round(workers)));
  mill.workers = n;
  if (mill.crew && mill.crew.size > n) {
    let i = 0;
    for (const npcId of mill.crew) {
      if (i++ >= n) releaseWorker(mill, npcId);
    }
  }
  markDirty();
  return n;
}

function releaseWorker(mill, npcId) {
  mill.crew.delete(npcId);
  const npc = activeNPCs.find((o) => o.id === npcId);
  if (npc) {
    npc.employer = null;
    if (npc.targetObjId && npc.a !== "IDLE" && npc.a !== "WALK") return;
    npc.targetObjId = null;
    npc.pendingAction = null;
    npc.path = [];
    npc.a = "IDLE";
  }
}

export function tickWoodlots(delta) {
  for (const mill of objectsOfType("lumbermill")) {
    if (mill.crew) {
      for (const npcId of Array.from(mill.crew)) {
        const worker = activeNPCs.find((o) => o.id === npcId);
        if (!worker || worker.isDead || worker.respawning) releaseWorker(mill, npcId);
      }
    }

    mill.regrowTimer = (mill.regrowTimer || 0) - delta;
    if (mill.regrowTimer > 0) continue;
    mill.regrowTimer = woodlotRegrowSeconds(mill);
    if (!mill.lot) mill.lot = new Set();
    if (mill.lot.size >= WOODLOT_CAP) continue;
    if (nodeCount >= WILDERNESS_NODE_CAP + WOODLOT_CAP) continue;

    const bounds = woodlotBounds(mill);
    const free = [];
    for (let x = bounds.x0; x <= bounds.x1; x++) {
      for (let z = bounds.z0; z <= bounds.z1; z++) {
        if (!occupiedGrid.has(tileKey(x, z))) free.push({ x, z });
      }
    }
    if (!free.length) continue;

    const spot = free[(Math.random() * free.length) | 0];
    const tree = instantiateObject("tree", spot.x, spot.z, 1, 0, { health: 3, lotId: mill.id });
    if (tree) {
      mill.lot.add(tree);
      markDirty();
    }
  }
}

export function placeObject(rootX, rootZ) {
  const cost = state.BUILD_COSTS[state.buildType];
  const shortfall = Object.keys(cost).find((key) => (state.resources[key] || 0) < cost[key]);
  
  if (shortfall) {
    // Convert technical key (e.g., 'wh') to friendly name (e.g., 'Wood')
    const friendlyName = RESOURCE_NAMES[shortfall] || shortfall;
    return showNotif(`Not enough ${friendlyName}!`, "warn");
  }

  const size = getFootprintSize();
  if (!isFootprintValid(rootX, rootZ, size, occupiedGrid)) return showNotif("Tile Blocked!", "warn");

  Object.keys(cost).forEach((key) => { state.resources[key] -= cost[key]; });

  const entry = instantiateObject(state.buildType, rootX, rootZ, size, state.buildRotation);

  if (state.buildType === "lumbermill") {
    entry.crew = new Set();
    entry.workers = 1;
    entry.regrowTimer = 1;
    showNotif("Click the mill to assign workers", "info");
  }

  playSound("place");
  createPoofParticles(entry.root.position, "#E6DCCE");

  markDirty();
  onStatsChanged();
  showNotif(`Placed ${state.buildType}`);
  return entry;
}

export function disposeRoot(root) {
  if (scene.particleSystems) {
    scene.particleSystems
      .filter((ps) => ps.emitter === root || (ps.emitter && ps.emitter.parent === root))
      .forEach((ps) => { ps.stop(); ps.dispose(); });
  }
  const lights = scene.lights.filter((l) => l.parent === root);
  lights.forEach((l) => l.dispose());
  const obs = root.metadata && root.metadata.observer;
  if (obs) scene.onBeforeRenderObservable.remove(obs);
  // doNotDisposeMaterials: models share per-scene materials, so freeing them
  // here would blank every other instance of the same building.
  root.dispose(false, false);
}

export function removeObjectById(objId, onHoveredCleared, options = {}) {
  const data = placedObjects.get(objId);
  if (!data) return;

  data.tiles.forEach((t) => occupiedGrid.delete(tileKey(t.x, t.z)));

  // Give the scatter back - otherwise every cleared tile stays a bald patch.
  releaseScatter(objId);

  if (data.root) {
    createPoofParticles(data.root.position, data.type === "tree" ? "#4CAF50" : "#FFFFFF");
    disposeRoot(data.root);
  }

  placedObjects.delete(objId);

  unindexObject(data);
  if (data.type === "tree" || data.type === "stone") nodeCount--;

  if (data.type === "lumbermill") {
    if (data.crew) for (const npcId of Array.from(data.crew)) releaseWorker(data, npcId);
    // The forest it was tending does not vanish with the mill - those trees
    // simply stop belonging to a lot and become ordinary wilderness again.
    if (data.lot) data.lot.forEach((tree) => { tree.lotId = null; });
  } else if (data.lotId) {
    const mill = placedObjects.get(data.lotId);
    if (mill && mill.lot) mill.lot.delete(data);
  }

  // Refund after the object is gone so storage-cap bonuses don't let the
  // refund sit above the new, smaller cap.
  const cost = options.refund === false ? null : state.BUILD_COSTS[data.type];
  if (cost) {
    const refunded = [];
    Object.entries(cost).forEach(([key, amount]) => {
      if (amount <= 0) return;
      const gained = addResourceClamped(key, amount, placedObjects);
      if (gained > 0) refunded.push(`${gained} ${RESOURCE_NAMES[key] || key}`);
    });
    if (refunded.length > 0) showNotif(`Refunded ${refunded.join(", ")}`, "info");
  }

  const cap = getResourceCap(placedObjects);
  Object.keys(state.resources).forEach((key) => {
    state.resources[key] = Math.max(0, Math.min(cap, state.resources[key] || 0));
  });

  activeNPCs.forEach((npc) => {
    if (npc.targetObjId === objId) {
      npc.targetObjId = null;
      npc.path = [];
      npc.pendingAction = null;
      npc.a = "IDLE";
      if (npc.root) npc.root.position.y = 0;
    }
  });

  if (onHoveredCleared) onHoveredCleared(objId);
  onStatsChanged();
}

export function clearWorld() {
  Array.from(placedObjects.keys()).forEach((id) => {
    removeObjectById(id, undefined, { refund: false });
  });

  while (activeNPCs.length) {
    const npc = activeNPCs.pop();
    if (!npc) continue;
    npc.respawning = false;
    npc.isDead = true;
    if (npc.root) npc.root.dispose();
  }

  Object.keys(buildCounters).forEach((type) => { buildCounters[type] = 0; });
  state.resources = { wh: 100, stone: 80, food: 30, water: 20 };
  occupiedGrid.clear();
  onStatsChanged();
}

export function createPoofParticles(position, colorHex) {
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

export function restoreWorld(data) {
  if (data.b) {
    Object.entries(data.b).forEach(([key, node]) => {
      const code = key.replace(/\d+$/, "");
      const type = TYPE_BY_CODE[code];
      if (!type) return;

      const [cx, cz] = String(node?.c || "").split(",").map(Number);
      if (!Number.isFinite(cx) || !Number.isFinite(cz)) return;

      const extra = { key };
      if (type === "tree" || type === "stone") extra.health = Number.isFinite(node.hl) ? node.hl : 3;
      if (type === "lumbermill") {
        extra.workers = Math.max(0, Math.min(MAX_WORKERS, Number(node.wk) || 0));
        extra.crew = new Set();
      }

      const quadrant = Number.isFinite(node.r) ? ((Math.round(node.r) % 4) + 4) % 4 : 0;
      const entry = instantiateObject(type, cx, cz, sizeFor(type), quadrant * (Math.PI / 2), extra);
      if (entry && type === "lumbermill" && !entry.regrowTimer) entry.regrowTimer = 2;

      buildCounters[type] = Math.max(buildCounters[type] || 0, Number(key.slice(code.length)) || 0);
    });

    // Woodlot membership is geometry, not saved state: any tree standing in a
    // mill's lot belongs to it again after a reload.
    for (const mill of objectsOfType("lumbermill")) {
      const bounds = woodlotBounds(mill);
      for (const tree of objectsOfType("tree")) {
        if (tree.rootX < bounds.x0 || tree.rootX > bounds.x1) continue;
        if (tree.rootZ < bounds.z0 || tree.rootZ > bounds.z1) continue;
        tree.lotId = mill.id;
        (mill.lot || (mill.lot = new Set())).add(tree);
      }
    }
  }

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