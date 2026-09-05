export function createStorage(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const woodMat = new BABYLON.StandardMaterial(id + "_wMat", scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.42, 0.27, 0.14);
  woodMat.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMat.flatShaded = true;

  const woodMatDark = new BABYLON.StandardMaterial(id + "_wMatD", scene);
  woodMatDark.diffuseColor = new BABYLON.Color3(0.3, 0.19, 0.1);
  woodMatDark.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMatDark.flatShaded = true;

  const roofMat = new BABYLON.StandardMaterial(id + "_rMat", scene);
  roofMat.diffuseColor = new BABYLON.Color3(0.56, 0.44, 0.21);
  roofMat.specularColor = new BABYLON.Color3(0, 0, 0);
  roofMat.flatShaded = true;

  const crateMat = new BABYLON.StandardMaterial(id + "_cMat", scene);
  crateMat.diffuseColor = new BABYLON.Color3(0.5, 0.35, 0.18);
  crateMat.specularColor = new BABYLON.Color3(0, 0, 0);
  crateMat.flatShaded = true;

  const sackMat = new BABYLON.StandardMaterial(id + "_sackMat", scene);
  sackMat.diffuseColor = new BABYLON.Color3(0.68, 0.6, 0.42);
  sackMat.specularColor = new BABYLON.Color3(0, 0, 0);
  sackMat.flatShaded = true;

  // Open-sided raised platform shed
  const postPositions = [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]];
  postPositions.forEach(([px, pz], i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { height: 1.3, diameter: 0.12, tessellation: 6 }, scene);
    post.position.set(px, 0.65, pz);
    post.material = woodMat;
    post.parent = root;
  });

  const platform = BABYLON.MeshBuilder.CreateBox(id + "_platform", { width: 1.8, height: 0.1, depth: 1.8 }, scene);
  platform.position.y = 0.35;
  platform.material = woodMatDark;
  platform.parent = root;

  const roof = BABYLON.MeshBuilder.CreateBox(id + "_roof", { width: 2.0, height: 0.12, depth: 2.0 }, scene);
  roof.position.y = 1.35;
  roof.rotation.y = Math.PI / 4;
  roof.material = roofMat;
  roof.parent = root;

  const roofPeak = BABYLON.MeshBuilder.CreateCylinder(id + "_roofPeak", { height: 0.4, diameterTop: 0.03, diameterBottom: 0.9, tessellation: 4 }, scene);
  roofPeak.position.y = 1.55;
  roofPeak.rotation.y = Math.PI / 4;
  roofPeak.material = roofMat;
  roofPeak.parent = root;

  // Stacked storage crates
  const cratePositions = [[-0.4, 0.14, -0.3], [0.35, 0.14, -0.25], [0.4, 0.14, 0.3], [-0.35, 0.42, -0.2]];
  cratePositions.forEach(([px, py, pz], i) => {
    const crate = BABYLON.MeshBuilder.CreateBox(id + "_crate_" + i, { width: 0.42, height: 0.4, depth: 0.42 }, scene);
    crate.position.set(px, py + 0.4, pz);
    crate.rotation.y = (i * 0.4) - 0.2;
    crate.material = crateMat;
    crate.parent = root;
  });

  // Grain sacks
  for (let i = 0; i < 3; i++) {
    const sack = BABYLON.MeshBuilder.CreateSphere(id + "_sack_" + i, { diameter: 0.32, segments: 5 }, scene);
    sack.scaling.set(1, 0.85, 1);
    sack.position.set(-0.1 + i * 0.32, 0.55, 0.35);
    sack.material = sackMat;
    sack.parent = root;
  }

  return root;
}