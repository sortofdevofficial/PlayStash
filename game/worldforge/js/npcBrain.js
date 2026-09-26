import { state, updateResourceUI, showNotif, showFloatingText, addResourceClamped } from "./ui.js";
import { playSound } from "./audio.js";
import { createLowPolyNPC, updateNPCAnimation } from "./models/npc.js";
import { updateWatchtowerHover } from "./models/watchtower.js";
import { tickGate, GATE_TRIGGER } from "./models/wall.js";
import { camera as viewCamera } from "./environment.js";

export const BUILD_SIZE = 80;
export const HALF_SIZE = BUILD_SIZE / 2;
export const BOUND_MIN = -HALF_SIZE;
export const BOUND_MAX = HALF_SIZE - 1;

const NPC_THOUGHTS = {
  CHOP: ["Harvesting wood for building.", "Wood harvest time!"],
  MINE: ["Clang! Stone is heavy today...", "Gathering rocks for walls."],
  DRAW_WATER: ["Cool water, good and fresh.", "Refill for the crops."],
  FARM: ["Crops take time to grow.", "Good food for the village."],
  TRADE: ["Off to the market to trade resources!", "Stocking up supplies."],
  CLIMB: ["Heading up to watch the village!", "Keeping watch."],
  MILLING: ["Saw's sharp, timber's stacked.", "Waiting on the next sprout."],
  WATCH: ["All clear from up here!", "Looking out for everyone."],
  IDLE: ["Nice day for a walk.", "Taking a breather."],
  DYING: ["This is not good...", "I need help..."]
};

function getRandomThought(cat) {
  const list = NPC_THOUGHTS[cat] || NPC_THOUGHTS.IDLE;
  return list[Math.floor(Math.random() * list.length)];
}

const THOUGHT_COOLDOWN_SECONDS = 12;
function setThought(npc, category) {
  const now = performance.now() / 1000;
  if (npc.lastThoughtAt && now - npc.lastThoughtAt < THOUGHT_COOLDOWN_SECONDS) return;
  npc.lastThought = getRandomThought(category);
  npc.lastThoughtAt = now;
}

// Natural disasters (visual effects + damage) now live in environment.js's
// disaster scheduler and the nd/*.js modules, started once from index.js.
// This file kept its own separate damage-only implementation with no visuals,
// duplicating and slightly diverging from that system (e.g. it never
// disposed/respawned NPCs it killed) - removed in favor of the one system.

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

export function findAdjacentFreeTile(rootX, rootZ, size, occupiedGrid, npcPos = { x: 0, z: 0 }) {
  const candidates = [
    { x: rootX - 1, z: rootZ },
    { x: rootX + size, z: rootZ },
    { x: rootX, z: rootZ - 1 },
    { x: rootX, z: rootZ + size }
  ];

  const validTiles = candidates.filter(
    (n) => n.x >= BOUND_MIN && n.x <= BOUND_MAX && n.z >= BOUND_MIN && n.z <= BOUND_MAX && !occupiedGrid.has(tileKey(n.x, n.z))
  );

  if (validTiles.length === 0) return null;

  return validTiles.reduce((prev, curr) => {
    const distPrev = Math.abs(prev.x - npcPos.x) + Math.abs(prev.z - npcPos.z);
    const distCurr = Math.abs(curr.x - npcPos.x) + Math.abs(curr.z - npcPos.z);
    return distCurr < distPrev ? curr : prev;
  });
}

export function findPath(start, goal, occupiedGrid) {
  if (start.x < BOUND_MIN || start.x > BOUND_MAX || goal.x < BOUND_MIN || goal.x > BOUND_MAX) return null;
  if (start.x === goal.x && start.z === goal.z) return [];

  const gates = passableGateTiles();
  const startKey = tileKey(start.x, start.z);
  // Parent pointers instead of a path array per node: the old version copied
  // every node's whole path when queueing it, which made a single failed search
  // allocate more objects than the rest of the frame put together.
  const parent = new Map([[startKey, null]]);
  const queue = [start];
  const dirs = [{ x: 0, z: 1 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 }];

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current.x === goal.x && current.z === goal.z) {
      const path = [];
      let key = tileKey(current.x, current.z);
      while (key !== startKey) {
        const [x, z] = key.slice(3).split(",").map(Number);
        path.push({ x, z });
        key = parent.get(key);
      }
      path.reverse();
      return path;
    }

    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const nz = current.z + dir.z;
      const key = tileKey(nx, nz);

      if (nx >= BOUND_MIN && nx <= BOUND_MAX && nz >= BOUND_MIN && nz <= BOUND_MAX &&
        !parent.has(key) && (!occupiedGrid.has(key) || gates.has(key) || (nx === goal.x && nz === goal.z))) {
        parent.set(key, tileKey(current.x, current.z));
        queue.push({ x: nx, z: nz });
      }
    }
  }
  return null;
}

