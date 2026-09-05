export function createCampfire(id, scene, isGhost = false) {
  const root = new BABYLON.TransformNode(id, scene);
  const scale = 0.85; // Smaller, more grounded campfire

  const rockMat = new BABYLON.StandardMaterial(id + "_rockMat", scene);
  rockMat.diffuseColor = new BABYLON.Color3(0.38, 0.37, 0.36);
  rockMat.specularColor = new BABYLON.Color3(0, 0, 0);
  rockMat.flatShaded = true;

  const rockMatDark = new BABYLON.StandardMaterial(id + "_rockMatD", scene);
  rockMatDark.diffuseColor = new BABYLON.Color3(0.26, 0.25, 0.24);
  rockMatDark.specularColor = new BABYLON.Color3(0, 0, 0);
  rockMatDark.flatShaded = true;

  const logMat = new BABYLON.StandardMaterial(id + "_logMat", scene);
  logMat.diffuseColor = new BABYLON.Color3(0.32, 0.19, 0.1);
  logMat.specularColor = new BABYLON.Color3(0, 0, 0);
  logMat.flatShaded = true;

  const charMat = new BABYLON.StandardMaterial(id + "_charMat", scene);
  charMat.diffuseColor = new BABYLON.Color3(0.12, 0.11, 0.1);
  charMat.specularColor = new BABYLON.Color3(0, 0, 0);
  charMat.flatShaded = true;

  const ashMat = new BABYLON.StandardMaterial(id + "_ashMat", scene);
  ashMat.diffuseColor = new BABYLON.Color3(0.42, 0.4, 0.36);
  ashMat.specularColor = new BABYLON.Color3(0, 0, 0);
  ashMat.flatShaded = true;

  const emberMat = new BABYLON.StandardMaterial(id + "_emberMat", scene);
  emberMat.diffuseColor = new BABYLON.Color3(0.6, 0.2, 0.05);
  emberMat.emissiveColor = new BABYLON.Color3(0.9, 0.35, 0.05);
  emberMat.specularColor = new BABYLON.Color3(0, 0, 0);

  // Ash bed
  const ashBed = BABYLON.MeshBuilder.CreateCylinder(id + "_ashBed", { diameterTop: 0.5 * scale, diameterBottom: 0.6 * scale, height: 0.05, tessellation: 8 }, scene);
  ashBed.position.y = 0.025;
  ashBed.material = ashMat;
  ashBed.parent = root;

  // Glowing embers peeking through the ash
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    const ember = BABYLON.MeshBuilder.CreatePolyhedron(id + "_ember_" + i, { type: 1, size: 0.05 * scale }, scene);
    ember.position.set(Math.cos(angle) * 0.15 * scale, 0.05, Math.sin(angle) * 0.15 * scale);
    ember.material = emberMat;
    ember.parent = root;
  }

  // Compact rock ring — smaller, tighter radius
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const rock = BABYLON.MeshBuilder.CreatePolyhedron(id + "_rock_" + i, { type: 1, size: (0.13 + Math.random() * 0.04) * scale }, scene);
    rock.position.set(Math.cos(angle) * 0.42 * scale, 0.06, Math.sin(angle) * 0.42 * scale);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.material = i % 2 === 0 ? rockMat : rockMatDark;
    rock.parent = root;
  }

  // Tepee-style crossed logs (charred at the tips) instead of a flat log pile
  const logCount = 4;
  for (let i = 0; i < logCount; i++) {
    const angle = (i / logCount) * Math.PI * 2 + 0.3;
    const log = BABYLON.MeshBuilder.CreateCylinder(id + "_log_" + i, { height: 0.62 * scale, diameterTop: 0.03 * scale, diameterBottom: 0.07 * scale, tessellation: 6 }, scene);
    log.position.set(Math.cos(angle) * 0.1 * scale, 0.24 * scale, Math.sin(angle) * 0.1 * scale);
    log.rotation.x = Math.cos(angle) * 0.55;
    log.rotation.z = -Math.sin(angle) * 0.55;
    log.material = logMat;
    log.parent = root;

    const charredTip = BABYLON.MeshBuilder.CreateCylinder(id + "_char_" + i, { height: 0.12 * scale, diameter: 0.055 * scale, tessellation: 6 }, scene);
    charredTip.position.set(Math.cos(angle) * 0.1 * scale, 0.42 * scale, Math.sin(angle) * 0.1 * scale);
    charredTip.rotation.x = Math.cos(angle) * 0.55;
    charredTip.rotation.z = -Math.sin(angle) * 0.55;
    charredTip.material = charMat;
    charredTip.parent = root;
  }

  if (!isGhost) {
    // Fire Light — smaller range/intensity to match the compact scale
    const fireLight = new BABYLON.PointLight(id + "_light", new BABYLON.Vector3(0, 0.5, 0), scene);
    fireLight.diffuse = new BABYLON.Color3(1, 0.5, 0.1);
    fireLight.intensity = 1.6;
    fireLight.range = 6;
    fireLight.parent = root;

    // Fire Particle System — tighter, smaller flame
    const ps = new BABYLON.ParticleSystem(id + "_fire", 80, scene);
    ps.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
    ps.emitter = root;
    ps.minEmitBox = new BABYLON.Vector3(-0.08 * scale, 0.1, -0.08 * scale);
    ps.maxEmitBox = new BABYLON.Vector3(0.08 * scale, 0.18, 0.08 * scale);
    ps.color1 = new BABYLON.Color4(1, 0.5, 0.1, 1.0);
    ps.color2 = new BABYLON.Color4(1, 0.1, 0.0, 1.0);
    ps.colorDead = new BABYLON.Color4(0.2, 0.2, 0.2, 0.0);
    ps.minSize = 0.16 * scale;
    ps.maxSize = 0.32 * scale;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.5;
    ps.emitRate = 45;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    ps.gravity = new BABYLON.Vector3(0, 4, 0);
    ps.start();

    // Light flickering animation
    let time = 0;
    const obs = scene.onBeforeRenderObservable.add(() => {
      time += 0.1;
      fireLight.intensity = 1.4 + Math.sin(time * 3) * 0.25 + Math.random() * 0.2;
    });

    root.metadata = { fireParticles: ps, fireLight, observer: obs };
  }

  return root;
}