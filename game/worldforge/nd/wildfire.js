import { showFloatingText } from "../js/ui.js";

export class Wildfire {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.fireSystem = null;
    this.fireLight = null;
  }

  activate() {
    if (this.active) return;
    this.active = true;

    this.fireSystem = new BABYLON.ParticleSystem("fire", 1000, this.scene);
    this.fireSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", this.scene);
    this.fireSystem.emitter = new BABYLON.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40);
    this.fireSystem.minEmitBox = new BABYLON.Vector3(-10, 0, -10);
    this.fireSystem.maxEmitBox = new BABYLON.Vector3(10, 0, 10);

    this.fireSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
    this.fireSystem.color2 = new BABYLON.Color4(1, 0.1, 0, 1.0);
    this.fireSystem.colorDead = new BABYLON.Color4(0.2, 0, 0, 0.0);

    this.fireSystem.minSize = 0.5;
    this.fireSystem.maxSize = 2.0;
    this.fireSystem.minLifeTime = 0.3;
    this.fireSystem.maxLifeTime = 1.0;
    this.fireSystem.emitRate = 300;

    this.fireSystem.direction1 = new BABYLON.Vector3(-0.5, 2, -0.5);
    this.fireSystem.direction2 = new BABYLON.Vector3(0.5, 3, 0.5);
    this.fireSystem.minEmitPower = 1;
    this.fireSystem.maxEmitPower = 3;

    this.fireSystem.start();

    this.fireLight = new BABYLON.PointLight("wildfireLight", this.fireSystem.emitter, this.scene);
    this.fireLight.diffuse = new BABYLON.Color3(1, 0.3, 0);
    this.fireLight.intensity = 2;
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;

    if (this.fireSystem) {
      this.fireSystem.stop();
      setTimeout(() => {
        if (this.fireSystem) this.fireSystem.dispose();
      }, 1000);
    }
    if (this.fireLight) {
      this.fireLight.dispose();
      this.fireLight = null;
    }
  }
}

export const wildfire = {
  name: "Wildfire 🔥",
  trigger(npcs, scene, camera, engine) {
    npcs.forEach(npc => {
      if (npc.health === undefined) npc.health = 100;
      if (!npc.isDead && Math.random() < 0.5) {
        const dmg = 25 + Math.floor(Math.random() * 20);
        npc.health = Math.max(0, npc.health - dmg);
        showFloatingText(`Wildfire -${dmg} HP! 🔥`, npc.root?.position, "#FF4500", scene, camera, engine);
      }
    });
  }
};