// Every placed object registers under its type so per-frame systems can
// iterate just the farms, towers or mills instead of the whole world.
const typeIndex = new Map();
const NO_OBJECTS = new Set();

export function objectsOfType(type) { return typeIndex.get(type) || NO_OBJECTS; }

// A gate has to stop the player building on its tile but must not stop a
// villager walking through it, and occupiedGrid is the one grid that does both.
// Pathfinding gets this exception list instead; everything else still treats the
// tile as taken.
let gateTiles = new Set();
let gateTilesDirty = true;

function passableGateTiles() {
  if (!gateTilesDirty) return gateTiles;
  gateTilesDirty = false;
  gateTiles.clear();
  for (const gate of objectsOfType("gate")) gateTiles.add(tileKey(gate.rootX, gate.rootZ));
  return gateTiles;
}

// Types an unassigned villager may seek out to work on.
const WORKABLE_TYPES = ["tree", "stone", "farm", "well", "market"];

export function indexObject(entry) {
  let set = typeIndex.get(entry.type);
  if (!set) { set = new Set(); typeIndex.set(entry.type, set); }
  set.add(entry);
  if (entry.type === "gate") gateTilesDirty = true;
}

export function unindexObject(entry) {
  const set = typeIndex.get(entry.type);
  if (set) set.delete(entry);
  if (entry.type === "gate") gateTilesDirty = true;
}

export function getMaxNPCCapacity(placedObjects) {
  return Array.from(placedObjects.values()).filter((o) => o.type === "hut").length * 2;
}

const NPC_NAMES = ["Bram", "Kael", "Lyra", "Torn", "Elian", "Mila", "Rowan"];
export const WALK_SPEED = 7.2;   // tiles/second; the walk cycle derives its rate from this

let npcIdCounter = 0;
export function setNpcIdSeed(n) { npcIdCounter = Math.max(npcIdCounter, n); }
export function nextNpcId() { return String(++npcIdCounter); }

function createNpc(id, scene, pos, overrides = {}) {
  const root = createLowPolyNPC(id, scene);
  root.position.set(pos.x, 0, pos.z);

  return {
    id, root, path: [], speed: WALK_SPEED, a: "IDLE", actionTimer: 0,
    targetObjId: null, stuckTimer: 0, climbProgress: 0, lastPos: root.position.clone(),
    progressAt: 0, progressPos: root.position.clone(),
    name: overrides.name || NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
    hunger: 100, happiness: 100, health: 100, isStarving: false, isDead: false,
    respawning: false,
    lastThought: null, lastThoughtAt: 0,
    ...overrides
  };
}

export function spawnNPCFromCampfire(cfPos, activeNPCs, scene, shadowGen) {
  activeNPCs.push(createNpc(nextNpcId(), scene, cfPos));
  showNotif("NPC Joined!", "info");
}

export function restoreNPC(record, activeNPCs, scene) {
  const [cx, cz] = String(record.c || "0,0").split(",").map(Number);
  const overrides = {};
  if (Number.isFinite(record.h)) overrides.hunger = record.h;
  if (Number.isFinite(record.hp)) overrides.happiness = record.hp;
  if (Number.isFinite(record.health)) overrides.health = record.health;
  if (record.n) overrides.name = record.n;

  overrides.a = "IDLE";
  overrides.actionTimer = 0;
  overrides.path = [];
  overrides.targetObjId = null;
  overrides.pendingAction = null;

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
      removed.respawning = false;
      removed.isDead = true;
      if (removed.root) removed.root.dispose();
      showNotif("NPC Left", "warn");
    }
  }

  updateResourceUI(activeNPCs.length, maxCap, placedObjects);
  if (typeof updateStats === "function") updateStats();
}

// How long a villager may keep trying to walk without covering any ground before
// it is sent back to camp. A couple of seconds of not moving is a normal shove
// from the crowd and only costs it the path; six means it is genuinely wedged.
const STUCK_RESPAWN_S = 6;

