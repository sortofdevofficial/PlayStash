export function createWallSegment(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const woodMat = new BABYLON.StandardMaterial(id + "_wMat", scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.38, 0.24, 0.13);
  woodMat.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMat.flatShaded = true;

  const woodMatDark = new BABYLON.StandardMaterial(id + "_wMatD", scene);
  woodMatDark.diffuseColor = new BABYLON.Color3(0.28, 0.17, 0.09);
  woodMatDark.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMatDark.flatShaded = true;

  // Vertical palisade stakes spanning the tile
  const stakeCount = 5;
  for (let i = 0; i < stakeCount; i++) {
    const t = i / (stakeCount - 1);
    const x = -0.42 + t * 0.84;
    const h = 1.1 + Math.sin(i * 1.7) * 0.08;
    const stake = BABYLON.MeshBuilder.CreateCylinder(id + "_stake_" + i, { height: h, diameterTop: 0.07, diameterBottom: 0.11, tessellation: 5 }, scene);
    stake.position.set(x, h / 2, 0);
    stake.rotation.z = (Math.random() - 0.5) * 0.05;
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

  return root;
}

export function createGate(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const woodMat = new BABYLON.StandardMaterial(id + "_wMat", scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.38, 0.24, 0.13);
  woodMat.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMat.flatShaded = true;

  const woodMatDark = new BABYLON.StandardMaterial(id + "_wMatD", scene);
  woodMatDark.diffuseColor = new BABYLON.Color3(0.28, 0.17, 0.09);
  woodMatDark.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMatDark.flatShaded = true;

  const ropeMat = new BABYLON.StandardMaterial(id + "_ropeMat", scene);
  ropeMat.diffuseColor = new BABYLON.Color3(0.6, 0.5, 0.3);
  ropeMat.specularColor = new BABYLON.Color3(0, 0, 0);
  ropeMat.flatShaded = true;

  // Two side posts framing a passable gap (no stakes in the middle)
  [-0.42, 0.42].forEach((x, i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { height: 1.3, diameterTop: 0.1, diameterBottom: 0.14, tessellation: 6 }, scene);
    post.position.set(x, 0.65, 0);
    post.material = woodMat;
    post.parent = root;
  });

  // Lintel beam across the top of the opening
  const lintel = BABYLON.MeshBuilder.CreateBox(id + "_lintel", { width: 0.95, height: 0.12, depth: 0.14 }, scene);
  lintel.position.set(0, 1.28, 0);
  lintel.material = woodMatDark;
  lintel.parent = root;

  // Hanging rope + small banner to read clearly as an entrance
  const rope = BABYLON.MeshBuilder.CreateCylinder(id + "_rope", { height: 0.3, diameter: 0.02, tessellation: 4 }, scene);
  rope.position.set(-0.42, 1.05, 0.08);
  rope.material = ropeMat;
  rope.parent = root;

  return root;
}