import { flatShade } from "../flatShade.js";
import { sharedMat, solidMat } from "./materials.js";

// The mill is the village's landmark and at authored size it read as just
// another shed. Scaling the root keeps every part - including the woodlot
// fence - in proportion; WOODLOT_PAD in world.js grows with it so the fence
// still rings exactly the tiles the yard claim covers.
export const MILL_SCALE = 1.3;

// The mill is built from a lot of small parts - plank courses, shingle rows,
// knee braces, log ends - and a mesh per part would cost more draw calls and
// more shadow casters than the rest of the village. Every part therefore goes
// into a per-material bucket through put(), and each bucket merges into one
// mesh at the end, so the detail costs about eleven meshes either way.
export function createLumbermill(id, scene, withYard = true) {
  const root = new BABYLON.TransformNode(id, scene);

  const m = {
    frame:   solidMat(scene, "lm_frame",   [0.48, 0.32, 0.18]),  // milled pine
    dark:    solidMat(scene, "lm_dark",    [0.32, 0.20, 0.11]),  // shadowed beams
    bark:    solidMat(scene, "lm_bark",    [0.36, 0.25, 0.15]),
    sap:     solidMat(scene, "lm_sap",     [0.76, 0.59, 0.35]),  // cut ends
    shingle: solidMat(scene, "lm_shingle", [0.46, 0.24, 0.19]),  // weathered roof
    tile:    solidMat(scene, "lm_tile",    [0.35, 0.17, 0.15]),  // roof courses
    stone:   solidMat(scene, "lm_stone",   [0.52, 0.50, 0.47]),
    stoneDk: solidMat(scene, "lm_stoneDk", [0.41, 0.39, 0.36]),
    dust:    solidMat(scene, "lm_dust",    [0.82, 0.70, 0.48]),  // sawdust
    cloth:   solidMat(scene, "lm_cloth",   [0.72, 0.63, 0.45]),  // sacking
    moss:    solidMat(scene, "lm_moss",    [0.42, 0.65, 0.28]),
    iron:    sharedMat(scene, "lm_iron", () => {
      const mat = new BABYLON.StandardMaterial("lm_iron", scene);
      mat.diffuseColor = new BABYLON.Color3(0.30, 0.31, 0.34);
      mat.specularColor = new BABYLON.Color3(0.45, 0.45, 0.48);
      return mat;
    }),
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
  const cyl = (mat, x, y, z, h, d, rot, tess = 6, dTop) => {
    const opts = dTop === undefined
      ? { height: h, diameter: d, tessellation: tess }
      : { height: h, diameterTop: dTop, diameterBottom: d, tessellation: tess };
    const c = BABYLON.MeshBuilder.CreateCylinder(nextName(), opts, scene);
    c.position.set(x, y, z);
    if (rot) c.rotation.set(rot[0], rot[1], rot[2] || 0);
    return put(c, mat);
  };
  // A stack of boards, laid along the given axis - the mill's stock in trade.
  const stack = (mat, x, y, z, count, alongZ) => {
    for (let s = 0; s < count; s++) {
      const sy = y + s * 0.19;
      if (alongZ) box(s % 2 ? m.frame : mat, x, sy, z, 0.66, 0.14, 0.3);
      else box(s % 2 ? m.frame : mat, x, sy, z, 0.3, 0.14, 0.66);
    }
  };

  // ============================================================
  // Stone footing, corner plinths, and the plank floor they raise
  // ============================================================
  box(m.stone, 0, 0.08, 0, 2.02, 0.16, 2.02);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
    box(m.stoneDk, sx * 0.88, 0.12, sz * 0.88, 0.3, 0.24, 0.3));
  for (let i = 0; i < 7; i++)
    box(i % 2 ? m.dark : m.frame, 0, 0.22, -0.81 + i * 0.27, 1.78, 0.12, 0.23);
  // Worn stone threshold at the front, and two shallow steps down to the yard.
  box(m.stoneDk, 0, 0.16, 1.1, 1.16, 0.1, 0.3);
  box(m.stone, 0, 0.1, 1.36, 1.3, 0.12, 0.26);

  // ============================================================
  // Timber frame: posts, sills, plate, and a brace at every corner
  // ============================================================
  const TOP = 1.78;
  const posts = [[-0.88, -0.88], [0.88, -0.88], [-0.88, 0.88], [0.88, 0.88], [-0.46, 0.88], [0.46, 0.88]];
  posts.forEach(([px, pz]) => cyl(m.frame, px, (0.28 + TOP) / 2, pz, TOP - 0.28, 0.17));

  [-0.9, 0.9].forEach((z) => {
    box(m.dark, 0, 0.34, z, 1.9, 0.13, 0.12);
    box(m.dark, 0, TOP, z, 1.98, 0.14, 0.14);
  });
  [-0.9, 0.9].forEach((x) => {
    box(m.dark, x, 0.34, 0, 0.12, 0.13, 1.9);
    box(m.dark, x, TOP, 0, 0.14, 0.14, 1.98);
  });

  // Angled braces off each post. They are what makes a timber frame read as
  // built rather than as a box with posts stuck on the corners.
  posts.forEach(([px, pz]) => {
    const inX = px === 0 ? 1 : -Math.sign(px);
    const inZ = pz === 0 ? 1 : -Math.sign(pz);
    box(m.dark, px + inX * 0.2, 0.62, pz, 0.4, 0.08, 0.08, [0, 0, -inX * 0.62]);
    box(m.dark, px, 0.62, pz + inZ * 0.2, 0.08, 0.08, 0.4, [inZ * 0.62, 0, 0]);
  });

  // ============================================================
  // Walls: closed back and left, half-high on the right so the light
  // gets in, and open across the front saw bay.
  // ============================================================
  for (let i = 0; i < 8; i++) {
    const x = -0.86 + i * 0.245;
    box(i % 3 === 1 ? m.dark : m.frame, x, 1.06, -0.92, 0.21, 1.42, 0.07);
    box(i % 3 === 2 ? m.dark : m.frame, -0.92, 1.06, x, 0.07, 1.42, 0.21);
    box(i % 2 ? m.dark : m.frame, 0.92, 0.72, x, 0.07, 0.74, 0.21);
  }
  // A window on the right wall with its shutter propped open.
  box(m.dark, 0.94, 1.32, -0.24, 0.05, 0.36, 0.46);
  box(m.frame, 1.16, 1.32, -0.5, 0.05, 0.36, 0.46, [0, -0.85, 0]);

  // Gable ends, stepped up to the ridge at both ends of the frame.
  [-0.9, 0.9].forEach((z) => {
    [[1.5, 1.88], [1.0, 2.05], [0.5, 2.22]].forEach(([w, y], i) =>
      box(i === 1 ? m.dark : m.frame, 0, y, z, w, 0.16, 0.07));
  });

  // ============================================================
  // Roof: two shingled slopes with overlapping courses, barge boards,
  // an eave fascia and a capped ridge.
  // ============================================================
  const PITCH = 0.42;
  const SLOPE = 1.46;
  const eaveY = 1.74;
  const ridgeY = eaveY + Math.sin(PITCH) * SLOPE;
  const eaveX = Math.cos(PITCH) * SLOPE;
  [-1, 1].forEach((side) => {
    box(m.shingle, side * eaveX * 0.5, (eaveY + ridgeY) / 2, 0, SLOPE, 0.09, 2.36, [0, 0, -side * PITCH]);
    [0.2, 0.44, 0.68, 0.92].forEach((t) =>
      box(m.tile, side * eaveX * t, ridgeY - (ridgeY - eaveY) * t + 0.07, 0, 0.3, 0.05, 2.38, [0, 0, -side * PITCH]));
    [-1.18, 1.18].forEach((z) =>
      box(m.dark, side * eaveX * 0.52, (eaveY + ridgeY) / 2 + 0.07, z, SLOPE * 1.02, 0.07, 0.12, [0, 0, -side * PITCH]));
    box(m.dark, side * (eaveX + 0.02), eaveY + 0.04, 0, 0.1, 0.16, 2.38);
  });
  box(m.dark, 0, ridgeY + 0.08, 0, 0.26, 0.14, 2.44);
  [-1.24, 1.24].forEach((z) => cyl(m.dark, 0, ridgeY + 0.15, z, 0.2, 0.17, [Math.PI / 2, 0, 0], 6));
  // Moss on the shady slope - the one growth the roof lets through.
  cyl(m.moss, -0.62, eaveY + 0.55, 0.52, 0.12, 0.3, null, 7, 0.02);
  cyl(m.moss, -0.34, eaveY + 0.72, -0.66, 0.11, 0.24, null, 7, 0.02);

  // ============================================================
  // Saw bay: a log on trestles, a two-man whipsaw across it, and the
  // mess it makes. Nothing here turns - the crew is the animation.
  // ============================================================
  [-0.5, 0.5].forEach((tx) => {
    [-0.15, 0.15].forEach((tz) => box(m.dark, tx, 0.5, 0.7 + tz, 0.09, 0.5, 0.09, [tz > 0 ? -0.18 : 0.18, 0, 0]));
    box(m.frame, tx, 0.78, 0.7, 0.12, 0.08, 0.44);
  });
  box(m.bark, 0, 0.9, 0.7, 1.34, 0.28, 0.28, [0, 0, 0.05]);
  [-0.68, 0.68].forEach((ex) => cyl(m.sap, ex, 0.9, 0.7, 0.05, 0.26, [0, 0, Math.PI / 2], 9));
  [-0.34, 0.34].forEach((dx) => box(m.iron, dx, 1.06, 0.7, 0.06, 0.15, 0.3));

  box(m.iron, 0, 1.09, 0.7, 1.62, 0.025, 0.11, [0, 0, 0.05]);
  [-1, 1].forEach((side) => {
    box(m.frame, side * 0.87, 1.17, 0.7, 0.2, 0.06, 0.06, [0, 0, side * -0.5]);
    box(m.dark, side * 0.78, 1.06, 0.7, 0.05, 0.1, 0.1);
  });

  // Sawdust heaped under the cut.
  cyl(m.dust, 0.12, 0.3, 1.26, 0.2, 0.68, null, 10, 0.04);
  cyl(m.dust, -0.36, 0.28, 1.16, 0.14, 0.42, null, 9, 0.03);

  // Tool bench against the front-left post: axe, maul, and a sharpening stone.
  box(m.frame, -0.58, 0.5, 0.44, 0.62, 0.08, 0.34);
  [-0.8, -0.36].forEach((bx) => box(m.dark, bx, 0.32, 0.44, 0.07, 0.36, 0.3));
  box(m.iron, -0.66, 0.6, 0.44, 0.16, 0.11, 0.07, [0, 0.3, 0]);
  cyl(m.frame, -0.56, 0.58, 0.46, 0.36, 0.045, [0, 0.3, Math.PI / 2.5], 6);
  cyl(m.dark, -0.44, 0.6, 0.38, 0.16, 0.11, [Math.PI / 2, 0, 0], 8);
  box(m.stoneDk, -0.7, 0.57, 0.34, 0.14, 0.05, 0.09);

  // Sack of offcuts and a nail bucket by the door.
  cyl(m.cloth, 0.66, 0.42, 0.44, 0.36, 0.34, null, 9);
  cyl(m.cloth, 0.66, 0.63, 0.44, 0.1, 0.34, null, 9, 0.16);
  cyl(m.dark, 0.72, 0.36, -0.34, 0.28, 0.3, null, 10);
  cyl(m.iron, 0.72, 0.5, -0.34, 0.02, 0.31, null, 10);

  // ============================================================
  // Finished lumber: a lean-to rack on the right, stacked with bundles
  // ============================================================
  [0.06, 1.04].forEach((lz) => cyl(m.dark, 1.66, 0.62, lz, 1.0, 0.13));
  box(m.shingle, 1.62, 1.24, 0.55, 0.94, 0.08, 1.34, [0, 0, -0.32]);
  box(m.dark, 1.2, 0.78, 0.55, 0.1, 0.08, 1.3);
  stack(m.dark, 1.54, 0.34, 0.2, 3, true);
  stack(m.dark, 1.54, 0.34, 0.9, 2, true);
  // End grain on every bundle, so the stack reads as planks and not as crates.
  [0.2, 0.58, 0.9].forEach((bz) => [-0.02, 0.17, 0.36].forEach((oy) =>
    box(m.sap, 1.2, 0.34 + oy, bz, 0.03, 0.12, 0.26)));

  // ============================================================
  // Green logs: a wall of them against the left outside, plus rounds
  // ============================================================
  [[-0.5, 0.36], [-0.16, 0.36], [0.18, 0.36], [-0.33, 0.65], [0.01, 0.65], [-0.16, 0.93]].forEach(([lz, ly]) => {
    cyl(m.bark, -1.42, ly, lz, 1.5, 0.3, [0, 0, Math.PI / 2], 8);
    cyl(m.sap, -2.18, ly, lz, 0.04, 0.26, [0, 0, Math.PI / 2], 8);
  });
  cyl(m.bark, -1.16, 0.16, 1.28, 0.5, 0.3, [0, 0, Math.PI / 2], 8);
  cyl(m.sap, -0.9, 0.16, 1.28, 0.04, 0.26, [0, 0, Math.PI / 2], 8);

  // ============================================================
  // Sign over the bay: bracket, board, and a carved log emblem
  // ============================================================
  box(m.dark, 0.3, TOP - 0.04, 1.14, 0.7, 0.09, 0.09);
  box(m.dark, 0.6, TOP - 0.2, 1.14, 0.07, 0.26, 0.07);
  [-0.06, 0.06].forEach((dx) => box(m.iron, 0.6 + dx, TOP - 0.35, 1.14, 0.03, 0.1, 0.03));
  box(m.frame, 0.6, TOP - 0.54, 1.14, 0.52, 0.32, 0.06);
  box(m.dark, 0.6, TOP - 0.54, 1.17, 0.44, 0.24, 0.02);
  cyl(m.bark, 0.6, TOP - 0.54, 1.19, 0.28, 0.1, [0, 0, Math.PI / 2], 8);
  cyl(m.sap, 0.46, TOP - 0.54, 1.19, 0.1, 0.02, [0, 0, Math.PI / 2], 8);

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
      cyl(m.frame, x, tall + 0.06, z, 0.12, 0.17, null, 6, 0.02);
    };
    const railRun = (x0, z0, x1, z1) => {
      fencePost(x0, z0);
      fencePost(x1, z1);
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const len = Math.hypot(x1 - x0, z1 - z0);
      [0.34, 0.66].forEach((railY) =>
        box(m.frame, (x0 + x1) / 2, railY, (z0 + z1) / 2, alongX ? len : 0.08, 0.12, alongX ? 0.08 : len));
      // A stub post and a short mid-rail break up the long runs.
      if (len > 3) {
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        fencePost(mx, mz, 0.84);
        box(m.frame, mx, 0.5, mz, alongX ? len * 0.44 : 0.07, 0.09, alongX ? 0.07 : len * 0.44);
      }
    };

    railRun(-YARD_HALF, -YARD_HALF, YARD_HALF, -YARD_HALF);
    railRun(-YARD_HALF, YARD_HALF, -GATE_HALF, YARD_HALF);
    railRun(GATE_HALF, YARD_HALF, YARD_HALF, YARD_HALF);
    railRun(-YARD_HALF, -YARD_HALF, -YARD_HALF, YARD_HALF);
    railRun(YARD_HALF, -YARD_HALF, YARD_HALF, YARD_HALF);

    // Gate leaf, hinged on the left jamb and swung open into the yard.
    const GA = -1.15;
    const cos = Math.cos(GA), sin = Math.sin(GA);
    const leaf = (mat, along, up, w, h, roll = 0) =>
      box(mat, -GATE_HALF + cos * along, up, YARD_HALF + sin * along, w, h, 0.06, [0, -GA, roll]);
    fencePost(-GATE_HALF, YARD_HALF, 1.08);
    fencePost(GATE_HALF, YARD_HALF, 1.08);
    leaf(m.frame, 0.95, 0.32, 1.85, 0.1);
    leaf(m.frame, 0.95, 0.68, 1.85, 0.1);
    [0.25, 0.95, 1.65].forEach((a) => leaf(m.dark, a, 0.5, 0.12, 0.62));
    leaf(m.dark, 0.95, 0.5, 1.66, 0.07, 0.5);

    // A stump, a bench and a trough: the yard is worked ground, not a pen.
    cyl(m.bark, 2.35, 0.2, -2.2, 0.4, 0.56, null, 9);
    cyl(m.sap, 2.35, 0.41, -2.2, 0.03, 0.5, null, 9);
    box(m.frame, -2.42, 0.42, 2.15, 0.9, 0.09, 0.3, [0, 0.42, 0]);
    [-2.76, -2.08].forEach((bx) => box(m.dark, bx, 0.2, 2.24, 0.09, 0.4, 0.26));
    [0.17, -0.17].forEach((tz) => box(m.dark, 2.92, 0.24, 1.5 + tz, 0.62, 0.44, 0.07));
    [0.29, -0.29].forEach((tx) => box(m.dark, 2.92 + tx, 0.24, 1.5, 0.07, 0.44, 0.32));
    box(m.frame, 2.92, 0.48, 1.5, 0.68, 0.06, 0.42);
  }

  groups.forEach((parts, mat) => {
    const merged = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
    if (!merged) return;
    merged.name = id + "_body";
    merged.material = mat;
    merged.parent = root;
  });

  // ============================================================
  // Lantern: the one warm note on the building, and the only thing that
  // still moves - so it stays out of the merge.
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
  add(BABYLON.MeshBuilder.CreateCylinder(id + "_lampCap", { height: 0.08, diameterTop: 0.02, diameterBottom: 0.16, tessellation: 6 }, scene), m.iron)
    .position.set(0.46, 1.63, 1.1);

  const finished = flatShade(root);
  finished.scaling.setAll(MILL_SCALE);
  return finished;
}