function respawnExactNPC(npc, scene, camera, engine, placedObjects, cause = "died") {
  npc.respawning = true;
  setThought(npc, "DYING");
  showNotif(
    cause === "stuck"
      ? `${npc.name} got stuck! Returning to camp...`
      : `${npc.name} died! Respawning in 3 seconds...`,
    "warn"
  );

  setTimeout(() => {
    if (!npc.respawning) return;

    let spawnPos = { x: 0.5, z: 0.5 };
    const campfires = Array.from(placedObjects.values()).filter(o => o.type === "campfire");
    if (campfires.length > 0) {
      const cf = campfires[0];
      const pos = gridToWorldCenter(cf.rootX, cf.rootZ, cf.size);
      spawnPos = { x: pos.x, z: pos.z };
    }

    if (npc.root) {
      npc.root.dispose();
    }
    const newRoot = createLowPolyNPC(npc.id, scene);
    newRoot.position.set(spawnPos.x, 0, spawnPos.z);

    npc.root = newRoot;
    npc.health = 100;
    npc.hunger = 100;
    npc.happiness = 100;
    npc.isStarving = false;
    npc.isDead = false;
    npc.respawning = false;
    npc.a = "IDLE";
    npc.path = [];
    npc.targetObjId = null;
    npc.actionTimer = 0;
    npc.climbProgress = 0;
    npc.stuckTimer = 0;
    npc.lastPos = newRoot.position.clone();
    npc.progressAt = 0;
    npc.progressPos = newRoot.position.clone();

    showFloatingText(`${npc.name} Respawned!`, newRoot.position, "#00FF7F", scene, camera, engine);
    showNotif(`${npc.name} has respawned!`, "info");
  }, 3000);
}

// ============================================================
// LUMBERMILL CREW
// The player decides how many villagers staff a mill, so a hired one works
// only its lot and skips the random roll every other job goes through. That is
// what makes "assign more workers" mean "timber arrives faster": N crew fell N
// trees at the same time instead of one villager cycling the whole map.
// ============================================================
function walkToJob(npc, objId, targetG, currentG, occupiedGrid, action) {
  const rawPath = findPath(currentG, targetG, occupiedGrid);
  if (rawPath === null) return false;

  npc.targetObjId = objId;
  npc.pendingAction = action;
  setThought(npc, action);

  if (rawPath.length > 0) {
    npc.path = rawPath.map((pt) => gridToWorldCenter(pt.x, pt.z, 1));
  } else {
    npc.path = [];
    npc.a = action;
    npc.actionTimer = 3.5;
  }
  return true;
}

function nearestLotTree(npc, mill, currentG, activeNPCs, placedObjects, occupiedGrid) {
  if (!mill.lot) return null;
  let best = null;
  let minDist = Infinity;

  for (const tree of mill.lot) {
    if (!placedObjects.has(tree.id)) {
      mill.lot.delete(tree);
      continue;
    }
    const taken = activeNPCs.some((o) => o !== npc && o.targetObjId === tree.id);
    if (taken) continue;

    const freeTile = findAdjacentFreeTile(tree.rootX, tree.rootZ, tree.size, occupiedGrid, currentG);
    if (!freeTile) continue;
    const dist = Math.abs(freeTile.x - currentG.x) + Math.abs(freeTile.z - currentG.z);
    if (dist < minDist) {
      minDist = dist;
      best = { treeId: tree.id, targetG: freeTile };
    }
  }
  return best;
}

function standByMill(npc, mill, currentG, occupiedGrid) {
  const tile = findAdjacentFreeTile(mill.rootX, mill.rootZ, mill.size, occupiedGrid, currentG);
  if (tile) walkToJob(npc, mill.id, tile, currentG, occupiedGrid, "MILLING");
}

function hireableMill() {
  for (const mill of objectsOfType("lumbermill")) {
    if (!mill.crew) mill.crew = new Set();
    if (mill.crew.size < (mill.workers || 0)) return mill;
  }
  return null;
}

// Villagers spawn on the campfire's own tile and aim at shared waypoint
// centres, so without a nudge they pile into one another and read as a single
// sprite. Half this each way still leaves a pair shoulder to shoulder.
const NPC_SEPARATION = 0.55;

function canNudge(npc) {
  return npc.root && !npc.isDead && !npc.respawning
    && npc.a !== "CLIMB" && npc.a !== "MANNING_WATCHTOWER";
}

