import { flatShade } from "../flatShade.js";

export function createWell(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  // --- Materials ---
  function mat(suffix, r, g, b, specR=0, specG=0, specB=0) {
    const m = new BABYLON.StandardMaterial(id + suffix, scene);
    m.diffuseColor = new BABYLON.Color3(r, g, b);
    m.specularColor = new BABYLON.Color3(specR, specG, specB);
    return m;
  }

  const stoneMat   = mat("_s1",  0.58, 0.54, 0.48); // warm sandstone
  const stoneDark  = mat("_s2",  0.42, 0.38, 0.34); // shadowed cobble
  const stoneMoss  = mat("_s3",  0.36, 0.50, 0.30); // mossy accent
  const woodMat    = mat("_w",   0.44, 0.29, 0.14); // dark cedar beam
  const roofMat    = mat("_r",   0.70, 0.34, 0.20); // terracotta
  const roofDark   = mat("_rd",  0.52, 0.24, 0.14); // dark terracotta shading
  const ropeMat    = mat("_rp",  0.72, 0.58, 0.32); // hemp rope
  const bucketMat  = mat("_bk",  0.40, 0.26, 0.12); // dark wood bucket
  const bucketBand = mat("_bb",  0.28, 0.26, 0.24); // iron hoop on bucket
  const waterMat   = mat("_wt",  0.28, 0.62, 0.82, 0.3, 0.4, 0.5);
  waterMat.alpha = 0.88;
  waterMat.emissiveColor = new BABYLON.Color3(0.08, 0.22, 0.32);

  // Vine / flower mats
  const vineMat    = mat("_vn",  0.22, 0.42, 0.18);
  const flowerMat  = mat("_fl",  0.92, 0.42, 0.55); // soft pink flower

  // --- Chunky cobblestone ring wall ---
  // 8 large uneven stones arranged in a ring for a hand-built feel
  const ringSegs = 8;
  const ringMats = [stoneMat, stoneDark, stoneMat, stoneMoss, stoneDark, stoneMat, stoneDark, stoneMoss];
  for (let i = 0; i < ringSegs; i++) {
    const angle = (i / ringSegs) * Math.PI * 2;
    const cx = Math.cos(angle) * 0.52;
    const cz = Math.sin(angle) * 0.52;
    // Vary height slightly for organic look
    const h = 0.46 + (i % 3) * 0.06;
    const w = 0.34 + (i % 2) * 0.05;

    const stone = BABYLON.MeshBuilder.CreateBox(id + "_rs_" + i, { width: w, height: h, depth: 0.22 }, scene);
    stone.position.set(cx, h / 2, cz);
    stone.rotation.y = -angle + (i % 2 === 0 ? 0.08 : -0.06);
    stone.material = ringMats[i];
    stone.parent = root;

    // Small capping pebble on each stone — gives stacked look
    if (i % 2 === 0) {
      const cap = BABYLON.MeshBuilder.CreateBox(id + "_cap_" + i, { width: w * 0.7, height: 0.08, depth: 0.18 }, scene);
      cap.position.set(cx * 0.98, h + 0.04, cz * 0.98);
      cap.rotation.y = stone.rotation.y + 0.1;
      cap.material = i === 2 ? stoneMoss : stoneDark;
      cap.parent = root;
    }
  }

  // Inner base ring to fill the bottom (so it doesn't look hollow from above)
  const wellBase = BABYLON.MeshBuilder.CreateCylinder(id + "_base", { diameter: 1.0, height: 0.1, tessellation: 8 }, scene);
  wellBase.position.y = 0.05;
  wellBase.material = stoneDark;
  wellBase.parent = root;

  // Water surface inside the ring
  const water = BABYLON.MeshBuilder.CreateCylinder(id + "_water", { diameter: 0.76, height: 0.04, tessellation: 10 }, scene);
  water.position.y = 0.44;
  water.material = waterMat;
  water.parent = root;

  // --- Support posts --- (chunky hex logs, not thin cylinders)
  const postPositions = [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]];
  postPositions.forEach(([px, pz], i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { height: 1.15, diameter: 0.10, tessellation: 6 }, scene);
    post.position.set(px, 0.575, pz);
    post.rotation.y = (i * Math.PI) / 4;
    post.material = woodMat;
    post.parent = root;
  });

  // --- Terracotta roof (two-layer for depth) ---
  const roofMain = BABYLON.MeshBuilder.CreateCylinder(id + "_roofMain", {
    height: 0.52, diameterTop: 0.06, diameterBottom: 1.42, tessellation: 6
  }, scene);
  roofMain.position.y = 1.40;
  roofMain.material = roofMat;
  roofMain.parent = root;

  const roofSkirt = BABYLON.MeshBuilder.CreateCylinder(id + "_roofSkirt", {
    height: 0.14, diameterTop: 1.38, diameterBottom: 1.56, tessellation: 6
  }, scene);
  roofSkirt.position.y = 1.18;
  roofSkirt.material = roofDark;
  roofSkirt.parent = root;

  // Small decorative knob at peak
  const roofKnob = BABYLON.MeshBuilder.CreateSphere(id + "_knob", { diameter: 0.09, segments: 4 }, scene);
  roofKnob.position.y = 1.68;
  roofKnob.material = woodMat;
  roofKnob.parent = root;

  // --- Crossbeam + rope + bucket ---
  const beam = BABYLON.MeshBuilder.CreateCylinder(id + "_beam", { height: 0.96, diameter: 0.08, tessellation: 6 }, scene);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, 1.08, 0);
  beam.material = woodMat;
  beam.parent = root;

  const rope = BABYLON.MeshBuilder.CreateCylinder(id + "_rope", { height: 0.42, diameter: 0.025, tessellation: 4 }, scene);
  rope.position.set(0.30, 0.82, 0);
  rope.material = ropeMat;
  rope.parent = root;

  // Larger, more charming bucket
  const bucket = BABYLON.MeshBuilder.CreateCylinder(id + "_bucket", {
    height: 0.22, diameterTop: 0.20, diameterBottom: 0.15, tessellation: 8
  }, scene);
  bucket.position.set(0.30, 0.59, 0);
  bucket.material = bucketMat;
  bucket.parent = root;

  // Iron hoop around bucket
  const hoop = BABYLON.MeshBuilder.CreateTorus(id + "_hoop", { diameter: 0.18, thickness: 0.016, tessellation: 10 }, scene);
  hoop.position.set(0.30, 0.64, 0);
  hoop.material = bucketBand;
  hoop.parent = root;

  // --- Vine & flower decoration at the base ---
  // 3 small vine leaves around the base of the well
  const vineOffsets = [
    [0.60, 0.22, -0.18],
    [-0.58, 0.18, 0.22],
    [-0.10, 0.20, 0.60],
  ];
  vineOffsets.forEach(([vx, vy, vz], i) => {
    const vine = BABYLON.MeshBuilder.CreateSphere(id + "_vine_" + i, { diameter: 0.12, segments: 3 }, scene);
    vine.scaling.set(1.6, 0.55, 1.3);
    vine.position.set(vx, vy, vz);
    vine.material = vineMat;
    vine.parent = root;

    // Tiny flower on top of some vines
    if (i % 2 === 0) {
      const flower = BABYLON.MeshBuilder.CreateSphere(id + "_flower_" + i, { diameter: 0.08, segments: 3 }, scene);
      flower.position.set(vx, vy + 0.09, vz);
      flower.material = flowerMat;
      flower.parent = root;
    }
  });

  return flatShade(root);
}
