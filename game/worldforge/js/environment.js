import { Flood } from '../nd/flood.js';
import { Earthquake } from '../nd/earthquake.js';
import { Lightning } from '../nd/lightning.js';
import { Wildfire } from '../nd/wildfire.js';

let scene, engine;
let envMaterials = {};
let weatherParticles = null;
let activeDisaster = null;

export function initEnvironment(babylonScene, babylonEngine) {
  scene = babylonScene;
  engine = babylonEngine;

  // Skybox setup
  const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
  const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://www.babylonjs-playground.com/textures/skybox", scene);
  skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
  skybox.material = skyboxMaterial;

  // Create environment materials
  envMaterials.grass = new BABYLON.StandardMaterial("grassMat", scene);
  envMaterials.grass.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);

  envMaterials.road = new BABYLON.StandardMaterial("roadMat", scene);
  envMaterials.road.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);

  envMaterials.building = new BABYLON.StandardMaterial("buildingMat", scene);
  envMaterials.building.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);

  // Ground Creation
  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
  ground.material = envMaterials.grass;
  ground.receiveShadows = true;

  return { ground, envMaterials };
}

export function setWeather(type) {
  if (weatherParticles) {
    weatherParticles.dispose();
    weatherParticles = null;
  }

  if (type === 'rain') {
    weatherParticles = new BABYLON.ParticleSystem("rain", 1500, scene);
    weatherParticles.emitter = new BABYLON.Vector3(0, 20, 0);
    weatherParticles.minEmitBox = new BABYLON.Vector3(-50, 0, -50);
    weatherParticles.maxEmitBox = new BABYLON.Vector3(50, 0, 50);
    weatherParticles.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
    weatherParticles.color2 = new BABYLON.Color4(0.2, 0.5, 1.0, 1.0);
    weatherParticles.colorDead = new BABYLON.Color4(0, 0, 0.2, 0.0);
    weatherParticles.minSize = 0.1;
    weatherParticles.maxSize = 0.2;
    weatherParticles.minLifeTime = 0.5;
    weatherParticles.maxLifeTime = 1.0;
    weatherParticles.emitRate = 500;
    weatherParticles.direction1 = new BABYLON.Vector3(0, -10, 0);
    weatherParticles.direction2 = new BABYLON.Vector3(0, -10, 0);
    weatherParticles.start();
  } else if (type === 'snow') {
    weatherParticles = new BABYLON.ParticleSystem("snow", 1000, scene);
    weatherParticles.emitter = new BABYLON.Vector3(0, 20, 0);
    weatherParticles.minEmitBox = new BABYLON.Vector3(-50, 0, -50);
    weatherParticles.maxEmitBox = new BABYLON.Vector3(50, 0, 50);
    weatherParticles.color1 = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0);
    weatherParticles.color2 = new BABYLON.Color4(0.9, 0.9, 1.0, 1.0);
    weatherParticles.colorDead = new BABYLON.Color4(1.0, 1.0, 1.0, 0.0);
    weatherParticles.minSize = 0.2;
    weatherParticles.maxSize = 0.5;
    weatherParticles.minLifeTime = 2.0;
    weatherParticles.maxLifeTime = 4.0;
    weatherParticles.emitRate = 200;
    weatherParticles.direction1 = new BABYLON.Vector3(-1, -2, -1);
    weatherParticles.direction2 = new BABYLON.Vector3(1, -2, 1);
    weatherParticles.start();
  }
}

export function triggerDisaster(type) {
  if (activeDisaster) {
    activeDisaster.deactivate();
    activeDisaster = null;
  }

  switch (type) {
    case 'flood':
      activeDisaster = new Flood(scene, envMaterials);
      break;
    case 'earthquake':
      activeDisaster = new Earthquake(scene);
      break;
    case 'lightning':
      activeDisaster = new Lightning(scene);
      break;
    case 'wildfire':
      activeDisaster = new Wildfire(scene);
      break;
    default:
      console.warn(`Unknown disaster type: ${type}`);
      return;
  }

  if (activeDisaster) {
    activeDisaster.activate();
  }
}

export function stopDisaster() {
  if (activeDisaster) {
    activeDisaster.deactivate();
    activeDisaster = null;
  }
}
