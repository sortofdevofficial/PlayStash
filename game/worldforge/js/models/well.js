export function createWell(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const stoneMat = new BABYLON.StandardMaterial(id + "_sMat", scene);
  stoneMat.diffuseColor = new BABYLON.Color3(0.56, 0.55, 0.52); // warm grey cobblestone
  stoneMat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
  stoneMat.flatShaded = true;

  const stoneMatDark = new BABYLON.StandardMaterial(id + "_sMatD", scene);
  stoneMatDark.diffuseColor = new BABYLON.Color3(0.42, 0.41, 0.38);
  stoneMatDark.specularColor = new BABYLON.Color3(0, 0, 0);
  stoneMatDark.flatShaded = true;

  const woodMat = new BABYLON.StandardMaterial(id + "_wMat", scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.48, 0.32, 0.18); // warm timber
  woodMat.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMat.flatShaded = true;

  const roofMat = new BABYLON.StandardMaterial(id + "_rMat", scene);
  roofMat.diffuseColor = new BABYLON.Color3(0.72, 0.35, 0.22); // cozy terracotta tile roof
  roofMat.specularColor = new BABYLON.Color3(0, 0, 0);
  roofMat.flatShaded = true;

  const waterMat = new BABYLON.StandardMaterial(id + "_waterMat", scene);
  waterMat.diffuseColor = new BABYLON.Color3(0.32, 0.68, 0.88); // clear sparkling aqua
  waterMat.emissiveColor = new BABYLON.Color3(0.12, 0.28, 0.38);
  waterMat.alpha = 0.90;
  waterMat.specularColor = new BABYLON.Color3(0.4, 0.5, 0.6);

  const ropeMat = new BABYLON.StandardMaterial(id + "_ropeMat", scene);
  ropeMat.diffuseColor = new BABYLON.Color3(0.70, 0.58, 0.36);
  ropeMat.specularColor = new BABYLON.Color3(0, 0, 0);
  ropeMat.flatShaded = true;

  // Circular stone wall ring
  const ringSegs = 10;
  for (let i = 0; i < ringSegs; i++) {
    const angle = (i / ringSegs) * Math.PI * 2;
    const stone = BABYLON.MeshBuilder.CreateBox(id + "_ring_" + i, { width: 0.32, height: 0.42, depth: 0.2 }, scene);
    stone.position.set(Math.cos(angle) * 0.55, 0.21, Math.sin(angle) * 0.55);
    stone.rotation.y = -angle;
    stone.material = i % 2 === 0 ? stoneMat : stoneMatDark;
    stone.parent = root;
  }

  // Water surface inside the ring
  const water = BABYLON.MeshBuilder.CreateCylinder(id + "_water", { diameter: 0.85, height: 0.05, tessellation: 12 }, scene);
  water.position.y = 0.38;
  water.material = waterMat;
  water.parent = root;

  // Support posts + roof frame
  const postPositions = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
  postPositions.forEach(([px, pz], i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { height: 1.1, diameter: 0.08, tessellation: 6 }, scene);
    post.position.set(px, 0.55, pz);
    post.material = woodMat;
    post.parent = root;
  });

  const roof = BABYLON.MeshBuilder.CreateCylinder(id + "_roof", { height: 0.5, diameterTop: 0.05, diameterBottom: 1.5, tessellation: 6 }, scene);
  roof.position.y = 1.35;
  roof.material = roofMat;
  roof.parent = root;

  // Crossbeam + rope + bucket
  const beam = BABYLON.MeshBuilder.CreateCylinder(id + "_beam", { height: 1.0, diameter: 0.06, tessellation: 6 }, scene);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, 1.05, 0);
  beam.material = woodMat;
  beam.parent = root;

  const rope = BABYLON.MeshBuilder.CreateCylinder(id + "_rope", { height: 0.5, diameter: 0.02, tessellation: 4 }, scene);
  rope.position.set(0, 0.75, 0);
  rope.material = ropeMat;
  rope.parent = root;

  const bucket = BABYLON.MeshBuilder.CreateCylinder(id + "_bucket", { height: 0.18, diameterTop: 0.16, diameterBottom: 0.12, tessellation: 8 }, scene);
  bucket.position.set(0, 0.48, 0);
  bucket.material = woodMat;
  bucket.parent = root;

  return root;
}