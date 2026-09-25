import { flatShade } from "../flatShade.js";
import { sharedMat, solidMat } from "./materials.js";

export function createMarket(id, scene) {
  const root = new BABYLON.TransformNode(id, scene);

  // Materials
  const woodMat = solidMat(scene, "market_wood", [0.48, 0.32, 0.18]); // warm timber

  const clothMat = sharedMat(scene, "market_cloth", () => {
    const m = new BABYLON.StandardMaterial("market_cloth", scene);
    m.diffuseColor = new BABYLON.Color3(0.88, 0.35, 0.28); // cozy cranberry red
    m.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    return m;
  });

  const clothWhiteMat = sharedMat(scene, "market_clothWhite", () => {
    const m = new BABYLON.StandardMaterial("market_clothWhite", scene);
    m.diffuseColor = new BABYLON.Color3(0.96, 0.94, 0.88); // warm cream
    m.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    return m;
  });

  const goldMat = sharedMat(scene, "market_gold", () => {
    const m = new BABYLON.StandardMaterial("market_gold", scene);
    m.diffuseColor = new BABYLON.Color3(0.98, 0.82, 0.25); // golden coins
    m.emissiveColor = new BABYLON.Color3(0.25, 0.18, 0.02);
    m.specularColor = new BABYLON.Color3(0.4, 0.4, 0.1);
    return m;
  });

  const sackMat = solidMat(scene, "market_sack", [0.74, 0.62, 0.44]); // warm burlap

  const fruitMat = sharedMat(scene, "market_fruit", () => {
    const m = new BABYLON.StandardMaterial("market_fruit", scene);
    m.diffuseColor = new BABYLON.Color3(0.92, 0.28, 0.22); // ripe red apples
    return m;
  });

  // Market Counter / Floor Platform
  const platform = BABYLON.MeshBuilder.CreateBox(id + "_plat", { width: 1.8, height: 0.1, depth: 1.4 }, scene);
  platform.position.y = 0.05;
  platform.material = woodMat;
  platform.parent = root;

  // Counter
  const counter = BABYLON.MeshBuilder.CreateBox(id + "_counter", { width: 1.6, height: 0.45, depth: 0.4 }, scene);
  counter.position.set(0, 0.275, -0.3);
  counter.material = woodMat;
  counter.parent = root;

  // Canopy Posts (4 corners)
  const posts = [
    [-0.8, -0.6], [0.8, -0.6],
    [-0.8, 0.6],  [0.8, 0.6]
  ];
  posts.forEach(([px, pz], i) => {
    const post = BABYLON.MeshBuilder.CreateCylinder(id + "_post_" + i, { height: 1.2, diameter: 0.07, tessellation: 6 }, scene);
    post.position.set(px, 0.6, pz);
    post.material = woodMat;
    post.parent = root;
  });

  // Striped Canopy Roof
  const canopySegments = 6;
  const segWidth = 1.8 / canopySegments;
  for (let i = 0; i < canopySegments; i++) {
    const stripe = BABYLON.MeshBuilder.CreateBox(id + "_roof_" + i, { width: segWidth, height: 0.04, depth: 1.5 }, scene);
    stripe.position.set(-0.9 + segWidth * (i + 0.5), 1.25 + Math.sin((i / canopySegments) * Math.PI) * 0.1, 0);
    stripe.rotation.z = (i - canopySegments / 2 + 0.5) * -0.03;
    stripe.material = i % 2 === 0 ? clothMat : clothWhiteMat;
    stripe.parent = root;
  }

  // Display Goods on Counter: Sacks & Fruit
  const sack1 = BABYLON.MeshBuilder.CreateSphere(id + "_sack1", { diameterX: 0.25, diameterY: 0.3, diameterZ: 0.25, segments: 6 }, scene);
  sack1.position.set(-0.5, 0.6, -0.3);
  sack1.material = sackMat;
  sack1.parent = root;

  const sack2 = BABYLON.MeshBuilder.CreateSphere(id + "_sack2", { diameterX: 0.2, diameterY: 0.25, diameterZ: 0.2, segments: 6 }, scene);
  sack2.position.set(-0.3, 0.58, -0.3);
  sack2.material = sackMat;
  sack2.parent = root;

  // Gold coins stack / box on counter
  const goldBox = BABYLON.MeshBuilder.CreateBox(id + "_goldBox", { width: 0.2, height: 0.12, depth: 0.2 }, scene);
  goldBox.position.set(0.4, 0.55, -0.3);
  goldBox.material = goldMat;
  goldBox.parent = root;

  // Fruit crates / apples
  for (let f = 0; f < 4; f++) {
    const apple = BABYLON.MeshBuilder.CreateSphere(id + "_apple_" + f, { diameter: 0.09, segments: 5 }, scene);
    apple.position.set(0.0 + (f % 2) * 0.1, 0.53 + Math.floor(f / 2) * 0.08, -0.3 + (f % 2) * 0.05);
    apple.material = fruitMat;
    apple.parent = root;
  }

  // Market Sign on front beam
  const signBeam = BABYLON.MeshBuilder.CreateBox(id + "_signBeam", { width: 0.6, height: 0.2, depth: 0.03 }, scene);
  signBeam.position.set(0, 1.1, -0.65);
  signBeam.material = woodMat;
  signBeam.parent = root;

  const signCoin = BABYLON.MeshBuilder.CreateCylinder(id + "_signCoin", { diameter: 0.14, height: 0.02, tessellation: 10 }, scene);
  signCoin.rotation.x = Math.PI / 2;
  signCoin.position.set(0, 1.1, -0.67);
  signCoin.material = goldMat;
  signCoin.parent = root;

  return flatShade(root);
}