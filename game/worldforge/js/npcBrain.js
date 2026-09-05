import { state, updateResourceUI, showNotif, showFloatingText, addResourceClamped } from "./ui.js";
import { playSound } from "./audio.js";
import { createLowPolyNPC, updateNPCAnimation } from "./models/npc.js";
import { updateWatchtowerHover } from "./models/watchtower.js";

export const BUILD_SIZE = 80;
export const HALF_SIZE = BUILD_SIZE / 2;
export const BOUND_MIN = -HALF_SIZE;
export const BOUND_MAX = HALF_SIZE - 1;

const NPC_THOUGHTS = {
  CHOP: ["Harvesting wheat for building.", "Wheat harvest time!"],
  MINE: ["Clang! Stone is heavy today...", "Gathering rocks for walls."],
  DRAW_WATER: ["Cool water, good and fresh.", "Refill for the crops."],
  FARM: ["Crops take time to grow.", "Good food for the village."],
  TRADE: ["Off to the market to trade resources!", "Stocking up supplies."],
  CLIMB: ["Heading up to watch the village!", "Keeping watch."],
  WATCH: ["All clear from up here!", "Looking out for everyone."],
  IDLE: ["Nice day for a walk.", "Taking a breather."]
};

function getRandomThought(cat) {
  const list = NPC_THOUGHTS[cat] || NPC_THOUGHTS.IDLE;
  return list[Math.floor(Math.random() * list.length)];
}

export function tileKey(x, z) { return `c: ${x},${z}`; }
export function worldToGrid(pos) { return { x: Math.floor(pos.x), z: Math.floor(pos.z) }; }
export function gridToWorldCenter(x, z, size = 1) { return new BABYLON.Vector3(x + size * 0.5, 0, z + size * 0.5); }

export function getFootprintTiles(rootX, rootZ, size) {
  const tiles = [];
  for (let dx = 0; dx < size; dx++) {
    for (let dz = 0; dz < size; dz++) {
      tiles.push({ x: rootX + dx, z: rootZ + dz });
    }
  }
  return tiles;
}

export function isFootprintValid(rootX, rootZ, size, occupiedGrid) {
  const tiles = getFootprintTiles(rootX, rootZ, size);
  return tiles.every(
    (t) =>
      t.x >= BOUND_MIN &&
      t.x <= BOUND_MAX &&
      t.z >= BOUND_MIN &&
      t.z <= BOUND_MAX &&
      !occupiedGrid.has(tileKey(t.x, t.z))
  );
}

export function isTileNearStructure(rootX, rootZ, placedObjects, minDistance = 3) {
  for (const obj of placedObjects.values()) {
    const dist = Math.hypot(obj.rootX - rootX, obj.rootZ - rootZ);
    if (dist < minDistance) return true;
  }
  return false;
}

export function findAdjacentFreeTile(rootX, rootZ, size, occupiedGrid) {
  const candidates = [
    { x: rootX - 1, z: rootZ }, { x: rootX + size, z: rootZ },
    { x: rootX, z: rootZ - 1 }, { x: rootX, z: rootZ + size }
  ];
  return candidates.find(
    (n) => n.x >= BOUND_MIN && n.x <= BOUND_MAX && n.z >= BOUND_MIN && n.z <= BOUND_MAX && !occupiedGrid.has(tileKey(n.x, n.z))
  );
}

export function findPath(start, goal, occupiedGrid) {
  if (start.x < BOUND_MIN || start.x > BOUND_MAX || goal.x < BOUND_MIN || goal.x > BOUND_MAX) return null;
  const queue = [{ x: start.x, z: start.z, path: [] }];
  const visited = new Set([tileKey(start.x, start.z)]);
  const dirs = [{ x: 0, z: 1 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === goal.x && current.z === goal.z) return current.path;

    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const nz = current.z + dir.z;
      const key = tileKey(nx, nz);

      if (nx >= BOUND_MIN && nx <= BOUND_MAX && nz >= BOUND_MIN && nz <= BOUND_MAX &&
        !visited.has(key) && (!occupiedGrid.has(key) || (nx === goal.x && nz === goal.z))) {
        visited.add(key);
        queue.push({ x: nx, z: nz, path: [...current.path, { x: nx, z: nz }] });
      }
    }
  }
  return null;
}

