import { flatShade } from "./flatShade.js";

export const canvas = document.getElementById("renderCanvas");
export const engine = new BABYLON.Engine(canvas, true, { 
  preserveDrawingBuffer: false, 
  powerPreference: "high-performance",
  doNotHandleContextLost: true 
});
export const scene = new BABYLON.Scene(engine);

export const BUILD_SIZE = 80;
export const HALF_BUILD = BUILD_SIZE / 2;

function createFlatMat(name, color) {
  const mat = new BABYLON.StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  return mat;
}

export const envMaterials = {
  // Cozy, vibrant meadow green with warm undertone
  playableGround: createFlatMat("pGroundMat", new BABYLON.Color3(0.38, 0.65, 0.28)),
  // Softer rolling distant hills
  endlessGround: createFlatMat("eGroundMat", new BABYLON.Color3(0.28, 0.52, 0.24)),
  // Warm stylized cedar trunk
  trunk: createFlatMat("trunkMat", new BABYLON.Color3(0.48, 0.30, 0.16)),
  // Vibrant, rich leafy foliage
  foliage: createFlatMat("foliageMat", new BABYLON.Color3(0.26, 0.68, 0.28)),
  foliageLight: createFlatMat("foliageLightMat", new BABYLON.Color3(0.40, 0.78, 0.32)),

  // Apples on the fruiting trees.
  fruit: createFlatMat("fruitMat", new BABYLON.Color3(0.88, 0.30, 0.24)),

  // Shared boulder set - warm granite, its shaded side, and the moss that
  // settles on top.
  stone: createFlatMat("stoneMat", new BABYLON.Color3(0.56, 0.54, 0.51)),
  stoneDark: createFlatMat("stoneDarkMat", new BABYLON.Color3(0.42, 0.41, 0.38)),
  moss: createFlatMat("mossMat", new BABYLON.Color3(0.42, 0.65, 0.28))
};

scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;

export const hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
export const sunLight = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.45, -1, -0.4), scene);
sunLight.position = new BABYLON.Vector3(40, 70, 20);

export const shadowGen = new BABYLON.ShadowGenerator(1024, sunLight);
shadowGen.usePoissonSampling = true;
// The sun is fixed and the village is static, so the map only needs a refresh
// every other frame - it halves the per-frame shadow cost for free.
shadowGen.getShadowMap().refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYTWOFRAMES;

export function setEnvironmentLighting(isNight) {
  if (!isNight) {
    // Soft, pleasant sunny day — comfortable on eyes, warm low-poly fairytale tones
    scene.clearColor = new BABYLON.Color4(0.48, 0.70, 0.88, 1);
    scene.fogColor = new BABYLON.Color3(0.55, 0.72, 0.88);
    scene.fogDensity = 0.0015;

    hemiLight.intensity = 0.78; // reduced from 1.05
    hemiLight.skyColor = new BABYLON.Color3(0.92, 0.95, 1.0);
    hemiLight.groundColor = new BABYLON.Color3(0.38, 0.48, 0.32);

    sunLight.intensity = 0.85; // reduced from 1.15 to stop blown-out highlights
    sunLight.diffuse = new BABYLON.Color3(0.98, 0.94, 0.86); // Soft warm golden sun
  } else {
    // Cozy enchanted twilight night
    scene.clearColor = new BABYLON.Color4(0.08, 0.11, 0.22, 1);
    scene.fogColor = new BABYLON.Color3(0.09, 0.13, 0.26);
    scene.fogDensity = 0.0020;

    hemiLight.intensity = 0.60;
    hemiLight.skyColor = new BABYLON.Color3(0.32, 0.42, 0.72);
    hemiLight.groundColor = new BABYLON.Color3(0.10, 0.16, 0.20);

    sunLight.intensity = 0.65;
    sunLight.diffuse = new BABYLON.Color3(0.52, 0.62, 0.92); // Magical moonlight
  }
}
setEnvironmentLighting(false);

export const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 3, 42, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 4;
camera.upperRadiusLimit = 160;
camera.panningSensibility = 80;

