export function createMarket(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const woodMat = new BABYLON.StandardMaterial(id + "_wMat", scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.42, 0.27, 0.14);
  woodMat.specularColor = new BABYLON.Color3(0, 0, 0);
  woodMat.flatShaded = true;

  const clothMat = new BABYLON.StandardMaterial(id + "_clothMat", scene);
  clothMat.diffuseColor = new BABYLON.Color3(0.75, 0.3, 0.25);
  clothMat.specularColor = new BABYLON.Color3(0, 0, 0);
  clothMat.flatShaded = true;

  const tableMat = new BABYLON.StandardMaterial(id + "_tMat", scene);
  tableMat.diffuseColor = new BABYLON.Color3(0.48, 0.32, 0.17);
  tableMat.specularColor = new BABYLON.Color3(0, 0, 0);
  tableMat.flatShaded = true;

  const anvilMat = new BABYLON.StandardMaterial(id + "_aMat", scene);
  anvilMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
  anvilMat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);
  anvilMat.flatShaded = true;

  const toolMat = new BABYLON.StandardMaterial(id + "_toolMat", scene);
  toolMat.diffuseColor = new BABYLON.Color3(0.6, 0.62, 0.65);
  toolMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
  toolMat.flatShaded = true;

  // Market stall frame
  const postPositions = [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]];
  postPositions.forEach(([px, pz], i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { height: 1.5, diameter: 0.1, tessellation: 6 }, scene);
    post.position.set(px, 0.75, pz);
    post.material = woodMat;
    post.parent = root;
  });

  // Awning/canopy
  const awning = BABYLON.MeshBuilder.CreateCylinder(id + "_awning", { height: 0.5, diameterTop: 0.1, diameterBottom: 2.1, tessellation: 4 }, scene);
  awning.position.y = 1.65;
  awning.rotation.y = Math.PI / 4;
  awning.material = clothMat;
  awning.parent = root;

  // Trading table
  const table = BABYLON.MeshBuilder.CreateBox(id + "_table", { width: 1.5, height: 0.12, depth: 0.7 }, scene);
  table.position.set(0, 0.55, 0.4);
  table.material = tableMat;
  table.parent = root;

  const tableLegPositions = [[-0.65, 0.35], [0.65, 0.35], [-0.65, 0.5], [0.65, 0.5]];
  tableLegPositions.forEach(([px, pz], i) => {
    const leg = BABYLON.MeshBuilder.CreateBox(id + "_tleg_" + i, { width: 0.08, height: 0.5, depth: 0.08 }, scene);
    leg.position.set(px, 0.28, pz);
    leg.material = woodMat;
    leg.parent = root;
  });

  // Anvil for tool-crafting flavor
  const anvilBase = BABYLON.MeshBuilder.CreateCylinder(id + "_anvilBase", { height: 0.25, diameter: 0.25, tessellation: 6 }, scene);
  anvilBase.position.set(-0.4, 0.15, -0.35);
  anvilBase.material = anvilMat;
  anvilBase.parent = root;

  const anvilTop = BABYLON.MeshBuilder.CreateBox(id + "_anvilTop", { width: 0.4, height: 0.12, depth: 0.16 }, scene);
  anvilTop.position.set(-0.4, 0.32, -0.35);
  anvilTop.material = anvilMat;
  anvilTop.parent = root;

  // Finished tools laid out on the table
  const toolPositions = [[-0.3, 0.63, 0.35], [0.0, 0.63, 0.45], [0.3, 0.63, 0.35]];
  toolPositions.forEach(([px, py, pz], i) => {
    const tool = BABYLON.MeshBuilder.CreateCylinder(id + "_tool_" + i, { height: 0.28, diameter: 0.045, tessellation: 5 }, scene);
    tool.rotation.z = Math.PI / 2.4;
    tool.position.set(px, py, pz);
    tool.material = toolMat;
    tool.parent = root;
  });

  return root;
}