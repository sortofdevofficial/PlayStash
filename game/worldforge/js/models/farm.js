import { flatShade } from "../flatShade.js";
import { solidMat } from "./materials.js";

export function createFarm(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const soilMat = solidMat(scene, "farm_soil", [0.38, 0.25, 0.15]); // rich warm earth
  const soilMatDark = solidMat(scene, "farm_soilDark", [0.28, 0.18, 0.10]);
  const borderMat = solidMat(scene, "farm_border", [0.46, 0.32, 0.18]); // rustic cedar fence
  const stalkMat = solidMat(scene, "farm_stalk", [0.52, 0.65, 0.22]); // healthy green shoots
  const wheatMat = solidMat(scene, "farm_wheat", [0.96, 0.78, 0.26]); // warm golden ripe wheat
  const wheatLightMat = solidMat(scene, "farm_wheatLight", [0.99, 0.87, 0.45]); // sun-bleached ears

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

  // Dense wheat rows - each stalk gets its own pivot node so it can wiggle
  // independently.
  const stalks = [];
  const rows = 6;
  const cols = 6;
  for (let ix = 0; ix < cols; ix++) {
    for (let iz = 0; iz < rows; iz++) {
      const x = -0.74 + (ix / (cols - 1)) * 1.48 + (Math.random() - 0.5) * 0.05;
      const z = -0.74 + (iz / (rows - 1)) * 1.48 + (Math.random() - 0.5) * 0.05;
      const idx = ix * rows + iz;

      const pivot = new BABYLON.TransformNode(id + "_stalkPivot_" + idx, scene);
      pivot.position.set(x, 0.1, z);
      pivot.parent = root;

      const stalkHeight = 0.38 + Math.random() * 0.2;
      const stalk = BABYLON.MeshBuilder.CreateCylinder(id + "_stalk_" + idx, { height: stalkHeight, diameterTop: 0.016, diameterBottom: 0.032, tessellation: 4 }, scene);
      stalk.position.y = stalkHeight / 2;
      stalk.material = stalkMat;
      stalk.parent = pivot;

      // Tapered ear rather than a cube head: the widest point sits just under
      // the tip so it catches a highlight the way a grain head does.
      const ear = BABYLON.MeshBuilder.CreateCylinder(id + "_ear_" + idx, { height: 0.21, diameterTop: 0.028, diameterBottom: 0.078, tessellation: 5 }, scene);
      ear.position.y = stalkHeight + 0.08;
      ear.rotation.x = (Math.random() - 0.5) * 0.22;
      ear.material = (ix + iz) % 3 === 0 ? wheatLightMat : wheatMat;
      ear.parent = pivot;

      stalks.push({ pivot, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 0.5 });
    }
  }

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