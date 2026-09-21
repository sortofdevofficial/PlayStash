import { flatShade } from "../flatShade.js";

export function createFarm(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const soilMat = new BABYLON.StandardMaterial(id + "_soilMat", scene);
  soilMat.diffuseColor = new BABYLON.Color3(0.38, 0.25, 0.15); // rich warm earth
  soilMat.specularColor = new BABYLON.Color3(0, 0, 0);
  soilMat.flatShaded = true;

  const soilMatDark = new BABYLON.StandardMaterial(id + "_soilMatD", scene);
  soilMatDark.diffuseColor = new BABYLON.Color3(0.28, 0.18, 0.10);
  soilMatDark.specularColor = new BABYLON.Color3(0, 0, 0);
  soilMatDark.flatShaded = true;

  const borderMat = new BABYLON.StandardMaterial(id + "_borderMat", scene);
  borderMat.diffuseColor = new BABYLON.Color3(0.46, 0.32, 0.18); // rustic cedar fence
  borderMat.specularColor = new BABYLON.Color3(0, 0, 0);
  borderMat.flatShaded = true;

  const stalkMat = new BABYLON.StandardMaterial(id + "_stalkMat", scene);
  stalkMat.diffuseColor = new BABYLON.Color3(0.52, 0.65, 0.22); // healthy green shoots
  stalkMat.specularColor = new BABYLON.Color3(0, 0, 0);
  stalkMat.flatShaded = true;

  const wheatMat = new BABYLON.StandardMaterial(id + "_wheatMat", scene);
  wheatMat.diffuseColor = new BABYLON.Color3(0.96, 0.78, 0.26); // warm golden ripe wheat
  wheatMat.specularColor = new BABYLON.Color3(0, 0, 0);
  wheatMat.flatShaded = true;

  const pumpkinMat = new BABYLON.StandardMaterial(id + "_pumpkinMat", scene);
  pumpkinMat.diffuseColor = new BABYLON.Color3(0.95, 0.52, 0.12); // cozy orange pumpkin
  pumpkinMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  pumpkinMat.flatShaded = true;

  // Base soil plot, sized for a 2x2 footprint
  const soil = BABYLON.MeshBuilder.CreateBox(id + "_soil", { width: 1.9, height: 0.1, depth: 1.9 }, scene);
  soil.position.y = 0.05;
  soil.material = soilMat;
  soil.parent = root;

  // Low wooden border frame around the plot
  const borderSpecs = [
    { w: 2.0, d: 0.1, x: 0, z: 0.95 },
    { w: 2.0, d: 0.1, x: 0, z: -0.95 },
    { w: 0.1, d: 1.8, x: 0.95, z: 0 },
    { w: 0.1, d: 1.8, x: -0.95, z: 0 }
  ];
  borderSpecs.forEach((b, i) => {
    const rail = BABYLON.MeshBuilder.CreateBox(id + "_border_" + i, { width: b.w, height: 0.14, depth: b.d }, scene);
    rail.position.set(b.x, 0.07, b.z);
    rail.material = borderMat;
    rail.parent = root;
  });

  // Tilled furrow rows across the soil for texture
  for (let r = 0; r < 4; r++) {
    const furrow = BABYLON.MeshBuilder.CreateBox(id + "_furrow_" + r, { width: 1.75, height: 0.04, depth: 0.18 }, scene);
    furrow.position.set(0, 0.1, -0.68 + r * 0.45);
    furrow.material = soilMatDark;
    furrow.parent = root;
  }

  // Dense wheat rows — each stalk gets its own pivot node so it can wiggle independently
  const stalks = [];
  const rows = 5;
  const cols = 5;
  for (let ix = 0; ix < cols; ix++) {
    for (let iz = 0; iz < rows; iz++) {
      const x = -0.72 + (ix / (cols - 1)) * 1.44 + (Math.random() - 0.5) * 0.06;
      const z = -0.72 + (iz / (rows - 1)) * 1.44 + (Math.random() - 0.5) * 0.06;
      const idx = ix * rows + iz;

      const pivot = new BABYLON.TransformNode(id + "_stalkPivot_" + idx, scene);
      pivot.position.set(x, 0.1, z);
      pivot.parent = root;

      const stalkHeight = 0.32 + Math.random() * 0.14;
      const stalk = BABYLON.MeshBuilder.CreateCylinder(id + "_stalk_" + idx, { height: stalkHeight, diameterTop: 0.02, diameterBottom: 0.035, tessellation: 4 }, scene);
      stalk.position.y = stalkHeight / 2;
      stalk.material = stalkMat;
      stalk.parent = pivot;

      const head = BABYLON.MeshBuilder.CreateBox(id + "_head_" + idx, { width: 0.07, height: 0.16, depth: 0.07 }, scene);
      head.position.y = stalkHeight + 0.06;
      head.material = wheatMat;
      head.parent = pivot;

      stalks.push({ pivot, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 0.5 });
    }
  }

  // Cute low-poly corner pumpkin patch details
  const pumpkin = BABYLON.MeshBuilder.CreateSphere(id + "_pumpkin", { diameter: 0.28, segments: 5 }, scene);
  pumpkin.scaling.set(1.15, 0.85, 1.1);
  pumpkin.position.set(0.72, 0.16, 0.72);
  pumpkin.material = pumpkinMat;
  pumpkin.parent = root;

  const stem = BABYLON.MeshBuilder.CreateCylinder(id + "_pStem", { height: 0.08, diameter: 0.03, tessellation: 4 }, scene);
  stem.position.set(0.72, 0.28, 0.72);
  stem.rotation.z = 0.2;
  stem.material = stalkMat;
  stem.parent = root;

  root.metadata = { stalks };
  return flatShade(root);
}

// Call each frame to sway the wheat like wind is passing through it
export function updateFarmWiggle(farmRoot, time) {
  const stalks = farmRoot.metadata?.stalks;
  if (!stalks) return;
  for (const s of stalks) {
    const sway = Math.sin(time * s.speed + s.phase) * 0.12;
    s.pivot.rotation.z = sway;
    s.pivot.rotation.x = Math.cos(time * s.speed * 0.7 + s.phase) * 0.05;
  }
}