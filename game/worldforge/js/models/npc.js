export function createLowPolyNPC(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  const skinMat = new BABYLON.StandardMaterial(id + "_skinMat", scene);
  skinMat.diffuseColor = new BABYLON.Color3(0.92, 0.74, 0.62);
  skinMat.specularColor = new BABYLON.Color3(0, 0, 0);

  // Cozy tunic colors: terracotta, forest green, warm mustard, cozy wool beige, dusky teal
  const shirtColors = [
    new BABYLON.Color3(0.85, 0.42, 0.28), // terracotta
    new BABYLON.Color3(0.28, 0.55, 0.38), // sage green
    new BABYLON.Color3(0.88, 0.68, 0.22), // mustard yellow
    new BABYLON.Color3(0.72, 0.64, 0.52), // wool oatmeal
    new BABYLON.Color3(0.28, 0.52, 0.65), // dusky blue
    new BABYLON.Color3(0.68, 0.35, 0.42)  // dusty rose
  ];
  const shirtMat = new BABYLON.StandardMaterial(id + "_shirtMat", scene);
  shirtMat.diffuseColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
  shirtMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const pantsColors = [
    new BABYLON.Color3(0.25, 0.22, 0.18), // brown cords
    new BABYLON.Color3(0.20, 0.24, 0.30), // soft navy
    new BABYLON.Color3(0.32, 0.28, 0.24)  // earthy tan
  ];
  const pantsMat = new BABYLON.StandardMaterial(id + "_pantsMat", scene);
  pantsMat.diffuseColor = pantsColors[Math.floor(Math.random() * pantsColors.length)];
  pantsMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const detailMat = new BABYLON.StandardMaterial(id + "_detailMat", scene);
  detailMat.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.12);
  detailMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const eyeMat = new BABYLON.StandardMaterial(id + "_eyeMat", scene);
  eyeMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);

  const blushMat = new BABYLON.StandardMaterial(id + "_blushMat", scene);
  blushMat.diffuseColor = new BABYLON.Color3(0.95, 0.55, 0.55); // adorable rosy cheeks
  blushMat.specularColor = new BABYLON.Color3(0, 0, 0);

  // Randomized natural hair color per NPC
  const hairPalette = [
    new BABYLON.Color3(0.24, 0.16, 0.10),  // dark chocolate
    new BABYLON.Color3(0.42, 0.26, 0.14),  // warm chestnut
    new BABYLON.Color3(0.12, 0.10, 0.10),  // soft black
    new BABYLON.Color3(0.68, 0.50, 0.25),  // warm honey blonde
    new BABYLON.Color3(0.55, 0.28, 0.15)   // ginger auburn
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

  // Cute rosy blush cheeks
  const lBlush = BABYLON.MeshBuilder.CreateBox(id + "_lBlush", { width: 0.06, height: 0.04, depth: 0.02 }, scene);
  lBlush.position.set(-0.11, 1.06, 0.18);
  lBlush.material = blushMat;
  lBlush.parent = root;

  const rBlush = BABYLON.MeshBuilder.CreateBox(id + "_rBlush", { width: 0.06, height: 0.04, depth: 0.02 }, scene);
  rBlush.position.set(0.11, 1.06, 0.18);
  rBlush.material = blushMat;
  rBlush.parent = root;

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

const BASE_ANIM_RATE = 7;
// Stride cadence has to track walk speed or a fast villager's feet slide across
// the ground. Tuned so the original 2.7 tiles/sec cycles at BASE_ANIM_RATE.
const WALK_ANIM_RATE_PER_SPEED = 2.6;

export function updateNPCAnimation(npc, delta) {
  if (!npc.animState) npc.animState = { time: 0 };

  const action = npc.a || npc.action;
  const rate = action === "WALK"
    ? Math.max(BASE_ANIM_RATE, (npc.speed || 0) * WALK_ANIM_RATE_PER_SPEED)
    : BASE_ANIM_RATE;
  npc.animState.time += delta * rate;
  const t = npc.animState.time;

  const meta = npc.root.metadata;
  if (!meta) return;

  const { leftLegRoot, rightLegRoot, leftArmRoot, rightArmRoot } = meta;

  switch (action) {
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