import { showFloatingText } from "../js/ui.js";

export class Flood {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.waterMesh = null;
    this.animObserver = null;
    this.targetY = 1.5;
    this.startY = -0.5;
  }

  activate() {
    if (this.active) return;
    this.active = true;

    if (!this.waterMesh) {
      this.waterMesh = BABYLON.MeshBuilder.CreateGround("floodWater", { width: 300, height: 300 }, this.scene);
      const mat = new BABYLON.StandardMaterial("floodWaterMat", this.scene);
      mat.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.8);
      mat.alpha = 0.6;
      mat.specularPower = 64;
      this.waterMesh.material = mat;
    }

    this.waterMesh.position.y = this.startY;
    this.waterMesh.setEnabled(true);

    this.animObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.active || !this.waterMesh) return;
      if (this.waterMesh.position.y < this.targetY) {
        this.waterMesh.position.y += 0.01;
      }
    });
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;

    if (this.animObserver) {
      this.scene.onBeforeRenderObservable.remove(this.animObserver);
      this.animObserver = null;
    }

    if (this.waterMesh) {
      this.waterMesh.setEnabled(false);
      this.waterMesh.position.y = this.startY;
    }
  }
}

export const flood = {
  name: "Flood 🌊",
  trigger(npcs, scene, camera, engine) {
    npcs.forEach(npc => {
      if (!npc.isDead && Math.random() < 0.6) {
        const dmg = 15 + Math.floor(Math.random() * 20);
        npc.health = Math.max(0, npc.health - dmg);
        showFloatingText(`Flood -${dmg} HP! 🌊`, npc.root.position, "#00BFFF", scene, camera, engine);
      }
    });
  }
};
