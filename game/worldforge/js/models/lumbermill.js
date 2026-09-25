import { flatShade } from "../flatShade.js";

// Materials are per-scene, not per-call. Every model used to build its own
// StandardMaterials, and world.js then cloned each one again per mesh, so a
// 100-building world carried well over a thousand materials. Previews run in
// their own scenes, so the cache is keyed by scene rather than global.
const matCache = new WeakMap();

function materials(scene) {
  let cached = matCache.get(scene);
  if (cached) return cached;

  const make = (name, r, g, b, spec = 0) => {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = new BABYLON.Color3(r, g, b);
    m.specularColor = new BABYLON.Color3(spec, spec, spec);
    return m;
  };

  cached = {
    timber:  make("lm_timber",  0.46, 0.30, 0.17),            // milled pine frame
    dark:    make("lm_dark",    0.30, 0.19, 0.11),             // shadowed beams
    bark:    make("lm_bark",    0.36, 0.25, 0.15),             // log bark
    sap:     make("lm_sap",     0.72, 0.55, 0.32),             // cut log ends
    shingle: make("lm_shingle", 0.52, 0.28, 0.22),             // weathered roof
    steel:   make("lm_steel",   0.72, 0.74, 0.76, 0.35),       // saw blade
    stone:   make("lm_stone",   0.52, 0.50, 0.47),             // footing
    yard:    make("lm_yard",    0.40, 0.27, 0.15),             // woodlot fence
    lamp:    (() => {
      const m = make("lm_lamp", 0.55, 0.40, 0.20);
      m.emissiveColor = new BABYLON.Color3(0.85, 0.58, 0.20);  // warm workshop glow
      return m;
    })(),
  };
  matCache.set(scene, cached);
  return cached;
}

