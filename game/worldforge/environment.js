export const canvas = document.getElementById("renderCanvas");
export const engine = new BABYLON.Engine(canvas, true, { 
  preserveDrawingBuffer: false, 
  powerPreference: "high-performance",
  doNotHandleContextLost: true 
});
export const scene = new BABYLON.Scene(engine);

export const BUILD_SIZE = 80;
export const HALF_BUILD = BUILD_SIZE / 2;

function createFlatMat(name, color) {
  const mat = new BABYLON.StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mat.flatShaded = true;
  return mat;
}

export const envMaterials = {
  playableGround: createFlatMat("pGroundMat", new BABYLON.Color3(0.22, 0.48, 0.26)),
  endlessGround: createFlatMat("eGroundMat", new BABYLON.Color3(0.14, 0.35, 0.18)),
  trunk: createFlatMat("trunkMat", new BABYLON.Color3(0.42, 0.26, 0.14)),
  foliage: createFlatMat("foliageMat", new BABYLON.Color3(0.18, 0.58, 0.24))
};

scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;

export const hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
export const sunLight = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, -0.4), scene);
sunLight.position = new BABYLON.Vector3(40, 70, 20);

export const shadowGen = new BABYLON.ShadowGenerator(1024, sunLight);
shadowGen.usePoissonSampling = true;

export function setEnvironmentLighting(isNight) {
  if (!isNight) {
    scene.clearColor = new BABYLON.Color4(0.42, 0.68, 0.88, 1);
    scene.fogColor = new BABYLON.Color3(0.42, 0.68, 0.88);
    scene.fogDensity = 0.0018;

    hemiLight.intensity = 0.95;
    hemiLight.skyColor = new BABYLON.Color3(0.85, 0.92, 1.0);
    hemiLight.groundColor = new BABYLON.Color3(0.32, 0.48, 0.32);

    sunLight.intensity = 0.95;
    sunLight.diffuse = new BABYLON.Color3(0.98, 0.95, 0.88);
  } else {
    scene.clearColor = new BABYLON.Color4(0.06, 0.1, 0.22, 1);
    scene.fogColor = new BABYLON.Color3(0.06, 0.1, 0.22);
    scene.fogDensity = 0.0025;

    hemiLight.intensity = 0.65;
    hemiLight.skyColor = new BABYLON.Color3(0.25, 0.4, 0.75);
    hemiLight.groundColor = new BABYLON.Color3(0.08, 0.15, 0.1);

    sunLight.intensity = 0.65;
    sunLight.diffuse = new BABYLON.Color3(0.45, 0.6, 0.95);
  }
}
setEnvironmentLighting(false);

export const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 3, 42, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 4;
camera.upperRadiusLimit = 160;
camera.panningSensibility = 80;

