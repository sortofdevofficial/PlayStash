import { showFloatingText } from "../js/ui.js";

export class Earthquake {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.originalTarget = null;
    this.animObserver = null;
  }

  activate() {
    if (this.active) return;
    this.active = true;

    const camera = this.scene.activeCamera;
    if (camera) {
      this.animObserver = this.scene.onBeforeRenderObservable.add(() => {
        if (!this.active || !camera.target) return;
        camera.target.x += (Math.random() - 0.5) * 0.4;
        camera.target.z += (Math.random() - 0.5) * 0.4;
      });
    }
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;

    if (this.animObserver) {
      this.scene.onBeforeRenderObservable.remove(this.animObserver);
      this.animObserver = null;
    }
  }
}

export const earthquake = {
  name: "Earthquake 🌋",
  trigger(npcs, scene, camera, engine) {
    npcs.forEach(npc => {
      // Defensive init: health isn't guaranteed to exist on every NPC yet
      // (older saves, or NPCs spawned before health tracking existed).
      if (npc.health === undefined) npc.health = 100;
      if (npc.isDead) return;

      if (Math.random() < 0.7) {
        const dmg = 20 + Math.floor(Math.random() * 20);
        npc.health = Math.max(0, npc.health - dmg);
        // Death/respawn is handled centrally by updateNPCs() in npcBrain.js
        // on its next tick (it checks npc.health <= 0 every frame) - setting
        // isDead here without also disposing the mesh and respawning left
        // earthquake/flood-killed NPCs as permanent lifeless zombies that
        // updateNPCs would then skip forever (isDead short-circuits it).
        showFloatingText(`Quake -${dmg} HP! 🌋`, npc.root?.position, "#FFA500", scene, camera, engine);
      }
    });
  }
};