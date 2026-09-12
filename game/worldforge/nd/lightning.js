import { showFloatingText } from "../js/ui.js";

export class Lightning {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.strikeInterval = null;
  }

  activate() {
    if (this.active) return;
    this.active = true;

    this.strikeInterval = setInterval(() => {
      if (!this.active) return;
      this.triggerStrike();
    }, 4000);
  }

  triggerStrike() {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;

    const points = [
      new BABYLON.Vector3(x, 40, z),
      new BABYLON.Vector3(x + (Math.random() - 0.5) * 4, 20, z + (Math.random() - 0.5) * 4),
      new BABYLON.Vector3(x, 0, z)
    ];

    const bolt = BABYLON.MeshBuilder.CreateLines("lightningBolt", { points }, this.scene);
    bolt.color = new BABYLON.Color3(1, 1, 0.8);

    const light = new BABYLON.PointLight("lightningFlash", new BABYLON.Vector3(x, 15, z), this.scene);
    light.diffuse = new BABYLON.Color3(1, 1, 0.9);
    light.intensity = 5;

    setTimeout(() => {
      bolt.dispose();
      light.dispose();
    }, 300);
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;

    if (this.strikeInterval) {
      clearInterval(this.strikeInterval);
      this.strikeInterval = null;
    }
  }
}

export const lightning = {
  name: "Lightning Strike ⚡",
  trigger(npcs, scene, camera, engine) {
    npcs.forEach(npc => {
      if (npc.health === undefined) npc.health = 100;
      if (!npc.isDead && Math.random() < 0.4) {
        const dmg = 30 + Math.floor(Math.random() * 25);
        npc.health = Math.max(0, npc.health - dmg);
        showFloatingText(`Lightning -${dmg} HP! ⚡`, npc.root?.position, "#FFFF00", scene, camera, engine);
      }
    });
  }
};