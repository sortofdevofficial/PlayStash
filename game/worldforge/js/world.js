--- START OF FILE world.js ---

import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { createWallSegment, createGate } from "./models/wall.js";
import { envMaterials, createLowPolyTree, createLowPolyStone, shadowGen } from "./environment.js";
import {
  BOUND_MIN, BOUND_MAX, tileKey, gridToWorldCenter,
  getFootprintTiles, isFootprintValid, isTileNearStructure, restoreNPC, setNpcIdSeed
} from "./npcBrain.js";
import { state, showNotif, getResourceCap, RESOURCE_NAMES } from "./ui.js";
import { playSound } from "./audio.js";
import { RESOURCE_KEY_BY_SHORT, TYPE_BY_CODE, markDirty } from "./db.js";

const ONE_TILE_TYPES = new Set(["campfire", "well", "wall", "gate", "stone"]);
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
  if (type === "market") return createMarket(objId, scene);
  if (type === "wall") return createWallSegment(objId, scene);
  return createGate(objId, scene);
}

export function instantiateObject(type, rootX, rootZ, size, rotation = 0, extra = {}) {
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

export function spawnRandomWildernessNode() {
  const currentNodes = Array.from(placedObjects.values()).filter((o) => o.type === "tree" || o.type === "stone").length;
  if (currentNodes >= 35) return;

  const rx = Math.floor(Math.random() * (BOUND_MAX - BOUND_MIN - 2)) + BOUND_MIN + 1;
  const rz = Math.floor(Math.random() * (BOUND_MAX - BOUND_MIN - 2)) + BOUND_MIN + 1;

  if (!isFootprintValid(rx, rz, 2, occupiedGrid) || isTileNearStructure(rx, rz, placedObjects, 3)) return;

  const type = Math.random() > 0.5 ? "tree" : "stone";
  instantiateObject(type, rx, rz, sizeFor(type), 0, { health: 3 });
  markDirty();
  onStatsChanged();
}

export function placeObject(rootX, rootZ) {
  const cost = state.BUILD_COSTS[state.buildType];
  const shortfall = Object.keys(cost).find((key) => (state.resources[key] || 0) < cost[key]);
  
  if (shortfall) {
    // Convert technical key (e.g., 'wh') to friendly name (e.g., 'Wheat')
    const friendlyName = RESOURCE_NAMES[shortfall] || shortfall;
    return showNotif(`Not enough ${friendlyName}!`, "warn");
  }

  const size = getFootprintSize();
  if (!isFootprintValid(rootX, rootZ, size, occupiedGrid)) return showNotif("Tile Blocked!", "warn");

  Object.keys(cost).forEach((key) => { state.resources[key] -= cost[key]; });

  const entry = instantiateObject(state.buildType, rootX, rootZ, size, state.buildRotation);

  playSound("place");
  createPoofParticles(entry.root.position, "#E6DCCE");

  markDirty();
  onStatsChanged();
  showNotif(`Placed ${state.buildType}`);
  return entry;
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

export function removeObjectById(objId, onHoveredCleared) {
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

  if (onHoveredCleared) onHoveredCleared(objId);
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

      const quadrant = Number.isFinite(node.r) ? ((Math.round(node.r) % 4) + 4) % 4 : 0;
      instantiateObject(type, cx, cz, sizeFor(type), quadrant * (Math.PI / 2), extra);

      buildCounters[type] = Math.max(buildCounters[type] || 0, Number(key.slice(code.length)) || 0);
    });
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