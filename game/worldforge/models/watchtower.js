export function createWatchtower(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  // --- MATERIALS ---
  const woodMat = new BABYLON.StandardMaterial(id + "_wMat", scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.15); // Warmer cedar
  woodMat.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMat.flatShaded = true;

  const darkWoodMat = new BABYLON.StandardMaterial(id + "_dwMat", scene);
  darkWoodMat.diffuseColor = new BABYLON.Color3(0.25, 0.15, 0.08); // Dark mahogany/treated wood
  darkWoodMat.specularColor = new BABYLON.Color3(0, 0, 0);
  darkWoodMat.flatShaded = true;

  const stoneMat = new BABYLON.StandardMaterial(id + "_sMat", scene);
  stoneMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.42); // Cool slate grey
  stoneMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  stoneMat.flatShaded = true;

  const thatchMat = new BABYLON.StandardMaterial(id + "_thMat", scene);
  thatchMat.diffuseColor = new BABYLON.Color3(0.6, 0.5, 0.3); // Golden straw
  thatchMat.specularColor = new BABYLON.Color3(0, 0, 0);
  thatchMat.flatShaded = true;

  const ropeMat = new BABYLON.StandardMaterial(id + "_rMat", scene);
  ropeMat.diffuseColor = new BABYLON.Color3(0.7, 0.6, 0.4); 
  ropeMat.specularColor = new BABYLON.Color3(0, 0, 0);
  ropeMat.flatShaded = true;

  const metalMat = new BABYLON.StandardMaterial(id + "_mMat", scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  metalMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
  metalMat.flatShaded = true;

  const lanternMat = new BABYLON.StandardMaterial(id + "_lMat", scene);
  lanternMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3); // Glowing yellow
  lanternMat.diffuseColor = new BABYLON.Color3(1, 0.8, 0.3);

  const legPositions = [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]];

  // --- LEGS & FOUNDATION ---
  legPositions.forEach(([px, pz], i) => {
    // Tapered Main Pillar
    const leg = BABYLON.MeshBuilder.CreateCylinder(id + "_l" + i, { height: 3.2, diameterTop: 0.12, diameterBottom: 0.18, tessellation: 6 }, scene);
    leg.position.set(px, 1.6, pz);
    leg.material = woodMat;
    leg.parent = root;

    // More "rugged" stone footings
    const footing = BABYLON.MeshBuilder.CreateBox(id + "_foot" + i, { width: 0.35, height: 0.2, depth: 0.35 }, scene);
    footing.position.set(px, 0.1, pz);
    footing.material = stoneMat;
    footing.parent = root;
    footing.rotation.y = Math.random() * 0.2; // Slight organic rotation
  });

  // --- STRUCTURAL BRACING ---
  const faceSpecs = [
    { from: [-0.7, -0.7], to: [0.7, -0.7] }, // front
    { from: [-0.7, 0.7], to: [0.7, 0.7] },   // back
    { from: [-0.7, -0.7], to: [-0.7, 0.7] }, // left
    { from: [0.7, -0.7], to: [0.7, 0.7] }    // right
  ];

  faceSpecs.forEach((f, fi) => {
    const midX = (f.from[0] + f.to[0]) / 2;
    const midZ = (f.from[1] + f.to[1]) / 2;
    const dx = f.to[0] - f.from[0];
    const dz = f.to[1] - f.from[1];
    const spanLen = Math.hypot(dx, dz);
    const faceYaw = Math.atan2(dx, dz);
    
    // X-Braces
    const braceLen = Math.sqrt(spanLen * spanLen + 1.5 * 1.5);
    for (let b = 0; b < 2; b++) {
      const brace = BABYLON.MeshBuilder.CreateBox(id + "_brace" + fi + "_" + b, { width: 0.06, height: braceLen, depth: 0.06 }, scene);
      brace.position.set(midX, 1.5, midZ);
      brace.rotation.y = faceYaw;
      brace.rotation.z = b === 0 ? 0.6 : -0.6;
      brace.material = darkWoodMat;
      brace.parent = root;
    }

    // Mid-beam
    const collar = BABYLON.MeshBuilder.CreateBox(id + "_collar" + fi, { width: spanLen, height: 0.1, depth: 0.1 }, scene);
    collar.position.set(midX, 1.2, midZ);
    collar.rotation.y = faceYaw;
    collar.material = darkWoodMat;
    collar.parent = root;
  });

  // --- THE PLATFORM (Detailed Planks) ---
  const platBase = BABYLON.MeshBuilder.CreateBox(id + "_pBase", { width: 1.8, height: 0.1, depth: 1.8 }, scene);
  platBase.position.y = 3.1;
  platBase.material = darkWoodMat;
  platBase.parent = root;

  // Individual floor planks for visual depth
  const plankCount = 8;
  for (let i = 0; i < plankCount; i++) {
    const plank = BABYLON.MeshBuilder.CreateBox(id + "_plank" + i, { width: 0.2, height: 0.02, depth: 1.8 }, scene);
    plank.position.set(-0.7 + (i * 0.2), 3.16, 0);
    plank.material = woodMat;
    plank.parent = root;
  }

  // --- GUARDRAILS ---
  const railHeight = 0.5;
  const railY = 3.3;
  legPositions.forEach(([px, pz], i) => {
    const post = BABYLON.MeshBuilder.CreateBox(id + "_cpost" + i, { width: 0.08, height: railHeight, depth: 0.08 }, scene);
    post.position.set(px, railY + railHeight/2, pz);
    post.material = darkWoodMat;
    post.parent = root;
  });

  const rails = [
    { w: 1.4, d: 0.06, x: 0, z: 0.7, rot: 0 },
    { w: 1.4, d: 0.06, x: 0, z: -0.7, rot: 0 },
    { w: 0.06, d: 1.4, x: 0.7, z: 0, rot: 0 },
    { w: 0.06, d: 1.4, x: -0.7, z: 0, rot: 0 }
  ];
  rails.forEach((r, i) => {
    const rail = BABYLON.MeshBuilder.CreateBox(id + "_rail" + i, { width: r.w, height: 0.06, depth: r.d }, scene);
    rail.position.set(r.x, railY + railHeight - 0.05, r.z);
    rail.material = darkWoodMat;
    rail.parent = root;
  });

  // --- ROOF STRUCTURE ---
  // Roof Supports
  legPositions.forEach(([px, pz], i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_rp" + i, { height: 1.2, diameter: 0.07, tessellation: 5 }, scene);
    post.position.set(px, 3.7, pz);
    post.material = darkWoodMat;
    post.parent = root;
  });

  // Tiered Roof for "Character"
  const roofSkirt = BABYLON.MeshBuilder.CreateCylinder(id + "_rSkirt", { diameterTop: 2.0, diameterBottom: 2.6, height: 0.4, tessellation: 8 }, scene);
  roofSkirt.position.y = 4.2;
  roofSkirt.material = thatchMat;
  roofSkirt.parent = root;

  const roofTop = BABYLON.MeshBuilder.CreateCylinder(id + "_rTop", { height: 1.0, diameterTop: 0.05, diameterBottom: 2.1, tessellation: 8 }, scene);
  roofTop.position.y = 4.7;
  roofTop.material = thatchMat;
  roofTop.parent = root;

  const finial = BABYLON.MeshBuilder.CreateCylinder(id + "_finial", { diameterTop: 0.05, diameterBottom: 0.05, height: 0.3, tessellation: 5 }, scene);
  finial.position.y = 5.2;
  finial.material = darkWoodMat;
  finial.parent = root;

  // --- THE LANTERN (Hero detail) ---
  const lanternPole = BABYLON.MeshBuilder.CreateCylinder(id + "_lPole", { height: 0.4, diameter: 0.03 }, scene);
  lanternPole.position.set(0.4, 3.6, 0.4);
  lanternPole.material = metalMat;
  lanternPole.parent = root;

  const lanternGlass = BABYLON.MeshBuilder.CreateBox(id + "_lGlass", { size: 0.12 }, scene);
  lanternGlass.position.set(0.4, 3.82, 0.4);
  lanternGlass.material = lanternMat;
  lanternGlass.parent = root;

  // --- LADDER ---
  const lSide1 = BABYLON.MeshBuilder.CreateCylinder(id + "_ls1", { height: 3.3, diameter: 0.04, tessellation: 5 }, scene);
  lSide1.position.set(0.25, 1.65, 0.9);
  lSide1.material = ropeMat;
  lSide1.parent = root;

  const lSide2 = BABYLON.MeshBuilder.CreateCylinder(id + "_ls2", { height: 3.3, diameter: 0.04, tessellation: 5 }, scene);
  lSide2.position.set(-0.25, 1.65, 0.9);
  lSide2.material = ropeMat;
  lSide2.parent = root;

  for (let r = 0; r < 7; r++) {
    const rung = BABYLON.MeshBuilder.CreateCylinder(id + "_rung" + r, { height: 0.5, diameter: 0.04, tessellation: 5 }, scene);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.4 + r * 0.42, 0.9);
    rung.material = darkWoodMat;
    rung.parent = root;
  }

  return root;
}

