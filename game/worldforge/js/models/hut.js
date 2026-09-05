function createFlatHutMat(id, suffix, scene, color) {
  const mat = new BABYLON.StandardMaterial(id + suffix, scene);
  mat.diffuseColor = color;
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mat.flatShaded = true;
  return mat;
}

export function createLowPolyHut(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  // Raw, crude materials — a survival shelter, not a cottage
  const logMat = createFlatHutMat(id, "_logMat", scene, new BABYLON.Color3(0.36, 0.25, 0.15));
  const logMatDark = createFlatHutMat(id, "_logMatD", scene, new BABYLON.Color3(0.27, 0.18, 0.1));
  const thatchMat = createFlatHutMat(id, "_thatchMat", scene, new BABYLON.Color3(0.58, 0.46, 0.22)); // dry straw/thatch
  const thatchMatDark = createFlatHutMat(id, "_thatchMatD", scene, new BABYLON.Color3(0.48, 0.37, 0.17));
  const mudMat = createFlatHutMat(id, "_mudMat", scene, new BABYLON.Color3(0.34, 0.28, 0.2)); // packed earth/mud chinking
  const ropeMat = createFlatHutMat(id, "_ropeMat", scene, new BABYLON.Color3(0.55, 0.44, 0.24));

  // Low earthen mound base (not a clean stone foundation — just packed dirt)
  const base = BABYLON.MeshBuilder.CreateCylinder(id + "_base", { diameterTop: 1.9, diameterBottom: 2.05, height: 0.14, tessellation: 8 }, scene);
  base.position.y = 0.07;
  base.material = mudMat;
  base.parent = root;

  // Crooked raw-log wall frame — uneven, angled posts instead of clean stacked boxes
  const wallHeight = 0.75;
  const postPositions = [
    [-0.75, -0.75, 0.05], [0.75, -0.75, -0.03], [-0.75, 0.75, 0.02], [0.75, 0.75, -0.05],
    [0, -0.78, 0.03], [0, 0.78, -0.02], [-0.78, 0, -0.03], [0.78, 0, 0.04]
  ];
  postPositions.forEach(([px, pz, tilt], i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { diameterTop: 0.09, diameterBottom: 0.13, height: wallHeight, tessellation: 5 }, scene);
    post.position.set(px, wallHeight / 2 + 0.12, pz);
    post.rotation.x = tilt;
    post.rotation.z = tilt * 0.6;
    post.material = i % 2 === 0 ? logMat : logMatDark;
    post.parent = root;
  });

  // Mud/wattle infill panels between posts — rough low walls, not neat siding
  const wallSize = 1.5;
  const infillFront = BABYLON.MeshBuilder.CreateBox(id + "_infillF", { width: wallSize, height: wallHeight * 0.7, depth: 0.06 }, scene);
  infillFront.position.set(0, 0.12 + wallHeight * 0.35, 0.75);
  infillFront.material = mudMat;
  infillFront.parent = root;

  const infillBack = infillFront.clone(id + "_infillB");
  infillBack.position.z = -0.75;
  infillBack.parent = root;

  const infillLeft = BABYLON.MeshBuilder.CreateBox(id + "_infillL", { width: 0.06, height: wallHeight * 0.7, depth: wallSize }, scene);
  infillLeft.position.set(-0.75, 0.12 + wallHeight * 0.35, 0);
  infillLeft.material = mudMat;
  infillLeft.parent = root;

  const infillRight = infillLeft.clone(id + "_infillR");
  infillRight.position.x = 0.75;
  infillRight.parent = root;

  const wallTop = 0.12 + wallHeight;

  // Crude conical thatch roof — asymmetric, shaggy, low tessellation (not a clean pyramid)
  const roofBase = BABYLON.MeshBuilder.CreateCylinder(id + "_roofBase", { diameterTop: 0.1, diameterBottom: 2.5, height: 1.3, tessellation: 7 }, scene);
  roofBase.position.set(0.04, wallTop + 0.62, -0.02);
  roofBase.rotation.y = 0.3;
  roofBase.material = thatchMat;
  roofBase.parent = root;

  // Overlapping lower thatch skirt for a shaggy, uneven eave line
  const roofSkirt = BABYLON.MeshBuilder.CreateCylinder(id + "_roofSkirt", { diameterTop: 1.9, diameterBottom: 2.7, height: 0.4, tessellation: 7 }, scene);
  roofSkirt.position.set(0, wallTop + 0.08, 0);
  roofSkirt.material = thatchMatDark;
  roofSkirt.parent = root;

  // Crooked ridge pole sticking out the top — crude, not a polished cap
  const ridgePole = BABYLON.MeshBuilder.CreateCylinder(id + "_ridgePole", { diameterTop: 0.03, diameterBottom: 0.06, height: 0.5, tessellation: 5 }, scene);
  ridgePole.position.set(0.04, wallTop + 1.35, -0.02);
  ridgePole.rotation.z = 0.12;
  ridgePole.material = logMatDark;
  ridgePole.parent = root;

  // Low doorway — just a dark gap with a crude hide/cloth flap, no frame or knob
  const doorGap = BABYLON.MeshBuilder.CreateBox(id + "_doorGap", { width: 0.4, height: 0.5, depth: 0.1 }, scene);
  doorGap.position.set(0, 0.12 + 0.26, 0.76);
  const doorMat = createFlatHutMat(id, "_doorMat", scene, new BABYLON.Color3(0.08, 0.06, 0.05));
  doorGap.material = doorMat;
  doorGap.parent = root;

  const doorFlap = BABYLON.MeshBuilder.CreateBox(id + "_doorFlap", { width: 0.38, height: 0.46, depth: 0.03 }, scene);
  doorFlap.position.set(0.05, 0.12 + 0.24, 0.78);
  doorFlap.rotation.y = -0.15;
  doorFlap.material = createFlatHutMat(id, "_doorFlapMat", scene, new BABYLON.Color3(0.42, 0.32, 0.2));
  doorFlap.parent = root;

  // Binding rope wraps at a couple of post junctions for a hand-built feel
  const rope1 = BABYLON.MeshBuilder.CreateTorus(id + "_rope1", { diameter: 0.16, thickness: 0.025, tessellation: 8 }, scene);
  rope1.rotation.x = Math.PI / 2;
  rope1.position.set(-0.75, wallHeight * 0.6 + 0.12, 0.75);
  rope1.material = ropeMat;
  rope1.parent = root;

  const rope2 = rope1.clone(id + "_rope2");
  rope2.position.set(0.75, wallHeight * 0.35 + 0.12, -0.75);
  rope2.parent = root;

  return root;
}