// The stranded-tile rescue would teleport a villager shoved into a wall straight
// out of it, which reads as a stutter - so a push that lands on blocked
// ground is simply dropped.
function slide(root, ox, oz, occupiedGrid) {
  const tx = root.position.x + ox;
  const tz = root.position.z + oz;
  if (occupiedGrid.has(tileKey(Math.floor(tx), Math.floor(tz)))) return;
  root.position.x = tx;
  root.position.z = tz;
}

function separateNPCs(activeNPCs, occupiedGrid) {
  for (let i = 0; i < activeNPCs.length; i++) {
    const a = activeNPCs[i];
    if (!canNudge(a)) continue;
    for (let j = i + 1; j < activeNPCs.length; j++) {
      const b = activeNPCs[j];
      if (!canNudge(b)) continue;

      const dx = b.root.position.x - a.root.position.x;
      const dz = b.root.position.z - a.root.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= NPC_SEPARATION * NPC_SEPARATION) continue;

      // Perfectly stacked (the usual starting position) has no direction to
      // separate along, so give them one.
      if (d2 < 1e-6) {
        slide(a.root, -NPC_SEPARATION * 0.5, 0, occupiedGrid);
        slide(b.root, NPC_SEPARATION * 0.5, 0, occupiedGrid);
        continue;
      }

      const push = (NPC_SEPARATION - Math.sqrt(d2)) * 0.5;
      const ox = (dx / Math.sqrt(d2)) * push;
      const oz = (dz / Math.sqrt(d2)) * push;
      slide(a.root, -ox, -oz, occupiedGrid);
      slide(b.root, ox, oz, occupiedGrid);
    }
  }
}

function crowdBlocker(x, z, self, activeNPCs) {
  for (const other of activeNPCs) {
    if (other === self || !canNudge(other)) continue;
    const ox = other.root.position.x - x;
    const oz = other.root.position.z - z;
    if (ox * ox + oz * oz < NPC_SEPARATION * NPC_SEPARATION) return other;
  }
  return null;
}

// Which way a villager yields. Picking the side from its own heading mirrors on
// an approaching pair - both step to the same world side and then slide along
// abreast forever, which is the deadlock that used to look like a freeze. So the
// pair decides between them: the lower id goes right, the other left.
function dodgeSide(self, other) {
  const a = Number(self.id);
  const b = Number(other && other.id);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return 1;
  return a < b ? 1 : -1;
}

// Squared distance to the nearest neighbour. In a jam every lane has somebody
// in it, so a binary blocked/free test makes a villager flip between two equally
// bad choices and crawl; scoring lanes by clear space lets the crowd flow.
function clearance2(x, z, self, activeNPCs) {
  let best = Infinity;
  for (const other of activeNPCs) {
    if (other === self || !canNudge(other)) continue;
    const ox = other.root.position.x - x;
    const oz = other.root.position.z - z;
    const d2 = ox * ox + oz * oz;
    if (d2 < best) best = d2;
  }
  return best;
}

