export function createLowPolyNPC(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const skinMat = new BABYLON.StandardMaterial(id + "_skinMat", scene);
  skinMat.diffuseColor = new BABYLON.Color3(0.92, 0.74, 0.62);
  skinMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const shirtMat = new BABYLON.StandardMaterial(id + "_shirtMat", scene);
  shirtMat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.75);
  shirtMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const pantsMat = new BABYLON.StandardMaterial(id + "_pantsMat", scene);
  pantsMat.diffuseColor = new BABYLON.Color3(0.18, 0.2, 0.26);
  pantsMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const detailMat = new BABYLON.StandardMaterial(id + "_detailMat", scene);
  detailMat.diffuseColor = new BABYLON.Color3(0.3, 0.18, 0.1);
  detailMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const eyeMat = new BABYLON.StandardMaterial(id + "_eyeMat", scene);
  eyeMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);

  // Randomized natural hair color per NPC
  const hairPalette = [
    new BABYLON.Color3(0.2, 0.13, 0.08),  // dark brown
    new BABYLON.Color3(0.35, 0.22, 0.1),  // chestnut
    new BABYLON.Color3(0.08, 0.07, 0.07), // black
    new BABYLON.Color3(0.55, 0.38, 0.18), // sandy blonde
    new BABYLON.Color3(0.4, 0.24, 0.14)   // auburn
  ];
  const hairMat = new BABYLON.StandardMaterial(id + "_hairMat", scene);
  hairMat.diffuseColor = hairPalette[Math.floor(Math.random() * hairPalette.length)];
  hairMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const torso = BABYLON.MeshBuilder.CreateBox(id + "_torso", { width: 0.45, height: 0.55, depth: 0.3 }, scene);
  torso.position.y = 0.65;
  torso.material = shirtMat;
  torso.parent = root;

  const belt = BABYLON.MeshBuilder.CreateBox(id + "_belt", { width: 0.47, height: 0.08, depth: 0.32 }, scene);
  belt.position.y = 0.42;
  belt.material = detailMat;
  belt.parent = root;

  const head = BABYLON.MeshBuilder.CreateBox(id + "_head", { width: 0.35, height: 0.35, depth: 0.35 }, scene);
  head.position.y = 1.12;
  head.material = skinMat;
  head.parent = root;

  // Hair — cap over the top/back of the head plus a short fringe, low-poly blocks
  const hairTop = BABYLON.MeshBuilder.CreateBox(id + "_hairTop", { width: 0.37, height: 0.14, depth: 0.37 }, scene);
  hairTop.position.set(0, 1.31, -0.005);
  hairTop.material = hairMat;
  hairTop.parent = root;

  const hairBack = BABYLON.MeshBuilder.CreateBox(id + "_hairBack", { width: 0.37, height: 0.3, depth: 0.1 }, scene);
  hairBack.position.set(0, 1.2, -0.13);
  hairBack.material = hairMat;
  hairBack.parent = root;

  const hairFringe = BABYLON.MeshBuilder.CreateBox(id + "_hairFringe", { width: 0.37, height: 0.08, depth: 0.1 }, scene);
  hairFringe.position.set(0, 1.26, 0.13);
  hairFringe.material = hairMat;
  hairFringe.parent = root;

  const leftEye = BABYLON.MeshBuilder.CreateBox(id + "_lEye", { width: 0.06, height: 0.06, depth: 0.02 }, scene);
  leftEye.position.set(-0.09, 1.14, 0.18);
  leftEye.material = eyeMat;
  leftEye.parent = root;

  const rightEye = BABYLON.MeshBuilder.CreateBox(id + "_rEye", { width: 0.06, height: 0.06, depth: 0.02 }, scene);
  rightEye.position.set(0.09, 1.14, 0.18);
  rightEye.material = eyeMat;
  rightEye.parent = root;

  const leftLegRoot = new BABYLON.TransformNode(id + "_lLegRoot", scene);
  leftLegRoot.position.set(-0.12, 0.38, 0);
  leftLegRoot.parent = root;

  const leftLeg = BABYLON.MeshBuilder.CreateBox(id + "_lLeg", { width: 0.16, height: 0.38, depth: 0.18 }, scene);
  leftLeg.position.y = -0.19;
  leftLeg.material = pantsMat;
  leftLeg.parent = leftLegRoot;

  const rightLegRoot = new BABYLON.TransformNode(id + "_rLegRoot", scene);
  rightLegRoot.position.set(0.12, 0.38, 0);
  rightLegRoot.parent = root;

  const rightLeg = BABYLON.MeshBuilder.CreateBox(id + "_rLeg", { width: 0.16, height: 0.38, depth: 0.18 }, scene);
  rightLeg.position.y = -0.19;
  rightLeg.material = pantsMat;
  rightLeg.parent = rightLegRoot;

  const leftArmRoot = new BABYLON.TransformNode(id + "_lArmRoot", scene);
  leftArmRoot.position.set(-0.28, 0.88, 0);
  leftArmRoot.parent = root;

  const leftArm = BABYLON.MeshBuilder.CreateBox(id + "_lArm", { width: 0.12, height: 0.48, depth: 0.14 }, scene);
  leftArm.position.y = -0.24;
  leftArm.material = shirtMat;
  leftArm.parent = leftArmRoot;

  const rightArmRoot = new BABYLON.TransformNode(id + "_rArmRoot", scene);
  rightArmRoot.position.set(0.28, 0.88, 0);
  rightArmRoot.parent = root;

  const rightArm = BABYLON.MeshBuilder.CreateBox(id + "_rArm", { width: 0.12, height: 0.48, depth: 0.14 }, scene);
  rightArm.position.y = -0.24;
  rightArm.material = shirtMat;
  rightArm.parent = rightArmRoot;

  root.metadata = { leftLegRoot, rightLegRoot, leftArmRoot, rightArmRoot };
  return root;
}

