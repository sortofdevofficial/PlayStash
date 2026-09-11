import { showFloatingText } from "../js/ui.js";

export class Flood {
  constructor(scene, envMaterials) {
    this.scene = scene;
    this.envMaterials = envMaterials;
    this.active = false;
    this.waterMesh = null;
    this.animObserver = null;
  }

  activate() {
    if (this.active) return;
    this.active = true;

    this.waterMesh = BABYLON.MeshBuilder.CreateGround("floodWater", { width: 100, height: 100 }, this.scene);
    this.waterMesh.position.y = 0.1;

    const waterMat = new BABYLON.StandardMaterial("floodWaterMat", this.scene);
    waterMat.diffuseColor = new BABYLON.Color3(0.1, 0.4, 0.8);
    waterMat.alpha = 0.65;
    this.waterMesh.material = waterMat;

    this.animObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.active || !this.waterMesh) return;
      if (this.waterMesh.position.y < 3.5) {
        this.waterMesh.position.y += 0.02;
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
      this.waterMesh.dispose();
      this.waterMesh = null;
    }
  }
}

export const flood = {
  name: "Flash Flood 🌊",
  trigger(npcs, scene, camera, engine) {
    npcs.forEach(npc => {
      if (!npc.isDead && Math.random() < 0.6) {
        const dmg = 15 + Math.floor(Math.random() * 20);
        npc.health = Math.max(0, npc.health - dmg);
        showFloatingText(`Flood -${dmg} HP! 🌊`, npc.root.position, "#70A1FF", scene, camera, engine);
      }
    });
  }
};
