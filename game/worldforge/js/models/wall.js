import { flatShade } from "../flatShade.js";
import { solidMat } from "./materials.js";

// Shared with the hut, storage shed and market stall so a palisade reads as
// part of the same settlement instead of a different art pass.
const CEDAR = [0.50, 0.34, 0.20];
const CEDAR_DARK = [0.38, 0.24, 0.14];
const HEMP = [0.72, 0.58, 0.32];
const MOSS = [0.42, 0.65, 0.28];
const CRANBERRY = [0.88, 0.35, 0.28];

function mat(suffix, scene, rgb) {
  return solidMat(scene, "wall" + suffix, rgb);
}

export function createWallSegment(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const woodMat = mat("_wMat", scene, CEDAR);
  const woodMatDark = mat("_wMatD", scene, CEDAR_DARK);
  const ropeMat = mat("_ropeMat", scene, HEMP);
  const mossMat = mat("_mossMat", scene, MOSS);

  // Vertical palisade stakes spanning the tile
  const stakeCount = 5;
  for (let i = 0; i < stakeCount; i++) {
    const t = i / (stakeCount - 1);
    const x = -0.42 + t * 0.84;
    const h = 1.1 + Math.sin(i * 1.7) * 0.08;
    const stake = BABYLON.MeshBuilder.CreateCylinder(id + "_stake_" + i, { height: h, diameterTop: 0.07, diameterBottom: 0.12, tessellation: 5 }, scene);
    stake.position.set(x, h / 2, 0);
    stake.rotation.z = (Math.random() - 0.5) * 0.07;
    stake.material = i % 2 === 0 ? woodMat : woodMatDark;
    stake.parent = root;
  }

  // Horizontal binding beams
  const beamTop = BABYLON.MeshBuilder.CreateBox(id + "_beamTop", { width: 0.95, height: 0.07, depth: 0.1 }, scene);
  beamTop.position.set(0, 0.85, 0);
  beamTop.material = woodMatDark;
  beamTop.parent = root;

  const beamBottom = BABYLON.MeshBuilder.CreateBox(id + "_beamBottom", { width: 0.95, height: 0.07, depth: 0.1 }, scene);
  beamBottom.position.set(0, 0.35, 0);
  beamBottom.material = woodMatDark;
  beamBottom.parent = root;

  // Hemp lashings where the beams cross the outer stakes
  [-0.42, 0.42].forEach((x, i) => {
    const lashing = BABYLON.MeshBuilder.CreateTorus(id + "_lashing_" + i, { diameter: 0.15, thickness: 0.025, tessellation: 7 }, scene);
    lashing.rotation.x = Math.PI / 2;
    lashing.position.set(x, 0.85, 0);
    lashing.material = ropeMat;
    lashing.parent = root;
  });

  // Moss creeping up the shaded base so the wall feels settled-in, not new-cut
  [0.24, -0.18].forEach((x, i) => {
    const moss = BABYLON.MeshBuilder.CreateSphere(id + "_moss_" + i, { diameter: 0.2, segments: 3 }, scene);
    moss.scaling.set(1.5, 0.5, 1.1);
    moss.position.set(x, 0.05, i === 0 ? 0.06 : -0.06);
    moss.material = mossMat;
    moss.parent = root;
  });

  return flatShade(root);
}

// Half-gap in tile units: the posts stand at x = ±0.42 and a leaf reaches from
// its own post to the centre line, so the pair meets in the middle when shut.
const LEAF_REACH = 0.4;
const LEAF_TOP = 1.02;
const GATE_SWING = 1.7;      // radians each leaf folds back
const GATE_SPEED = 2.0;      // eased 0..1 per second, so both leaves share it

// How close a villager has to get before the gate starts swinging for them.
export const GATE_TRIGGER = 1.6;