const keys = { w: false, a: false, s: false, d: false, q: false, e: false };
window.addEventListener("keydown", (evt) => {
  const k = evt.key.toLowerCase();
  if (k in keys) keys[k] = true;
});
window.addEventListener("keyup", (evt) => {
  const k = evt.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

export function updateCameraControls() {
  const moveSpeed = 0.55;
  const vertSpeed = 0.45;

  if (keys.e) camera.target.y += vertSpeed;
  if (keys.q) camera.target.y = Math.max(0, camera.target.y - vertSpeed);

  if (!keys.w && !keys.a && !keys.s && !keys.d) return;

  const forward = camera.getForwardRay().direction;
  forward.y = 0;
  forward.normalize();

  const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up()).normalize();
  const moveVec = BABYLON.Vector3.Zero();

  if (keys.w) moveVec.addInPlace(forward);
  if (keys.s) moveVec.subtractInPlace(forward);
  if (keys.d) moveVec.subtractInPlace(right);
  if (keys.a) moveVec.addInPlace(right);

  if (moveVec.lengthSquared() > 0) {
    moveVec.normalize().scaleInPlace(moveSpeed);
    camera.target.addInPlace(moveVec);
  }
}

export const endlessGround = BABYLON.MeshBuilder.CreateGround("eGround", { width: 2500, height: 2500 }, scene);
endlessGround.position.y = -0.05;
endlessGround.material = envMaterials.endlessGround;
endlessGround.isPickable = false;
endlessGround.freezeWorldMatrix();

export const playableGround = BABYLON.MeshBuilder.CreateGround("pGround", { width: BUILD_SIZE, height: BUILD_SIZE }, scene);
playableGround.material = envMaterials.playableGround;
playableGround.receiveShadows = true;
playableGround.freezeWorldMatrix();

const gridLines = [];
for (let i = 0; i <= BUILD_SIZE; i++) {
  const offset = i - HALF_BUILD;
  gridLines.push([new BABYLON.Vector3(offset, 0.02, -HALF_BUILD), new BABYLON.Vector3(offset, 0.02, HALF_BUILD)]);
  gridLines.push([new BABYLON.Vector3(-HALF_BUILD, 0.02, offset), new BABYLON.Vector3(HALF_BUILD, 0.02, offset)]);
}
export const grid = BABYLON.MeshBuilder.CreateLineSystem("grid", { lines: gridLines }, scene);
grid.color = new BABYLON.Color3(0.28, 0.50, 0.22);
grid.alpha = 0.28; // Subtle and gentle grid
grid.isPickable = false;
grid.freezeWorldMatrix();

// ------------------------------------------------------------
// GROUND SCATTER
// ------------------------------------------------------------
// Pebbles. One thin-instanced mesh, so a few hundred stones cost a single draw
// call and add nothing to scene.meshes the way regular instances would.
//
// isPickable has to stay false: pebbles are ground decoration, and a pick that
// lands on one should never eat the click meant for a villager or a building.
const SCATTER_EDGE = HALF_BUILD - 1.5;

// Buildings claim the ground they stand on so nothing sits on a floor. Claimed
// as exact rectangles rather than tiles, because a tile-granular hide leaves
// stones leaning on a building's border. The margin clears that lip without the
// whole-tile ring that would carve bald circles around every tree.
const SCATTER_MARGIN = 0.45;
const scatterGroups = [];
const scatterBlocks = new Map(); // key -> { x0, x1, z0, z1 }
const blocksByTile = new Map();  // "tx,tz" -> Set<rect> of every claim touching that tile

// Visiting renders a second world onto the same ground, so claims are keyed by
// object rather than counted - the host's buildings and the player's own have
// to be releasable independently.
//
// Rectangles stay exact rather than tile-granular, but they are indexed by the
// tiles they span so a lookup tests the few claims over that tile instead of
// every building in the world.
function eachTile(rect, fn) {
  for (let tx = Math.floor(rect.x0); tx <= Math.floor(rect.x1); tx++) {
    for (let tz = Math.floor(rect.z0); tz <= Math.floor(rect.z1); tz++) fn(tx + "," + tz);
  }
}

function bucketRect(rect) {
  eachTile(rect, (k) => {
    let set = blocksByTile.get(k);
    if (!set) { set = new Set(); blocksByTile.set(k, set); }
    set.add(rect);
  });
}

function unbucketRect(rect) {
  eachTile(rect, (k) => {
    const set = blocksByTile.get(k);
    if (!set) return;
    set.delete(rect);
    if (!set.size) blocksByTile.delete(k);
  });
}

function isBlocked(x, z) {
  const set = blocksByTile.get(Math.floor(x) + "," + Math.floor(z));
  if (!set) return false;
  for (const b of set) {
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
  }
  return false;
}

function scatterEntry(x, z, scaleRange) {
  const [lo, hi] = scaleRange;
  const scale = lo + Math.random() * (hi - lo);
  return {
    x,
    z,
    matrix: BABYLON.Matrix.Compose(
      new BABYLON.Vector3(scale, scale, scale),
      BABYLON.Quaternion.RotationYawPitchRoll(Math.random() * Math.PI * 2, 0, 0),
      new BABYLON.Vector3(x, 0, z)
    )
  };
}

// Stones gather in scree patches rather than spreading evenly: points falling
// off around a handful of centres read as ground detail, while the same count
// spread uniformly reads as confetti.
function driftPoints(count, scaleRange, spread) {
  const drifts = Math.max(8, Math.round(count / 16));
  const centres = [];
  for (let i = 0; i < drifts; i++) {
    centres.push([
      (Math.random() * 2 - 1) * SCATTER_EDGE * 0.9,
      (Math.random() * 2 - 1) * SCATTER_EDGE * 0.9
    ]);
  }
  const clamp = (v) => Math.max(-SCATTER_EDGE, Math.min(SCATTER_EDGE, v));
  const out = [];
  for (let i = 0; i < count; i++) {
    const [cx, cz] = centres[i % drifts];
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * Math.random() * spread;
    out.push(scatterEntry(clamp(cx + Math.cos(a) * r), clamp(cz + Math.sin(a) * r), scaleRange));
  }
  return out;
}

function registerScatter(mesh, entries) {
  mesh.isPickable = false;
  const buffer = new Float32Array(entries.length * 16);
  entries.forEach((e, i) => e.matrix.copyToArray(buffer, i * 16));
  // staticBuffer has to be false or the re-upload in refreshScatter is dropped.
  mesh.thinInstanceSetBuffer("matrix", buffer, 16, false);
  mesh.freezeWorldMatrix();
  scatterGroups.push({ mesh, entries, buffer });
}

function refreshScatter(group) {
  let n = 0;
  for (const e of group.entries) {
    if (isBlocked(e.x, e.z)) continue;
    e.matrix.copyToArray(group.buffer, n * 16);
    n++;
  }
  group.mesh.thinInstanceCount = n;
  group.mesh.thinInstanceBufferUpdated("matrix");
}

let scatterRefreshQueued = false;

// Restoring a saved world claims one rectangle per building in a single
// synchronous burst; refreshing per claim would re-pack and re-upload the
// instance buffers a hundred times for one visible change.
function scheduleScatterRefresh() {
  if (scatterRefreshQueued) return;
  scatterRefreshQueued = true;
  queueMicrotask(() => {
    scatterRefreshQueued = false;
    scatterGroups.forEach(refreshScatter);
  });
}

export function claimScatter(key, rootX, rootZ, size) {
  const rect = {
    x0: rootX - SCATTER_MARGIN,
    x1: rootX + size + SCATTER_MARGIN,
    z0: rootZ - SCATTER_MARGIN,
    z1: rootZ + size + SCATTER_MARGIN
  };
  scatterBlocks.set(key, rect);
  bucketRect(rect);
  scheduleScatterRefresh();
}

export function releaseScatter(key) {
  const rect = scatterBlocks.get(key);
  if (!rect) return;
  scatterBlocks.delete(key);
  unbucketRect(rect);
  scheduleScatterRefresh();
}

function buildPebble(name) {
  const pebble = BABYLON.MeshBuilder.CreatePolyhedron(name, { type: 1, size: 0.09 }, scene);
  pebble.position.y = 0.04;
  pebble.bakeCurrentTransformIntoVertices();
  pebble.material = envMaterials.stoneDark;
  pebble.convertToFlatShadedMesh();
  return pebble;
}

// Pebbles in scree patches rather than uniform noise, so they read as ground
// detail instead of confetti.
registerScatter(buildPebble("pebbles"), driftPoints(110, [0.7, 1.6], 3));

// Per-object variation has to be seeded from the object id ("tree_23_28"),
// not Math.random(). Neither scale nor canopy twist is part of the save format,
// so a random value would silently reshuffle the whole forest every time the
// player came back to a world they had already built.
function seededRng(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  if (h === 0) h = 0x9e3779b9; // xorshift is a fixed point at zero
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

// Pushes each vertex in and out along its own radius so an icosphere stops
// looking like a ball bearing and starts looking hand-cut. Must run before
// flatShade(), which bakes normals from the displaced positions.
function roughen(mesh, rand, amount) {
  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  if (!positions) return mesh;
  for (let i = 0; i < positions.length; i += 3) {
    const n = 1 - amount + rand() * amount * 2;
    positions[i] *= n;
    positions[i + 1] *= n;
    positions[i + 2] *= n;
  }
  mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
  return mesh;
}

export function createLowPolyStone(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);
  const rand = seededRng(id);

  const bulk = 0.88 + rand() * 0.26;
  root.scaling.set(bulk * (0.95 + rand() * 0.1), bulk * (0.9 + rand() * 0.2), bulk);

  // The yaw lives on an inner node: instantiateObject overwrites
  // root.rotation.y with the saved build rotation.
  const body = new BABYLON.TransformNode(id + "_body", scene);
  body.parent = root;
  body.rotation.y = rand() * Math.PI * 2;

  // Main boulder — organic low poly polyhedron
  const mainRock = BABYLON.MeshBuilder.CreatePolyhedron(id + "_main", { type: 1, size: 0.72 }, scene);
  mainRock.position.set(0, 0.38, 0);
  mainRock.scaling.set(1.25, 0.85, 1.15);
  mainRock.rotation.set(0.18, 0.55, 0.12);
  mainRock.material = envMaterials.stone;
  mainRock.parent = body;

  // Moss settling on the sunny side of the cap
  const mossCap = BABYLON.MeshBuilder.CreatePolyhedron(id + "_moss", { type: 1, size: 0.38 }, scene);
  mossCap.position.set(0.08, 0.65, 0.05);
  mossCap.scaling.set(1.1, 0.35, 1.0);
  mossCap.rotation.set(0.2, 0.3, -0.1);
  mossCap.material = envMaterials.moss;
  mossCap.parent = body;

  // Secondary side pebble
  const subRock = BABYLON.MeshBuilder.CreatePolyhedron(id + "_sub", { type: 1, size: 0.44 }, scene);
  subRock.position.set(0.48, 0.22, -0.28);
  subRock.scaling.set(0.95, 0.8, 1.05);
  subRock.rotation.set(0.35, -0.25, 0.28);
  subRock.material = envMaterials.stoneDark;
  subRock.parent = body;

  // Third tiny accent stone
  const tinyRock = BABYLON.MeshBuilder.CreatePolyhedron(id + "_tiny", { type: 1, size: 0.25 }, scene);
  tinyRock.position.set(-0.46, 0.12, 0.32);
  tinyRock.rotation.set(0.1, 0.8, 0.4);
  tinyRock.material = envMaterials.stone;
  tinyRock.parent = body;

  return flatShade(root);
}

export function createLowPolyTree(name, scene, materials) {
  const root = new BABYLON.TransformNode(name, scene);
  const rand = seededRng(name);

  const stature = 0.86 + rand() * 0.32;
  root.scaling.set(stature * (0.94 + rand() * 0.12), stature, stature * (0.94 + rand() * 0.12));

  const canopy = new BABYLON.TransformNode(name + "_canopy", scene);
  canopy.parent = root;
  canopy.rotation.y = rand() * Math.PI * 2;

  const lean = (rand() - 0.5) * 0.1;

  // Warm tapered stylized log trunk
  const baseTrunk = BABYLON.MeshBuilder.CreateCylinder(name + "_t_base", {
    height: 1.7,
    diameterTop: 0.42,
    diameterBottom: 0.78,
    tessellation: 6
  }, scene);
  baseTrunk.position.y = 0.85;
  baseTrunk.rotation.z = lean;
  baseTrunk.material = materials.trunk;
  baseTrunk.parent = canopy;

  // Gentle curved trunk offset
  const midTrunk = BABYLON.MeshBuilder.CreateCylinder(name + "_t_mid", {
    height: 1.3,
    diameterTop: 0.30,
    diameterBottom: 0.42,
    tessellation: 6
  }, scene);
  midTrunk.position.set(0.06, 2.15, 0.04);
  midTrunk.rotation.z = lean - 0.07;
  midTrunk.material = materials.trunk;
  midTrunk.parent = canopy;

  // Root flares gripping the ground, so the trunk does not look plugged into
  // the meadow like a pole.
  for (let i = 0; i < 2; i++) {
    const angle = rand() * Math.PI * 2 + i * Math.PI;
    const flare = BABYLON.MeshBuilder.CreateCylinder(name + "_root" + i, {
      height: 0.8,
      diameterTop: 0.09,
      diameterBottom: 0.36,
      tessellation: 4
    }, scene);
    flare.position.set(Math.cos(angle) * 0.26, 0.3, Math.sin(angle) * 0.26);
    flare.rotation.z = Math.cos(angle) * 0.42;
    flare.rotation.x = -Math.sin(angle) * 0.42;
    flare.material = materials.trunk;
    flare.parent = canopy;
  }

  // Cute side branch
  const branch1 = BABYLON.MeshBuilder.CreateCylinder(name + "_b1", {
    height: 1.1,
    diameterTop: 0.16,
    diameterBottom: 0.28,
    tessellation: 5
  }, scene);
  branch1.position.set(0.32, 2.35, 0.12);
  branch1.rotation.set(0.08, 0.1, -Math.PI / 4.2);
  branch1.material = materials.trunk;
  branch1.parent = canopy;

  // Rich fluffy low-poly foliage clouds with highlights
  const foliageSpecs = [
    { name: "f_main", r: 1.45, pos: [0, 3.75, 0], mat: materials.foliage },
    { name: "f_left", r: 1.15, pos: [-0.68, 3.15, -0.32], mat: materials.foliage },
    { name: "f_right", r: 1.20, pos: [0.72, 2.95, 0.24], mat: materials.foliage },
    { name: "f_back", r: 1.02, pos: [-0.24, 3.42, 0.74], mat: materials.foliage },
    { name: "f_top", r: 0.98, pos: [0.08, 4.65, -0.06], mat: materials.foliageLight || materials.foliage },
    { name: "f_highlight", r: 0.75, pos: [-0.35, 4.05, 0.45], mat: materials.foliageLight || materials.foliage }
  ];

  foliageSpecs.forEach((spec) => {
    const cluster = roughen(
      BABYLON.MeshBuilder.CreateIcoSphere(name + "_" + spec.name, {
        radius: spec.r,
        subdivisions: 1
      }, scene),
      rand,
      0.16
    );
    cluster.position.set(...spec.pos);
    // Squashed slightly so the crown reads as a wide cloud, not a snowman.
    cluster.scaling.set(1.08, 0.86 + rand() * 0.14, 1.04);
    cluster.rotation.y = rand() * Math.PI;
    cluster.material = spec.mat;
    cluster.parent = canopy;
  });

  // A fifth of the trees bear apples, which is what stops a grove from reading
  // as the same tree stamped out.
  if (rand() < 0.2) {
    const fruitSpecs = [
      [-0.55, 3.55, 0.55],
      [0.62, 3.35, -0.3],
      [0.05, 4.42, 0.5]
    ];
    fruitSpecs.forEach(([ax, ay, az], i) => {
      const apple = BABYLON.MeshBuilder.CreateIcoSphere(name + "_fruit" + i, {
        radius: 0.13,
        subdivisions: 1
      }, scene);
      apple.position.set(ax, ay, az);
      apple.material = materials.fruit;
      apple.parent = canopy;
    });
  }

  return flatShade(root);
}

// ============================================================
// NATURAL DISASTERS
// Each disaster module (../nd/*.js) exports two things:
//   - a class with activate()/deactivate() for the continuous visual
//     effect (screen shake, rising water, fire particles, lightning bolts)
//   - a plain { name, trigger(npcs, scene, camera, engine) } object that
//     applies a one-time burst of NPC damage when the disaster starts
// This module owns picking one at random, running it for a fixed duration,
// and guaranteeing only one plays at a time.
// ============================================================
import { Flood, flood } from "../nd/flood.js";
import { Earthquake, earthquake } from "../nd/earthquake.js";
import { Lightning, lightning } from "../nd/lightning.js";
import { Wildfire, wildfire } from "../nd/wildfire.js";

const DISASTER_DEFS = [
  { key: "flood", name: flood.name, trigger: flood.trigger, VisualClass: Flood },
  { key: "earthquake", name: earthquake.name, trigger: earthquake.trigger, VisualClass: Earthquake },
  { key: "lightning", name: lightning.name, trigger: lightning.trigger, VisualClass: Lightning },
  { key: "wildfire", name: wildfire.name, trigger: wildfire.trigger, VisualClass: Wildfire }
];

const DISASTER_DURATION_MS = 8000;

let activeDisaster = null; // { def, visual, timeoutId }

export function isDisasterActive() { return !!activeDisaster; }
export function getActiveDisasterName() { return activeDisaster ? activeDisaster.def.name : null; }

// Starts a specific disaster by key ("flood"/"earthquake"/"lightning"/
// "wildfire"). Returns the disaster's display name on success, or null if
// one is already running (only one plays at a time) or the key is unknown.
export function triggerDisaster(key, activeNPCs) {
  if (activeDisaster) return null;
  const def = DISASTER_DEFS.find((d) => d.key === key);
  if (!def) return null;

  const visual = new def.VisualClass(scene);
  visual.activate();
  def.trigger(activeNPCs, scene, camera, engine);

  const timeoutId = setTimeout(stopDisaster, DISASTER_DURATION_MS);
  activeDisaster = { def, visual, timeoutId };
  return def.name;
}

export function stopDisaster() {
  if (!activeDisaster) return;
  clearTimeout(activeDisaster.timeoutId);
  activeDisaster.visual.deactivate();
  activeDisaster = null;
}

let disasterSchedulerId = null;

// Call once at boot. Picks a random disaster every 1.5-3.5 minutes and runs
// it for DISASTER_DURATION_MS, never overlapping another. onDisasterStart is
// called with the disaster's display name so the caller can show a warning.
export function startDisasterSystem(activeNPCs, onDisasterStart) {
  if (disasterSchedulerId) return;

  const scheduleNext = () => {
    const delay = 90000 + Math.random() * 120000;
    disasterSchedulerId = setTimeout(() => {
      if (!activeDisaster) {
        const def = DISASTER_DEFS[Math.floor(Math.random() * DISASTER_DEFS.length)];
        const name = triggerDisaster(def.key, activeNPCs);
        if (name && onDisasterStart) onDisasterStart(name);
      }
      scheduleNext();
    }, delay);
  };
  scheduleNext();
}

export function stopDisasterSystem() {
  if (disasterSchedulerId) {
    clearTimeout(disasterSchedulerId);
    disasterSchedulerId = null;
  }
  stopDisaster();
}