// Walking straight into a neighbour ends in a push-war neither villager can
// win - separation undoes the step every frame and they jitter in place
// forever. A blocked step therefore veers into the emptiest walkable lane, and
// holding still is left as the very last resort: measured head-on, both
// villagers refused every lane the other stood in and froze for seconds at a
// time. Squeezing past a crowded lane costs a shove from separation, which is
// cheap next to standing there.
function crowdStep(npc, ux, uz, step, occupiedGrid, activeNPCs) {
  const x0 = npc.root.position.x;
  const z0 = npc.root.position.z;
  const rel = (px, pz) => ({ x: px - x0, z: pz - z0 });
  const walkable = (px, pz) => !occupiedGrid.has(tileKey(Math.floor(px), Math.floor(pz)));
  // side 0 walks straight on; the others veer 45 degrees and stay unit length,
  // so a dodge clears the neighbour quickly without losing much ground.
  const laneAt = (side) => {
    let lx = ux;
    let lz = uz;
    if (side !== 0) {
      lx = ux - uz * side;
      lz = uz + ux * side;
      const len = Math.hypot(lx, lz) || 1;
      lx /= len;
      lz /= len;
    }
    return { x: x0 + lx * step, z: z0 + lz * step };
  };

  const straight = laneAt(0);
  if (walkable(straight.x, straight.z) && !crowdBlocker(straight.x, straight.z, npc, activeNPCs)) {
    return rel(straight.x, straight.z);
  }

  const blocker = crowdBlocker(straight.x, straight.z, npc, activeNPCs);
  if (blocker) npc.dodgeId = blocker.id;

  // Hold the dodge until the pair is properly past each other. Path steering
  // pulls a villager back onto its route the instant separation clears, so
  // without this the pair dodges, converges, dodges again, and crawls.
  if (npc.dodgeId) {
    const held = activeNPCs.find((o) => o.id === npc.dodgeId);
    const hd = held
      ? (held.root.position.x - x0) * (held.root.position.x - x0) + (held.root.position.z - z0) * (held.root.position.z - z0)
      : Infinity;
    if (!held || hd > NPC_SEPARATION * NPC_SEPARATION * 6.5) {
      npc.dodgeId = null;
    } else {
      const p = laneAt(dodgeSide(npc, held));
      if (walkable(p.x, p.z)) return rel(p.x, p.z);
    }
  }

  const sides = blocker ? [dodgeSide(npc, blocker), -dodgeSide(npc, blocker)] : [1, -1];

  // Straight is out: it was already rejected above, and letting it compete here
  // makes an abreast pair walk into each other every frame. The bonus on the
  // agreed side keeps near-ties committed to one lane instead of flip-flopping.
  let best = null;
  let bestScore = -Infinity;
  for (const side of sides) {
    const p = laneAt(side);
    if (!walkable(p.x, p.z)) continue;
    const score = clearance2(p.x, p.z, npc, activeNPCs) + (side === sides[0] ? NPC_SEPARATION * NPC_SEPARATION * 0.25 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best ? rel(best.x, best.z) : { x: 0, z: 0 };
}

// A villager shoved into a one-tile gap has no free neighbour at all, and the
// old rescue simply gave up there - leaving it standing inside a wall with an
// empty path and nothing left to cancel. Widen the ring until something free
// turns up; the world edge is far from any build, so this always terminates.
function nearestFreeTile(x, z, occupiedGrid, maxRing = 6) {
  for (let r = 2; r <= maxRing; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (nx < BOUND_MIN || nx > BOUND_MAX || nz < BOUND_MIN || nz > BOUND_MAX) continue;
        if (!occupiedGrid.has(tileKey(nx, nz))) return { x: nx, z: nz };
      }
    }
  }
  return null;
}

// A gate only swings for someone actually crossing it, so the trigger is a
// radius around the doorway rather than a whole tile block. The hold keeps the
// leaves from starting shut while the last villager is still in the gap.
const GATE_HOLD_S = 0.7;

function tickGates(deltaTime, activeNPCs) {
  const gates = objectsOfType("gate");
  if (gates.size === 0) return;
  const reach2 = GATE_TRIGGER * GATE_TRIGGER;

  for (const gate of gates) {
    if (!gate.root) continue;
    const center = gridToWorldCenter(gate.rootX, gate.rootZ, gate.size);

    let near = false;
    for (const npc of activeNPCs) {
      if (!canNudge(npc)) continue;
      const dx = npc.root.position.x - center.x;
      const dz = npc.root.position.z - center.z;
      if (dx * dx + dz * dz < reach2) { near = true; break; }
    }

    // The player has no avatar here - the orbit target is where they are - so
    // looking at a doorway swings it too, on a slightly wider radius than the
    // villagers get so the leaves are already moving as it comes into view.
    if (!near && viewCamera) {
      const dx = viewCamera.target.x - center.x;
      const dz = viewCamera.target.z - center.z;
      const focus2 = GATE_TRIGGER * 2.2;
      if (dx * dx + dz * dz < focus2 * focus2) near = true;
    }

    gate.gateHold = near ? GATE_HOLD_S : Math.max(0, (gate.gateHold || 0) - deltaTime);
    tickGate(gate.root, near || gate.gateHold > 0, deltaTime);
  }
}

