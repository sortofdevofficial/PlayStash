import { flatShade } from "../flatShade.js";
import { sharedMat, solidMat } from "./materials.js";

// The mill is the village's landmark and at authored size it read as just
// another shed. Scaling the root keeps every part - including the woodlot
// fence - in proportion; WOODLOT_PAD in world.js grows with it so the fence
// still rings exactly the tiles the yard claim covers.
export const MILL_SCALE = 1.3;

// The mill is deliberately plain: a plinth, a timber frame, slab walls, two
// roof slopes, the log it exists to cut, and the woodlot fence. Parts go into
// a per-material bucket through put() and each bucket merges into one mesh,
// so the whole building costs a handful of draw calls.
export function createLumbermill(id, scene, withYard = true) {
  const root = new BABYLON.TransformNode(id, scene);

  const m = {
    frame:   solidMat(scene, "lm_frame",   [0.48, 0.32, 0.18]),  // milled pine
    dark:    solidMat(scene, "lm_dark",    [0.32, 0.20, 0.11]),  // shadowed beams
    bark:    solidMat(scene, "lm_bark",    [0.36, 0.25, 0.15]),
    shingle: solidMat(scene, "lm_shingle", [0.46, 0.24, 0.19]),  // weathered roof
    stone:   solidMat(scene, "lm_stone",   [0.52, 0.50, 0.47]),
  };

  const groups = new Map();
  let seq = 0;
  const put = (mesh, mat) => {
    const list = groups.get(mat);
    if (list) list.push(mesh);
    else groups.set(mat, [mesh]);
    return mesh;
  };
  const nextName = () => id + "_p" + (seq++);

  const box = (mat, x, y, z, w, h, d, rot) => {
    const b = BABYLON.MeshBuilder.CreateBox(nextName(), { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z);
    if (rot) b.rotation.set(rot[0], rot[1], rot[2] || 0);
    return put(b, mat);
  };
  const cyl = (mat, x, y, z, h, d, rot, tess = 6) => {
    const c = BABYLON.MeshBuilder.CreateCylinder(nextName(), { height: h, diameter: d, tessellation: tess }, scene);
    c.position.set(x, y, z);
    if (rot) c.rotation.set(rot[0], rot[1], rot[2] || 0);
    return put(c, mat);
  };
  // ============================================================
  // Stone footing and the plank floor it raises
  // ============================================================
  box(m.stone, 0, 0.1, 0, 2.02, 0.2, 2.02);
  box(m.frame, 0, 0.24, 0, 1.78, 0.1, 1.78);

  // ============================================================
  // Timber frame: four corner posts and the plate they carry
  // ============================================================
  const TOP = 1.78;
  const posts = [[-0.88, -0.88], [0.88, -0.88], [-0.88, 0.88], [0.88, 0.88]];
  posts.forEach(([px, pz]) => cyl(m.frame, px, (0.28 + TOP) / 2, pz, TOP - 0.28, 0.17));

  [-0.9, 0.9].forEach((z) => box(m.dark, 0, TOP, z, 1.98, 0.14, 0.14));
  [-0.9, 0.9].forEach((x) => box(m.dark, x, TOP, 0, 0.14, 0.14, 1.98));

  // ============================================================
  // Walls: closed back and left, half-high on the right so the light
  // gets in, and open across the front saw bay.
  // ============================================================
  box(m.frame, 0, 1.06, -0.92, 1.84, 1.42, 0.07);
  box(m.frame, -0.92, 1.06, 0, 0.07, 1.42, 1.84);
  box(m.frame, 0.92, 0.72, 0, 0.07, 0.74, 1.84);

  // One gable board per end closes the gap under the roof.
  [-0.9, 0.9].forEach((z) => box(m.frame, 0, 2.0, z, 1.5, 0.45, 0.07));

  // ============================================================
  // Roof: two plain shingled slopes and a capped ridge
  // ============================================================
  const PITCH = 0.42;
  const SLOPE = 1.46;
  const eaveY = 1.74;
  const ridgeY = eaveY + Math.sin(PITCH) * SLOPE;
  const eaveX = Math.cos(PITCH) * SLOPE;
  [-1, 1].forEach((side) =>
    box(m.shingle, side * eaveX * 0.5, (eaveY + ridgeY) / 2, 0, SLOPE, 0.09, 2.36, [0, 0, -side * PITCH]));
  box(m.dark, 0, ridgeY + 0.08, 0, 0.26, 0.14, 2.44);

  // ============================================================
  // Saw bay: a log across two trestles. Nothing here turns - the
  // crew is the animation.
  // ============================================================
  [-0.5, 0.5].forEach((tx) => box(m.dark, tx, 0.55, 0.7, 0.12, 0.55, 0.44));
  box(m.bark, 0, 0.92, 0.7, 1.34, 0.28, 0.28, [0, 0, 0.05]);

  // ============================================================
  // Finished lumber stacked on the right, green logs on the left
  // ============================================================
  for (let s = 0; s < 3; s++)
    box(m.frame, 1.5, 0.3 + s * 0.19, 0.55, 0.66, 0.14, 1.2);

  [[-0.4, 0.36], [0.0, 0.36], [-0.2, 0.65]].forEach(([lz, ly]) =>
    cyl(m.bark, -1.42, ly, lz, 1.5, 0.3, [0, 0, Math.PI / 2], 8));

  // ============================================================
  // The woodlot fence. YARD_HALF has to agree with WOODLOT_PAD in
  // world.js, because that pad is the square the lot's trees regrow in.
  // ============================================================
  if (withYard) {
    const YARD_HALF = 3.5;
    const GATE_HALF = 0.95;
    const seen = new Set();

    const fencePost = (x, z, tall = 0.95) => {
      const key = x + "," + z;
      if (seen.has(key)) return;
      seen.add(key);
      cyl(m.dark, x, tall / 2, z, tall, 0.17);
    };
    const railRun = (x0, z0, x1, z1) => {
      fencePost(x0, z0);
      fencePost(x1, z1);
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const len = Math.hypot(x1 - x0, z1 - z0);
      [0.34, 0.66].forEach((railY) =>
        box(m.frame, (x0 + x1) / 2, railY, (z0 + z1) / 2, alongX ? len : 0.08, 0.12, alongX ? 0.08 : len));
    };

    railRun(-YARD_HALF, -YARD_HALF, YARD_HALF, -YARD_HALF);
    railRun(-YARD_HALF, YARD_HALF, -GATE_HALF, YARD_HALF);
    railRun(GATE_HALF, YARD_HALF, YARD_HALF, YARD_HALF);
    railRun(-YARD_HALF, -YARD_HALF, -YARD_HALF, YARD_HALF);
    railRun(YARD_HALF, -YARD_HALF, YARD_HALF, YARD_HALF);

    // Gate leaf, hinged on the left jamb and swung open into the yard.
    const GA = -1.15;
    const cos = Math.cos(GA), sin = Math.sin(GA);
    const leaf = (along, up, w, h) =>
      box(m.frame, -GATE_HALF + cos * along, up, YARD_HALF + sin * along, w, h, 0.06, [0, -GA, 0]);
    fencePost(-GATE_HALF, YARD_HALF, 1.08);
    fencePost(GATE_HALF, YARD_HALF, 1.08);
    leaf(0.95, 0.32, 1.85, 0.1);
    leaf(0.95, 0.68, 1.85, 0.1);
  }

  groups.forEach((parts, mat) => {
    const merged = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
    if (!merged) return;
    merged.name = id + "_body";
    merged.material = mat;
    merged.parent = root;
  });

  // ============================================================
  // Lantern: an arm and a glowing lamp, the one warm note on the
  // building. Both stay out of the merge so the lamp keeps its material.
  // ============================================================
  const add = (mesh, mat) => { mesh.material = mat; mesh.parent = root; return mesh; };
  add(BABYLON.MeshBuilder.CreateBox(id + "_lampArm", { width: 0.06, height: 0.06, depth: 0.3 }, scene), m.dark)
    .position.set(0.46, 1.66, 0.96);

  const lampMat = sharedMat(scene, "lm_lamp", () => {
    const mat = new BABYLON.StandardMaterial("lm_lamp", scene);
    mat.diffuseColor = new BABYLON.Color3(0.55, 0.4, 0.2);
    mat.emissiveColor = new BABYLON.Color3(0.92, 0.62, 0.2);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    return mat;
  });
  const lamp = add(BABYLON.MeshBuilder.CreateCylinder(id + "_lamp", { height: 0.24, diameterTop: 0.11, diameterBottom: 0.17, tessellation: 6 }, scene), lampMat);
  lamp.position.set(0.46, 1.48, 1.1);

  const finished = flatShade(root);
  finished.scaling.setAll(MILL_SCALE);
  return finished;
}