export function updateNPCAnimation(npc, delta) {
  if (!npc.animState) npc.animState = { time: 0 };
  npc.animState.time += delta * 7;
  const t = npc.animState.time;

  const meta = npc.root.metadata;
  if (!meta) return;

  const { leftLegRoot, rightLegRoot, leftArmRoot, rightArmRoot } = meta;

  switch (npc.action) {
    case "WALK":
      npc.root.position.y = Math.abs(Math.sin(t * 1.5)) * 0.08;
      if (leftLegRoot) leftLegRoot.rotation.x = Math.sin(t) * 0.7;
      if (rightLegRoot) rightLegRoot.rotation.x = -Math.sin(t) * 0.7;
      if (leftArmRoot) leftArmRoot.rotation.x = -Math.sin(t) * 0.6;
      if (rightArmRoot) rightArmRoot.rotation.x = Math.sin(t) * 0.6;
      break;

    case "CLIMB":
      // Alternating opposite-hand/opposite-foot ladder climb (arms and legs offset in phase)
      if (leftLegRoot) leftLegRoot.rotation.x = -Math.PI / 4 + Math.sin(t * 2) * 0.35;
      if (rightLegRoot) rightLegRoot.rotation.x = -Math.PI / 4 - Math.sin(t * 2) * 0.35;
      if (leftArmRoot) leftArmRoot.rotation.x = -Math.PI / 1.4 - Math.sin(t * 2) * 0.3;
      if (rightArmRoot) rightArmRoot.rotation.x = -Math.PI / 1.4 + Math.sin(t * 2) * 0.3;
      break;

    case "MANNING_WATCHTOWER":
      npc.root.position.y = 3.1;
      if (leftLegRoot) leftLegRoot.rotation.x = 0;
      if (rightLegRoot) rightLegRoot.rotation.x = 0;
      if (leftArmRoot) leftArmRoot.rotation.x = Math.sin(t * 0.4) * 0.05;
      if (rightArmRoot) rightArmRoot.rotation.x = -Math.sin(t * 0.4) * 0.05;
      break;

    case "MINE":
    case "QUARRY":
    case "CHOP":
      npc.root.position.y = 0;
      if (rightArmRoot) rightArmRoot.rotation.x = -Math.PI / 1.5 + Math.sin(t * 3.5) * 1.2;
      if (leftArmRoot) leftArmRoot.rotation.x = -Math.PI / 1.5 + Math.sin(t * 3.5) * 1.2;
      break;

    case "DRAW_WATER":
      npc.root.position.y = 0;
      if (rightArmRoot) rightArmRoot.rotation.x = -Math.PI / 2.2 + Math.sin(t * 1.6) * 0.3;
      if (leftArmRoot) leftArmRoot.rotation.x = -Math.PI / 2.2 - Math.sin(t * 1.6) * 0.15;
      break;

    case "TRADE":
      npc.root.position.y = 0;
      if (rightArmRoot) rightArmRoot.rotation.x = -Math.PI / 4 + Math.sin(t * 2.5) * 0.3;
      if (leftArmRoot) leftArmRoot.rotation.x = -Math.PI / 4 + Math.cos(t * 2.5) * 0.3;
      break;

    case "FARM":
      npc.root.position.y = 0;
      if (rightArmRoot) rightArmRoot.rotation.x = -Math.PI / 3 + Math.sin(t * 2) * 0.4;
      if (leftArmRoot) leftArmRoot.rotation.x = -Math.PI / 3 + Math.cos(t * 2) * 0.4;
      break;

    case "IDLE":
    default:
      npc.root.position.y = 0;
      if (leftLegRoot) leftLegRoot.rotation.x = 0;
      if (rightLegRoot) rightLegRoot.rotation.x = 0;
      if (leftArmRoot) leftArmRoot.rotation.x = 0;
      if (rightArmRoot) rightArmRoot.rotation.x = 0;
      break;
  }
}