export function updateNPCs(deltaTime, activeNPCs, placedObjects, occupiedGrid, scene, camera, engine, removeObjectById) {
  updateWatchtowerHover(scene, placedObjects, gridToWorldCenter);

  for (const obj of objectsOfType("farm")) {
    if (obj.growthTimer > 0) {
      obj.growthTimer -= deltaTime;
      if (obj.growthTimer <= 0) { obj.growthTimer = 0; obj.isReady = true; }
    } else if (obj.isReady === undefined) {
      obj.isReady = true;
      obj.growthTimer = 0;
    }
  }

  const activeTowers = [];
  for (const obj of objectsOfType("tower")) {
    if (obj.isManned) activeTowers.push({ center: gridToWorldCenter(obj.rootX, obj.rootZ, obj.size) });
  }

  // Natural disasters are now driven by environment.js's scheduler (started
  // once from index.js), which calls into the nd/*.js trigger() functions -
  // those apply damage the same way the old code here did, but through a
  // single system that also owns the matching visual effect.

  activeNPCs.forEach((npc) => {
    if (npc.isDead || npc.respawning) {
      return;
    }

    if (npc.health <= 0) {
      npc.isDead = true;
      if (npc.root) {
        npc.root.dispose();
      }
      respawnExactNPC(npc, scene, camera, engine, placedObjects);
      return;
    }

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
      if (npc.targetObjId) {
        const tower = placedObjects.get(npc.targetObjId);
        if (tower) {
          const towerPos = gridToWorldCenter(tower.rootX, tower.rootZ, tower.size);
          const dx = towerPos.x - npc.root.position.x;
          const dz = towerPos.z - npc.root.position.z;
          npc.root.rotation.y = Math.atan2(dx, dz);
        }
      }

      npc.climbProgress += deltaTime * 0.8;
      npc.root.position.y = BABYLON.Scalar.Lerp(0, 3.1, npc.climbProgress);

      if (npc.climbProgress >= 1.0) {
        npc.a = "MANNING_WATCHTOWER";
        const tower = placedObjects.get(npc.targetObjId);
        if (tower) tower.isManned = true;
        setThought(npc, "WATCH");
      }
      updateNPCAnimation(npc, deltaTime);
      return;
    }

    npc.hunger = Math.max(0, npc.hunger - deltaTime * 0.35);
    if (npc.hunger < 40) {
      npc.happiness = Math.max(0, npc.happiness - deltaTime * 2.5);
      if (state.resources.food > 0) {
        state.resources.food -= 1;
        npc.hunger = 100;
        npc.isStarving = false;
        npc.happiness = Math.min(100, npc.happiness + 12);
        showFloatingText("-1 Food [food]", npc.root.position, "#FFD54F", scene, camera, engine);
        updateResourceUI(activeNPCs.length, getMaxNPCCapacity(placedObjects), placedObjects);
      } else if (npc.hunger <= 0) {
        if (!npc.isStarving) {
          showNotif(`${npc.name} is starving!`, "warn");
          npc.isStarving = true;
        }
        npc.health = Math.max(0, npc.health - deltaTime * 8);
        if (npc.health <= 0) {
          npc.isDead = true;
          if (npc.root) npc.root.dispose();
          respawnExactNPC(npc, scene, camera, engine, placedObjects);
          return;
        }
      }
    } else {
      npc.happiness = Math.min(100, npc.happiness + deltaTime * 1.2);
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

      if (npc.targetObjId) {
        const objData = placedObjects.get(npc.targetObjId);
        if (objData) {
          const targetPos = gridToWorldCenter(objData.rootX, objData.rootZ, objData.size);
          const dx = targetPos.x - npc.root.position.x;
          const dz = targetPos.z - npc.root.position.z;
          npc.root.rotation.y = Math.atan2(dx, dz);
        }
      }

      if (npc.actionTimer <= 0) {
        if (npc.targetObjId) {
          const objData = placedObjects.get(npc.targetObjId);
          if (objData) {
            const pos = npc.root.position.clone();
            if (objData.type === "tree") {
              const gained = addResourceClamped("wh", 4, placedObjects);
              playSound("chop");
              showFloatingText(gained > 0 ? "+4 Wood [wood]" : "Storage Full!", pos, gained > 0 ? "#81C784" : "#e07263", scene, camera, engine);
              if (objData.lotId) {
                const owner = placedObjects.get(objData.lotId);
                if (owner) owner.chopped = (owner.chopped || 0) + 1;
              }
              objData.health = (objData.health || 3) - 1;
              if (objData.health <= 0) removeObjectById(npc.targetObjId);
            } else if (objData.type === "stone") {
              const gained = addResourceClamped("stone", 4, placedObjects);
              playSound("mine");
              showFloatingText(gained > 0 ? "+4 Stone [stone]" : "Storage Full!", pos, gained > 0 ? "#E0E0E0" : "#e07263", scene, camera, engine);
              objData.health = (objData.health || 3) - 1;
              if (objData.health <= 0) removeObjectById(npc.targetObjId);
            } else if (objData.type === "farm") {
              const gained = addResourceClamped("food", 20, placedObjects);
              objData.isReady = false;
              objData.growthTimer = 45.0;
              playSound("place");
              showFloatingText(gained > 0 ? "+20 Food [food]" : "Storage Full!", pos, gained > 0 ? "#FFE082" : "#e07263", scene, camera, engine);
            } else if (objData.type === "well") {
              const gained = addResourceClamped("water", 15, placedObjects);
              playSound("place");
              showFloatingText(gained > 0 ? "+15 Water [water]" : "Storage Full!", pos, gained > 0 ? "#5CC7E6" : "#e07263", scene, camera, engine);
            } else if (objData.type === "market") {
              if (state.resources.wh >= 5 || state.resources.stone >= 5) {
                if (state.resources.wh >= 5) {
                  state.resources.wh -= 5;
                  if (state.resources.food <= state.resources.water) {
                    addResourceClamped("food", 12, placedObjects);
                    showFloatingText("+12 Food [food] (Traded Wood)", pos, "#B0BEC5", scene, camera, engine);
                  } else {
                    addResourceClamped("water", 12, placedObjects);
                    showFloatingText("+12 Water [water] (Traded Wood)", pos, "#B0BEC5", scene, camera, engine);
                  }
                } else {
                  state.resources.stone -= 5;
                  if (state.resources.food <= state.resources.water) {
                    addResourceClamped("food", 12, placedObjects);
                    showFloatingText("+12 Food [food] (Traded Stone)", pos, "#B0BEC5", scene, camera, engine);
                  } else {
                    addResourceClamped("water", 12, placedObjects);
                    showFloatingText("+12 Water [water] (Traded Stone)", pos, "#B0BEC5", scene, camera, engine);
                  }
                }
                playSound("place");
              } else if (state.resources.food >= 15) {
                state.resources.food -= 10;
                addResourceClamped("wh", 8, placedObjects);
                playSound("place");
                showFloatingText("+8 Wood [wood] (Traded Food)", pos, "#B0BEC5", scene, camera, engine);
              } else if (state.resources.water >= 15) {
                state.resources.water -= 10;
                addResourceClamped("stone", 8, placedObjects);
                playSound("place");
                showFloatingText("+8 Stone [stone] (Traded Water)", pos, "#B0BEC5", scene, camera, engine);
              } else {
                showFloatingText("No goods to trade!", pos, "#e07263", scene, camera, engine);
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

    // Both nets run before the job search on purpose: the branches below return
    // early for hired crew and tower climbers, and those are exactly the
    // villagers that end up wedged. Dropping a path only helps one that can
    // still walk, so six seconds without covering ground sends it home instead
    // of leaving it standing there forever.
    const curTile = worldToGrid(npc.root.position);
    const curKey = tileKey(curTile.x, curTile.z);
    if (occupiedGrid.has(curKey) && !passableGateTiles().has(curKey)) {
      const goal = npc.path[0] || npc.root.position;
      const freeTile = findAdjacentFreeTile(curTile.x, curTile.z, 1, occupiedGrid, goal)
        || nearestFreeTile(curTile.x, curTile.z, occupiedGrid);
      if (freeTile) {
        const center = gridToWorldCenter(freeTile.x, freeTile.z, 1);
        npc.root.position.x = center.x;
        npc.root.position.z = center.z;
        npc.path = [];
        npc.a = "IDLE";
      }
    }

    if (canNudge(npc)) {
      const nowS = performance.now() / 1000;
      if (!npc.progressAt) {
        npc.progressAt = nowS;
        npc.progressPos = npc.root.position.clone();
      } else if (Math.hypot(npc.root.position.x - npc.progressPos.x, npc.root.position.z - npc.progressPos.z) > 1.2) {
        npc.progressAt = nowS;
        npc.progressPos = npc.root.position.clone();
      } else if (nowS - npc.progressAt > STUCK_RESPAWN_S) {
        npc.progressAt = nowS;
        npc.progressPos = npc.root.position.clone();
        respawnExactNPC(npc, scene, camera, engine, placedObjects, "stuck");
        return;
      }
    }

    if (npc.a === "IDLE" && (!npc.path || npc.path.length === 0)) {
      const currentG = worldToGrid(npc.root.position);

      if (npc.employer) {
        const mill = placedObjects.get(npc.employer);
        if (!mill || mill.type !== "lumbermill" || !mill.crew.has(npc.id)) {
          npc.employer = null;
        } else {
          const job = nearestLotTree(npc, mill, currentG, activeNPCs, placedObjects, occupiedGrid);
          if (job && walkToJob(npc, job.treeId, job.targetG, currentG, occupiedGrid, "CHOP")) return;
          // Unreachable or bare lot: throttle, or every blocked crew member
          // would search the whole field every frame looking for work.
          const now = performance.now() / 1000;
          if (now >= (npc.jobRetryAt || 0)) {
            npc.jobRetryAt = now + 0.5;
            standByMill(npc, mill, currentG, occupiedGrid);
          }
          return;
        }
      } else {
        const opening = hireableMill();
        if (opening) {
          opening.crew.add(npc.id);
          npc.employer = opening.id;
          return;
        }
      }

      let targetTower = null;
      for (const obj of objectsOfType("tower")) {
        if (obj.isManned) continue;
        if (!activeNPCs.some((other) => other.targetObjId === obj.id)) {
          targetTower = { id: obj.id, obj };
          break;
        }
      }

      if (targetTower) {
        const freeTile = findAdjacentFreeTile(targetTower.obj.rootX, targetTower.obj.rootZ, targetTower.obj.size, occupiedGrid, currentG);
        if (freeTile) {
          const rawPath = findPath(currentG, freeTile, occupiedGrid);
          if (rawPath !== null) {
            npc.targetObjId = targetTower.id;
            npc.pendingAction = "CLIMB";
            setThought(npc, "CLIMB");
            if (rawPath.length > 0) {
              npc.path = rawPath.map((pt) => gridToWorldCenter(pt.x, pt.z, 1));
            } else {
              npc.path = [];
              npc.a = "CLIMB";
              npc.climbProgress = 0;
            }
            return;
          }
        }
      }

      if (Math.random() < 0.05) {
        let bestCandidate = null;
        let minDist = Infinity;
        const reserved = new Set(activeNPCs.map((o) => o.targetObjId).filter(Boolean));

        for (const type of WORKABLE_TYPES) {
          for (const obj of objectsOfType(type)) {
            if (obj.lotId) continue; // the mill's crew harvests its own lot
            if (reserved.has(obj.id)) continue;
            if (type === "farm" && (!obj.isReady || obj.growthTimer > 0)) continue;

            if (type === "market") {
              const canTrade = state.resources.wh >= 5 || state.resources.stone >= 5 || state.resources.food >= 15 || state.resources.water >= 15;
              if (!canTrade) continue;
            }

            const freeTile = findAdjacentFreeTile(obj.rootX, obj.rootZ, obj.size, occupiedGrid, currentG);
            if (freeTile) {
              const dist = Math.abs(freeTile.x - currentG.x) + Math.abs(freeTile.z - currentG.z);
              if (dist < minDist) {
                minDist = dist;
                bestCandidate = { id: obj.id, obj, targetG: freeTile };
              }
            }
          }
        }

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

            setThought(npc, npc.pendingAction);

            if (rawPath.length > 0) {
              npc.path = rawPath.map((pt) => gridToWorldCenter(pt.x, pt.z, 1));
            } else {
              npc.path = [];
              npc.a = npc.pendingAction || "IDLE";
              npc.actionTimer = 3.5;
            }
          }
        } else {
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

    if (npc.path && npc.path.length > 0) {
      npc.a = "WALK";
      const targetWorld = npc.path[0];
      const dx = targetWorld.x - npc.root.position.x;
      const dz = targetWorld.z - npc.root.position.z;
      const dist = Math.hypot(dx, dz);

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
        const step = Math.min(npc.speed * deltaTime, dist);
        const move = crowdStep(npc, dx / dist, dz / dist, step, occupiedGrid, activeNPCs);
        npc.root.position.x += move.x;
        npc.root.position.z += move.z;
        if (move.x !== 0 || move.z !== 0) npc.root.rotation.y = Math.atan2(move.x, move.z);
      }
    }

    updateNPCAnimation(npc, deltaTime);
  });

  separateNPCs(activeNPCs, occupiedGrid);
  tickGates(deltaTime, activeNPCs);
}