// withYard is off for the build preview and the placement ghost: those cameras
// auto-fit the mesh bounding box, so the full woodlot fence would shrink the
// shed itself to a speck in its card.
export function createLumbermill(id, scene, withYard = true) {
  const root = new BABYLON.TransformNode(id, scene);
  const mat = materials(scene);
  const add = (mesh, m) => { mesh.material = m; mesh.parent = root; return mesh; };

  // --- Stone footing, then the timber floor it raises the shed on ---
  add(BABYLON.MeshBuilder.CreateBox(id + "_footing", { width: 1.94, height: 0.16, depth: 1.94 }, scene), mat.stone)
    .position.y = 0.08;
  add(BABYLON.MeshBuilder.CreateBox(id + "_floor", { width: 1.8, height: 0.12, depth: 1.8 }, scene), mat.timber)
    .position.y = 0.22;

  // --- Frame posts, including a mid-pair that carries the roof's ridge ---
  const posts = [[-0.82, -0.82], [0.82, -0.82], [-0.82, 0.82], [0.82, 0.82], [0, -0.82], [0, 0.82]];
  posts.forEach(([px, pz], i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { height: 1.32, diameter: 0.15, tessellation: 6 }, scene);
    post.position.set(px, 0.94, pz);
    add(post, i % 2 ? mat.dark : mat.timber);
  });

  // --- Gable roof: two slanted planes meeting at a ridge board ---
  const roofPitch = 0.52;
  [-1, 1].forEach((side) => {
    const slope = BABYLON.MeshBuilder.CreateBox(id + "_roof_" + side, { width: 1.28, height: 0.09, depth: 2.16 }, scene);
    slope.position.set(side * 0.55, 1.72, 0);
    slope.rotation.z = -side * roofPitch;
    add(slope, mat.shingle);
  });
  add(BABYLON.MeshBuilder.CreateBox(id + "_ridge", { width: 0.24, height: 0.13, depth: 2.26 }, scene), mat.dark)
    .position.set(0, 2.02, 0);

  // Gable ends close the triangles under the roof.
  [-1, 1].forEach((side) => {
    const gable = BABYLON.MeshBuilder.CreateCylinder(id + "_gable_" + side, { height: 0.06, diameter: 1.5, tessellation: 3 }, scene);
    gable.rotation.x = Math.PI / 2;
    gable.rotation.y = side * Math.PI / 2;
    gable.scaling.set(1, 0.62, 1);
    gable.position.set(side * 0.9, 1.68, 0);
    add(gable, mat.timber);
  });

  // --- Saw pit: a log on trestles fed into the blade at the open front ---
  const trestle = [-0.52, 0.52];
  trestle.forEach((tx, i) => {
    const leg = BABYLON.MeshBuilder.CreateBox(id + "_trestle_" + i, { width: 0.1, height: 0.46, depth: 0.34 }, scene);
    leg.position.set(tx, 0.51, 0.66);
    add(leg, mat.dark);
  });
  add(BABYLON.MeshBuilder.CreateBox(id + "_log", { width: 1.3, height: 0.24, depth: 0.24 }, scene), mat.bark)
    .position.set(0, 0.86, 0.66);

  // Holder supplies the blade's orientation; the blade spins inside it, so the
  // animation axis never has to be recomposed out of Euler order.
  const sawHolder = new BABYLON.TransformNode(id + "_sawHolder", scene);
  sawHolder.position.set(0, 1.02, 0.66);
  sawHolder.rotation.z = Math.PI / 2;
  sawHolder.parent = root;

  const blade = BABYLON.MeshBuilder.CreateCylinder(id + "_blade", { height: 0.035, diameter: 0.62, tessellation: 24 }, scene);
  blade.material = mat.steel;
  blade.parent = sawHolder;

  // Four teeth keep the spin readable at gameplay camera distance - a plain
  // disc looks stationary no matter how fast it turns.
  for (let i = 0; i < 4; i++) {
    const tooth = BABYLON.MeshBuilder.CreateBox(id + "_tooth_" + i, { width: 0.09, height: 0.05, depth: 0.13 }, scene);
    const a = (i / 4) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);
    tooth.rotation.y = -a;
    tooth.material = mat.steel;
    tooth.parent = sawHolder;
  }
  const arbor = BABYLON.MeshBuilder.CreateCylinder(id + "_arbor", { height: 0.12, diameter: 0.13, tessellation: 8 }, scene);
  arbor.material = mat.dark;
  arbor.parent = sawHolder;

  // --- Log pile stacked against the left wall ---
  const pile = [[-0.62, -0.42], [-0.62, -0.02], [-0.62, 0.38], [-0.32, -0.22], [-0.32, 0.18]];
  pile.forEach(([px, pz], i) => {
    const log = BABYLON.MeshBuilder.CreateCylinder(id + "_log_" + i, { height: 0.78, diameter: 0.26, tessellation: 7 }, scene);
    log.rotation.x = Math.PI / 2;
    log.position.set(px, 0.41 + (i > 2 ? 0.24 : 0), pz);
    add(log, mat.bark);
    const end = BABYLON.MeshBuilder.CreateCylinder(id + "_logEnd_" + i, { height: 0.04, diameter: 0.22, tessellation: 7 }, scene);
    end.rotation.x = Math.PI / 2;
    end.position.set(px, 0.41 + (i > 2 ? 0.24 : 0), pz + 0.39);
    add(end, mat.sap);
  });

  // --- The mill's woodlot: a fenced yard enclosing the shed. YARD_HALF has to
  //     agree with WOODLOT_PAD in world.js, because that pad is the square the
  //     lot's trees regrow inside. Every post and rail merges into one mesh, so
  //     a yard costs a single draw call instead of two dozen. ---
  if (withYard) {
    const YARD_HALF = 3.5; // local units; the root sits at the centre of the lot
    const GATE_HALF = 0.95;
    const parts = [];
    const seen = new Set();

    const post = (x, z) => {
      const key = x + "," + z;
      if (seen.has(key)) return;
      seen.add(key);
      const p = BABYLON.MeshBuilder.CreateCylinder(id + "_yardPost", { height: 0.95, diameter: 0.16, tessellation: 6 }, scene);
      p.position.set(x, 0.475, z);
      parts.push(p);
    };

    const run = (x0, z0, x1, z1) => {
      post(x0, z0);
      post(x1, z1);
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const len = Math.hypot(x1 - x0, z1 - z0);
      [0.36, 0.68].forEach((railY) => {
        const rail = BABYLON.MeshBuilder.CreateBox(id + "_yardRail", {
          width: alongX ? len : 0.08, height: 0.11, depth: alongX ? 0.08 : len
        }, scene);
        rail.position.set((x0 + x1) / 2, railY, (z0 + z1) / 2);
        parts.push(rail);
      });
    };

    run(-YARD_HALF, -YARD_HALF, YARD_HALF, -YARD_HALF);                   // back
    run(-YARD_HALF, YARD_HALF, -GATE_HALF, YARD_HALF);                     // front, left of the gate
    run(GATE_HALF, YARD_HALF, YARD_HALF, YARD_HALF);                       // front, right of the gate
    run(-YARD_HALF, -YARD_HALF, -YARD_HALF, YARD_HALF);                    // flanks
    run(YARD_HALF, -YARD_HALF, YARD_HALF, YARD_HALF);
    post(-YARD_HALF, 0); post(YARD_HALF, 0); post(0, -YARD_HALF);          // mid posts carry the long runs

    const fence = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
    if (fence) {
      fence.name = id + "_yard";
      fence.material = mat.yard;
      fence.parent = root;
    }
  }

  // --- Lantern under the eave: the one warm, glowing note on the building ---
  add(BABYLON.MeshBuilder.CreateBox(id + "_lampArm", { width: 0.06, height: 0.06, depth: 0.28 }, scene), mat.dark)
    .position.set(0.62, 1.42, 0.9);
  const lamp = BABYLON.MeshBuilder.CreateCylinder(id + "_lamp", { height: 0.2, diameterTop: 0.1, diameterBottom: 0.14, tessellation: 6 }, scene);
  lamp.position.set(0.62, 1.28, 1.04);
  add(lamp, mat.lamp);

  root.metadata = { saw: sawHolder, lamp };
  return flatShade(root);
}

/**
 * Spin the saw. Speed tracks how many NPCs the player staffed the mill with,
 * so an empty mill idles and a full crew visibly works faster.
 */
export function updateLumbermill(millRoot, delta) {
  const meta = millRoot.metadata;
  if (!meta) return;
  const speed = 1.2 + 2.6 * (meta.crewSpeed || 0);
  if (meta.saw) meta.saw.rotation.y += delta * speed * 3.2;
  if (meta.lamp) meta.lamp.scaling.y = 1 + Math.sin(performance.now() * 0.0012) * 0.03;
}