export function getMaxNPCCapacity(placedObjects) {
  return Array.from(placedObjects.values()).filter((o) => o.type === "hut").length * 2;
}

const NPC_NAMES = ["Bram", "Kael", "Lyra", "Torn", "Elian", "Mila", "Rowan"];

let npcIdCounter = 0;

export function setNpcIdSeed(n) { npcIdCounter = Math.max(npcIdCounter, n); }
export function nextNpcId() { return String(++npcIdCounter); }

function createNpc(id, scene, pos, overrides = {}) {
  const root = createLowPolyNPC(id, scene);
  root.position.set(pos.x, 0, pos.z);

  // updateNPCs dereferences npc.bubble unguarded, so restored villagers need one too.
  const bubble = document.createElement("div");
  bubble.className = "thought-bubble";
  document.getElementById("thoughtContainer")?.appendChild(bubble);

  return {
    id, root, bubble, path: [], speed: 0.045, a: "IDLE", actionTimer: 0,
    targetObjId: null, stuckTimer: 0, climbProgress: 0, lastPos: root.position.clone(),
    name: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
    hunger: 100, happiness: 100, isStarving: false,
    ...overrides
  };
}

export function spawnNPCFromCampfire(cfPos, activeNPCs, scene, shadowGen) {
  activeNPCs.push(createNpc(nextNpcId(), scene, cfPos));
  showNotif("Villager Joined!", "info");
}

export function restoreNPC(record, activeNPCs, scene) {
  const [cx, cz] = String(record.c || "0,0").split(",").map(Number);
  const overrides = {};
  if (Number.isFinite(record.h)) overrides.hunger = record.h;
  if (Number.isFinite(record.hp)) overrides.happiness = record.hp;
  if (record.n) overrides.name = record.n;

  // If saved state was in the middle of a non-resumable movement or dead target, reset to IDLE so NPC can choose a new task immediately
  overrides.a = "IDLE";
  overrides.actionTimer = 0;
  overrides.path = [];
  overrides.targetObjId = null;
  overrides.pendingAction = null;

  // Center on tile: cx + 0.5, cz + 0.5
  const spawnX = Number.isFinite(cx) ? cx + 0.5 : 0.5;
  const spawnZ = Number.isFinite(cz) ? cz + 0.5 : 0.5;

  const npc = createNpc(
    record.id,
    scene,
    { x: spawnX, z: spawnZ },
    overrides
  );
  activeNPCs.push(npc);
  return npc;
}

export function checkCampfireNPCSymmetry(activeNPCs, placedObjects, scene, shadowGen, updateStats) {
  const campfires = Array.from(placedObjects.values()).filter((o) => o.type === "campfire");
  const maxCap = getMaxNPCCapacity(placedObjects);

  if (campfires.length > 0) {
    const cf = campfires[0];
    const pos = gridToWorldCenter(cf.rootX, cf.rootZ, cf.size);
    while (activeNPCs.length < maxCap) spawnNPCFromCampfire(pos, activeNPCs, scene, shadowGen);
  }

  while (activeNPCs.length > maxCap) {
    const removed = activeNPCs.pop();
    if (removed) {
      if (removed.bubble) removed.bubble.remove();
      removed.root.dispose();
      showNotif("Villager Left", "warn");
    }
  }

  updateResourceUI(activeNPCs.length, maxCap, placedObjects);
  updateStats();
}

