import { showFloatingText } from "../js/ui.js";

// Visual effect: a translucent blue plane rises up from below the map to
// just above ground level and slowly recedes again over the disaster's
// duration - reads as "the whole map is briefly flooding" without needing
// per-tile terrain deformation.
export class Flood {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.waterMesh = null;
    this.animObserver = null;
    this.elapsed = 0;
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.elapsed = 0;

    this.waterMesh = BABYLON.MeshBuilder.CreateGround("floodWater", { width: 400, height: 400 }, this.scene);
    const mat = new BABYLON.StandardMaterial("floodWaterMat", this.scene);
    mat.diffuseColor = new BABYLON.Color3(0.15, 0.35, 0.55);
    mat.alpha = 0.55;
    mat.specularColor = new BABYLON.Color3(0.3, 0.4, 0.5);
    this.waterMesh.material = mat;
    this.waterMesh.isPickable = false;
    this.waterMesh.position.y = -3;

    const riseTime = 1.5;   // seconds to rise to peak
    const holdTime = 5.0;   // seconds held at peak
    const fallTime = 1.5;   // seconds to recede

    this.animObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.active || !this.waterMesh) return;
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      this.elapsed += dt;

      let y;
      if (this.elapsed < riseTime) {
        y = BABYLON.Scalar.Lerp(-3, 0.6, this.elapsed / riseTime);
      } else if (this.elapsed < riseTime + holdTime) {
        y = 0.6 + Math.sin(this.elapsed * 2) * 0.05; // gentle bob while at peak
      } else {
        const t = Math.min(1, (this.elapsed - riseTime - holdTime) / fallTime);
        y = BABYLON.Scalar.Lerp(0.6, -3, t);
      }
      this.waterMesh.position.y = y;
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
  name: "Flood 🌊",
  trigger(npcs, scene, camera, engine) {
    npcs.forEach((npc) => {
      // Defensive init: health isn't guaranteed to exist on every NPC yet
      // (older saves, or NPCs spawned before health tracking existed).
      if (npc.health === undefined) npc.health = 100;
      if (npc.isDead) return;

      if (Math.random() < 0.35) {
        const dmg = 10 + Math.floor(Math.random() * 15);
        npc.health = Math.max(0, npc.health - dmg);
        // Death/respawn is handled centrally by updateNPCs() in npcBrain.js -
        // see the matching comment in earthquake.js for why this trigger
        // only ever applies damage and never sets isDead itself.
        showFloatingText(`Flood -${dmg} HP! 🌊`, npc.root?.position, "#4FC3F7", scene, camera, engine);
      }
    });
  }
};