// Boards, rails and brace are authored in the leaf's own space (the hinge is at
// the origin, the boards run out along dir * x) and merged into one mesh, so the
// hinge node can rotate the whole leaf as a unit.
function createLeaf(id, scene, woodMat, darkMat, dir) {
  const hinge = new BABYLON.TransformNode(id + "_hinge", scene);
  hinge.position.set(-0.42 * dir, 0, 0);

  const parts = [];
  const box = (w, h, d, x, y, z, mat, rotZ) => {
    const mesh = BABYLON.MeshBuilder.CreateBox(id + "_p" + parts.length, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    if (rotZ) mesh.rotation.z = rotZ;
    mesh.material = mat;
    parts.push(mesh);
  };

  for (let i = 0; i < 5; i++) {
    box(0.08, LEAF_TOP, 0.05, dir * (0.04 + i * 0.08), LEAF_TOP / 2, 0, i % 2 ? darkMat : woodMat);
  }
  box(LEAF_REACH, 0.07, 0.04, dir * (LEAF_REACH / 2), 0.16, 0.035, darkMat);
  box(LEAF_REACH, 0.07, 0.04, dir * (LEAF_REACH / 2), 0.88, 0.035, darkMat);
  box(0.71, 0.06, 0.04, dir * 0.2, 0.52, 0.05, darkMat, dir * 1.07);

  const merged = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  if (merged) {
    merged.name = id;
    merged.parent = hinge;
  }
  return hinge;
}

export function createGate(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const woodMat = mat("_wMat", scene, CEDAR);
  const woodMatDark = mat("_wMatD", scene, CEDAR_DARK);
  const ropeMat = mat("_ropeMat", scene, HEMP);
  const mossMat = mat("_mossMat", scene, MOSS);
  const clothMat = mat("_clothMat", scene, CRANBERRY);

  const lanternMat = solidMat(scene, "wall_lanternMat", [1, 0.82, 0.36], [1, 0.78, 0.30]);

  // Two side posts framing a passable gap (no stakes in the middle)
  [-0.42, 0.42].forEach((x, i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { height: 1.3, diameterTop: 0.11, diameterBottom: 0.16, tessellation: 6 }, scene);
    post.position.set(x, 0.65, 0);
    post.material = woodMat;
    post.parent = root;

    const moss = BABYLON.MeshBuilder.CreateSphere(id + "_postMoss_" + i, { diameter: 0.22, segments: 3 }, scene);
    moss.scaling.set(1.3, 0.45, 1.3);
    moss.position.set(x, 0.05, 0.04);
    moss.material = mossMat;
    moss.parent = root;
  });

  // Swung on hinge nodes parented to the posts, so a leaf rotates about the
  // post axis rather than about the gate's centre.
  const hingeL = createLeaf(id + "_leafL", scene, woodMat, woodMatDark, 1);
  const hingeR = createLeaf(id + "_leafR", scene, woodMat, woodMatDark, -1);
  hingeL.parent = root;
  hingeR.parent = root;
  root.metadata = { hingeL, hingeR, t: 0, wantOpen: false };

  // Lintel beam across the top of the opening
  const lintel = BABYLON.MeshBuilder.CreateBox(id + "_lintel", { width: 0.95, height: 0.12, depth: 0.14 }, scene);
  lintel.position.set(0, 1.28, 0);
  lintel.material = woodMatDark;
  lintel.parent = root;

  // Pennant hanging from the lintel so the gap reads clearly as an entrance
  const pennant = BABYLON.MeshBuilder.CreateCylinder(id + "_pennant", { height: 0.34, diameter: 0.02, tessellation: 4 }, scene);
  pennant.position.set(-0.16, 1.05, 0.08);
  pennant.material = ropeMat;
  pennant.parent = root;

  const banner = BABYLON.MeshBuilder.CreateCylinder(id + "_banner", { height: 0.26, diameterTop: 0.005, diameterBottom: 0.2, tessellation: 3 }, scene);
  banner.position.set(-0.16, 0.82, 0.08);
  banner.rotation.x = Math.PI;
  banner.material = clothMat;
  banner.parent = root;

  // Warm lantern on the opposite post, matching the hut's porch light
  const lanternArm = BABYLON.MeshBuilder.CreateCylinder(id + "_lanternArm", { height: 0.22, diameter: 0.03, tessellation: 4 }, scene);
  lanternArm.rotation.z = Math.PI / 2;
  lanternArm.position.set(0.32, 1.12, 0.08);
  lanternArm.material = woodMatDark;
  lanternArm.parent = root;

  const lantern = BABYLON.MeshBuilder.CreateBox(id + "_lantern", { width: 0.1, height: 0.13, depth: 0.1 }, scene);
  lantern.position.set(0.22, 1.02, 0.08);
  lantern.material = lanternMat;
  lantern.parent = root;

  return flatShade(root);
}

/**
 * Swing the leaves toward `approaching`. Hinges turn about the post axis, and
 * the two leaves get opposite signs so they fold to the same side of the wall.
 */
export function tickGate(gateRoot, approaching, deltaTime) {
  const meta = gateRoot && gateRoot.metadata;
  if (!meta || !meta.hingeL) return;

  const target = approaching ? 1 : 0;
  if (meta.t === target) return;

  const gap = target - meta.t;
  const step = Math.min(deltaTime * GATE_SPEED, Math.abs(gap));
  meta.t = gap > 0 ? meta.t + step : meta.t - step;

  const eased = meta.t * meta.t * (3 - 2 * meta.t);
  const angle = eased * GATE_SWING;
  meta.hingeL.rotation.y = angle;
  meta.hingeR.rotation.y = -angle;
}