// --------------------------------------------------------------------------
// BELOW IS THE ORIGINAL CODE RESTORED FOR NPC HOVER LOGIC TO PREVENT CRASHES
// --------------------------------------------------------------------------

let watchtowerRangeRing = null;

export function updateWatchtowerHover(scene, placedObjects, gridToWorldCenter) {
  if (!watchtowerRangeRing) {
    watchtowerRangeRing = BABYLON.MeshBuilder.CreateDisc("watchtowerRangeRing", { radius: 15, tessellation: 64 }, scene);
    watchtowerRangeRing.rotation.x = Math.PI / 2;
    watchtowerRangeRing.position.y = 0.08;

    const mat = new BABYLON.StandardMaterial("watchtowerRangeMat", scene);
    mat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 1.0);
    mat.alpha = 0.28;
    mat.zOffset = -10;
    mat.backFaceCulling = false;
    watchtowerRangeRing.material = mat;
    watchtowerRangeRing.isPickable = false;
    watchtowerRangeRing.isVisible = false;
  }

  const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
  let hoveredTower = null;

  if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
    let curr = pickInfo.pickedMesh;
    while (curr) {
      for (const obj of placedObjects.values()) {
        if (obj.type === "tower" && (obj.mesh === curr || obj.root === curr)) {
          hoveredTower = obj;
          break;
        }
      }
      if (hoveredTower) break;
      curr = curr.parent;
    }
  }

  if (hoveredTower) {
    const center = gridToWorldCenter(hoveredTower.rootX, hoveredTower.rootZ, hoveredTower.size);
    watchtowerRangeRing.position.x = center.x;
    watchtowerRangeRing.position.z = center.z;
    watchtowerRangeRing.isVisible = true;
  } else {
    watchtowerRangeRing.isVisible = false;
  }
}