export function updateNPCs(deltaTime, activeNPCs, placedObjects, occupiedGrid, scene, camera, engine, removeObjectById) {
  updateWatchtowerHover(scene, placedObjects, gridToWorldCenter);

  placedObjects.forEach((obj) => {
    if (obj.type === "farm") {
      if (obj.growthTimer > 0) {
        obj.growthTimer -= deltaTime;
        if (obj.growthTimer <= 0) { obj.growthTimer = 0; obj.isReady = true; }
      } else if (obj.isReady === undefined) {
        obj.isReady = true;
        obj.growthTimer = 0;
      }
    }
  });

  const activeTowers = [];
  placedObjects.forEach((obj) => {
    if (obj.type === "tower" && obj.isManned) {
      activeTowers.push({ center: gridToWorldCenter(obj.rootX, obj.rootZ, obj.size) });
    }
  });

  activeNPCs.forEach((npc) => {
    if (npc.a === "MANNING_WATCHTOWER") {
      const tower = placedObjects.get(npc.targetObjId);
      if (!tower) {
        npc.a = "IDLE";
        npc.targetObjId = null;
      } else {
        const topPos = gridToWorldCenter(tower.rootX, tower.rootZ, tower.size);
        npc.root.position.set(topPos.x, 3.1, topPos.z);
        updateNPCAnimation(npc, deltaTime);
        return;
      }
    }

    if (npc.a === "CLIMB") {
      npc.climbProgress += deltaTime * 0.8;
      npc.root.position.y = BABYLON.Scalar.Lerp(0, 3.1, npc.climbProgress);

      if (npc.climbProgress >= 1.0) {
        npc.a = "MANNING_WATCHTOWER";
        const tower = placedObjects.get(npc.targetObjId);
        if (tower) tower.isManned = true;
        npc.bubble.textContent = `"${getRandomThought("WATCH")}"`;
        npc.bubble.classList.add("show");
        setTimeout(() => npc.bubble.classList.remove("show"), 3000);
      }
      updateNPCAnimation(npc, deltaTime);
      return;
    }

    npc.hunger = Math.max(0, npc.hunger - deltaTime * 0.35);
    if (npc.hunger < 40) {
      if (state.resources.food > 0) {
        state.resources.food -= 1;
        npc.hunger = 100;
        npc.isStarving = false;
        showFloatingText("-1 Food 🌽", npc.root.position, "#FFD54F", scene, camera, engine);
        updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
      } else if (npc.hunger === 0 && !npc.isStarving) {
        showNotif(`${npc.name} is starving!`, "warn");
        npc.isStarving = true;
      }
    }

    let taskSpeedMult = 1.0;
    for (const tower of activeTowers) {
      if (BABYLON.Vector3.Distance(npc.root.position, tower.center) < 15) {
        taskSpeedMult = 1.8;
        break;
      }
    }

    if (npc.actionTimer > 0) {
      npc.actionTimer -= (deltaTime * taskSpeedMult);

      if (npc.actionTimer <= 0) {
        if (npc.targetObjId) {
          const objData = placedObjects.get(npc.targetObjId);
          if (objData) {
            const pos = npc.root.position.clone();
            if (objData.type === "tree") {
              const gained = addResourceClamped("wh", 4, placedObjects);
              playSound("chop");
              showFloatingText(gained > 0 ? "+4 Wheat 🌾" : "Storage Full!", pos, gained > 0 ? "#81C784" : "#e07263", scene, camera, engine);
              objData.health = (objData.health || 3) - 1;
              if (objData.health <= 0) removeObjectById(npc.targetObjId);
            } else if (objData.type === "stone") {
              const gained = addResourceClamped("stone", 4, placedObjects);
              playSound("mine");
              showFloatingText(gained > 0 ? "+4 Stone 🪨" : "Storage Full!", pos, gained > 0 ? "#E0E0E0" : "#e07263", scene, camera, engine);
              objData.health = (objData.health || 3) - 1;
              if (objData.health <= 0) removeObjectById(npc.targetObjId);
            } else if (objData.type === "farm") {
              const gained = addResourceClamped("food", 20, placedObjects);
              objData.isReady = false;
              objData.growthTimer = 45.0;
              playSound("place");
              showFloatingText(gained > 0 ? "+20 Food 🌽" : "Storage Full!", pos, gained > 0 ? "#FFE082" : "#e07263", scene, camera, engine);
            } else if (objData.type === "well") {
              const gained = addResourceClamped("water", 15, placedObjects);
              playSound("place");
              showFloatingText(gained > 0 ? "+15 Water 💧" : "Storage Full!", pos, gained > 0 ? "#5CC7E6" : "#e07263", scene, camera, engine);
            } else if (objData.type === "market") {
              if (state.resources.wh >= 10 && state.resources.stone >= 10) {
                state.resources.wh -= 10;
                state.resources.stone -= 10;
                addResourceClamped("food", 15, placedObjects);
                addResourceClamped("water", 15, placedObjects);
                playSound("place");
                showFloatingText("Traded Wheat/Stone! 🛒", pos, "#B0BEC5", scene, camera, engine);
              }
            }
            updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
          }
        }
        npc.targetObjId = null;
        npc.a = "IDLE";
      }
      updateNPCAnimation(npc, deltaTime);
      return;
    }

    if (npc.a === "IDLE" && (!npc.path || npc.path.length === 0)) {
      let targetTower = null;
      placedObjects.forEach((obj, id) => {
        if (obj.type === "tower" && !obj.isManned && !targetTower) {
          let beingManned = activeNPCs.some((other) => other.targetObjId === id);
          if (!beingManned) targetTower = { id, obj };
        }
      });

      if (targetTower) {
        const currentG = worldToGrid(npc.root.position);
        const freeTile = findAdjacentFreeTile(targetTower.obj.rootX, targetTower.obj.rootZ, targetTower.obj.size, occupiedGrid);
        if (freeTile) {
          const rawPath = findPath(currentG, freeTile, occupiedGrid);
          if (rawPath !== null) {
            npc.targetObjId = targetTower.id;
            npc.pendingAction = "CLIMB";
            npc.path = rawPath.map((pt) => gridToWorldCenter(pt.x, pt.z, 1));
            npc.bubble.textContent = `"${getRandomThought("CLIMB")}"`;
            npc.bubble.classList.add("show");
            setTimeout(() => npc.bubble.classList.remove("show"), 3000);
            return;
          }
        }
      }

      if (Math.random() < 0.05) {
        const currentG = worldToGrid(npc.root.position);
        let bestCandidate = null;
        let minDist = Infinity;
        const reserved = new Set(activeNPCs.map((o) => o.targetObjId).filter(Boolean));

        placedObjects.forEach((obj, id) => {
          const workable = obj.type === "tree" || obj.type === "stone" || obj.type === "farm" || obj.type === "well" || obj.type === "market";
          if (!workable) return;
          if (reserved.has(id)) return;
          if (obj.type === "farm" && (!obj.isReady || obj.growthTimer > 0)) return;

          const freeTile = findAdjacentFreeTile(obj.rootX, obj.rootZ, obj.size, occupiedGrid);
          if (freeTile) {
            const dist = Math.abs(freeTile.x - currentG.x) + Math.abs(freeTile.z - currentG.z);
            if (dist < minDist) {
              minDist = dist;
              bestCandidate = { id, obj, targetG: freeTile };
            }
          }
        });

        if (bestCandidate) {
          const rawPath = findPath(currentG, bestCandidate.targetG, occupiedGrid);
          if (rawPath !== null) {
            npc.targetObjId = bestCandidate.id;
            const type = bestCandidate.obj.type;
            npc.pendingAction = type === "farm" ? "FARM"
              : type === "stone" ? "MINE"
              : type === "well" ? "DRAW_WATER"
              : type === "market" ? "TRADE"
              : "CHOP";

            npc.bubble.textContent = `"${getRandomThought(npc.pendingAction)}"`;
            npc.bubble.classList.add("show");
            setTimeout(() => npc.bubble.classList.remove("show"), 3000);

            if (rawPath.length > 0) {
              npc.path = rawPath.map((pt) => gridToWorldCenter(pt.x, pt.z, 1));
            } else {
              npc.path = [];
              npc.a = npc.pendingAction || "IDLE";
              npc.actionTimer = 3.5;
            }
          }
        } else {
          // Wander nearby: pick a random adjacent free tile within 3 blocks
          const wanderCandidates = [];
          for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
              if (dx === 0 && dz === 0) continue;
              const tx = currentG.x + dx;
              const tz = currentG.z + dz;
              if (tx >= BOUND_MIN && tx <= BOUND_MAX && tz >= BOUND_MIN && tz <= BOUND_MAX && !occupiedGrid.has(tileKey(tx, tz))) {
                wanderCandidates.push({ x: tx, z: tz });
              }
            }
          }
          if (wanderCandidates.length > 0) {
            const wanderTarget = wanderCandidates[Math.floor(Math.random() * wanderCandidates.length)];
            const rawPath = findPath(currentG, wanderTarget, occupiedGrid);
            if (rawPath && rawPath.length > 0) {
              npc.path = rawPath.map((pt) => gridToWorldCenter(pt.x, pt.z, 1));
              npc.pendingAction = "IDLE";
            }
          }
        }
      }
    }

    // Stuck detection: if NPC spawned or ended up inside an obstacle tile (e.g. from restored coordinates), teleport to nearest free tile
    const curTile = worldToGrid(npc.root.position);
    const curKey = tileKey(curTile.x, curTile.z);
    if (occupiedGrid.has(curKey)) {
      const freeTile = findAdjacentFreeTile(curTile.x, curTile.z, 1, occupiedGrid);
      if (freeTile) {
        const center = gridToWorldCenter(freeTile.x, freeTile.z, 1);
        npc.root.position.x = center.x;
        npc.root.position.z = center.z;
        npc.path = [];
        npc.a = "IDLE";
      }
    }

    if (npc.path && npc.path.length > 0) {
      npc.a = "WALK";
      const targetWorld = npc.path[0];
      const dx = targetWorld.x - npc.root.position.x;
      const dz = targetWorld.z - npc.root.position.z;
      const dist = Math.hypot(dx, dz);

      // Track movement to prevent infinite walk into a newly placed building
      if (npc.lastPos && Math.hypot(npc.root.position.x - npc.lastPos.x, npc.root.position.z - npc.lastPos.z) < 0.005) {
        npc.stuckTimer = (npc.stuckTimer || 0) + deltaTime;
        if (npc.stuckTimer > 2.0) {
          npc.path = [];
          npc.a = "IDLE";
          npc.stuckTimer = 0;
        }
      } else {
        npc.stuckTimer = 0;
        npc.lastPos = npc.root.position.clone();
      }

      if (dist < 0.15) {
        npc.path.shift();
        if (npc.path.length === 0) {
          if (npc.pendingAction === "CLIMB") {
            npc.a = "CLIMB";
            npc.climbProgress = 0;
          } else {
            npc.a = npc.pendingAction || "IDLE";
            npc.actionTimer = 3.5;
          }
        }
      } else {
        npc.root.position.x += (dx / dist) * npc.speed;
        npc.root.position.z += (dz / dist) * npc.speed;
        npc.root.rotation.y = Math.atan2(dx, dz);
      }
    }

    if (npc.bubble && camera && engine) {
      const proj = BABYLON.Vector3.Project(
        npc.root.position.add(new BABYLON.Vector3(0, 1.8, 0)),
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
        camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
      );
      npc.bubble.style.left = `${proj.x}px`;
      npc.bubble.style.top = `${proj.y}px`;
    }

    updateNPCAnimation(npc, deltaTime);
  });
}