const keys = { w: false, a: false, s: false, d: false, q: false, e: false };
window.addEventListener("keydown", (evt) => {
  const k = evt.key.toLowerCase();
  if (k in keys) keys[k] = true;
});
window.addEventListener("keyup", (evt) => {
  const k = evt.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

export function updateCameraControls() {
  const moveSpeed = 0.55;
  const vertSpeed = 0.45;

  if (keys.e) camera.target.y += vertSpeed;
  if (keys.q) camera.target.y = Math.max(0, camera.target.y - vertSpeed);

  if (!keys.w && !keys.a && !keys.s && !keys.d) return;

  const forward = camera.getForwardRay().direction;
  forward.y = 0;
  forward.normalize();

  const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up()).normalize();
  const moveVec = BABYLON.Vector3.Zero();

  if (keys.w) moveVec.addInPlace(forward);
  if (keys.s) moveVec.subtractInPlace(forward);
  if (keys.d) moveVec.subtractInPlace(right);
  if (keys.a) moveVec.addInPlace(right);

  if (moveVec.lengthSquared() > 0) {
    moveVec.normalize().scaleInPlace(moveSpeed);
    camera.target.addInPlace(moveVec);
  }
}

export const endlessGround = BABYLON.MeshBuilder.CreateGround("eGround", { width: 2500, height: 2500 }, scene);
endlessGround.position.y = -0.05;
endlessGround.material = envMaterials.endlessGround;
endlessGround.isPickable = false;
endlessGround.freezeWorldMatrix();

export const playableGround = BABYLON.MeshBuilder.CreateGround("pGround", { width: BUILD_SIZE, height: BUILD_SIZE }, scene);
playableGround.material = envMaterials.playableGround;
playableGround.receiveShadows = true;
playableGround.freezeWorldMatrix();

const gridLines = [];
for (let i = 0; i <= BUILD_SIZE; i++) {
  const offset = i - HALF_BUILD;
  gridLines.push([new BABYLON.Vector3(offset, 0.02, -HALF_BUILD), new BABYLON.Vector3(offset, 0.02, HALF_BUILD)]);
  gridLines.push([new BABYLON.Vector3(-HALF_BUILD, 0.02, offset), new BABYLON.Vector3(HALF_BUILD, 0.02, offset)]);
}
export const grid = BABYLON.MeshBuilder.CreateLineSystem("grid", { lines: gridLines }, scene);
grid.color = new BABYLON.Color3(0.08, 0.2, 0.1);
grid.alpha = 0.55;
grid.isPickable = false;
grid.freezeWorldMatrix();

export function createLowPolyStone(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);
  const stoneMat = new BABYLON.StandardMaterial(id + "_stoneMat", scene);
  stoneMat.diffuseColor = new BABYLON.Color3(0.5, 0.52, 0.55);
  stoneMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const mainRock = BABYLON.MeshBuilder.CreatePolyhedron(id + "_main", { type: 1, size: 0.75 }, scene);
  mainRock.position.y = 0.4;
  mainRock.scaling.set(1.2, 0.8, 1.1);
  mainRock.rotation.set(0.2, 0.5, 0.1);
  mainRock.material = stoneMat;
  mainRock.parent = root;

  const subRock = BABYLON.MeshBuilder.CreatePolyhedron(id + "_sub", { type: 1, size: 0.45 }, scene);
  subRock.position.set(0.45, 0.22, -0.25);
  subRock.rotation.set(0.4, -0.2, 0.3);
  subRock.material = stoneMat;
  subRock.parent = root;

  return root;
}

export function createLowPolyTree(name, scene, materials) {
  const root = new BABYLON.TransformNode(name, scene);

  const baseTrunk = BABYLON.MeshBuilder.CreateCylinder("t_base", {
    height: 1.6,
    diameterTop: 0.45,
    diameterBottom: 0.7,
    tessellation: 6
  }, scene);
  baseTrunk.position.y = 0.8;
  baseTrunk.material = materials.trunk;
  baseTrunk.parent = root;

  const midTrunk = BABYLON.MeshBuilder.CreateCylinder("t_mid", {
    height: 1.4,
    diameterTop: 0.32,
    diameterBottom: 0.45,
    tessellation: 6
  }, scene);
  midTrunk.position.set(0.08, 2.1, 0.05);
  midTrunk.rotation.z = -0.08;
  midTrunk.material = materials.trunk;
  midTrunk.parent = root;

  const branch1 = BABYLON.MeshBuilder.CreateCylinder("b1", {
    height: 1.2,
    diameterTop: 0.18,
    diameterBottom: 0.3,
    tessellation: 5
  }, scene);
  branch1.position.set(0.35, 2.3, 0.15);
  branch1.rotation.set(0.1, 0, -Math.PI / 4.5);
  branch1.material = materials.trunk;
  branch1.parent = root;

  const foliageSpecs = [
    { name: "f_main", r: 1.4, pos: [0, 3.8, 0] },
    { name: "f_left", r: 1.1, pos: [-0.65, 3.1, -0.35] },
    { name: "f_right", r: 1.15, pos: [0.7, 2.9, 0.25] },
    { name: "f_top", r: 0.85, pos: [0.1, 4.6, -0.1] }
  ];

  foliageSpecs.forEach((spec) => {
    const cluster = BABYLON.MeshBuilder.CreateIcoSphere(spec.name, {
      radius: spec.r,
      subdivisions: 1
    }, scene);
    cluster.position.set(...spec.pos);
    cluster.material = materials.foliage;
    cluster.parent = root;
  });

  return root;
}