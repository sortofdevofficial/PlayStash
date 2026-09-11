import { showFloatingText } from "../js/ui.js";

export const wildfire = {
  name: "Wildfire 🔥",
  trigger(npcs, scene, camera, engine) {
    npcs.forEach(npc => {
      if (!npc.isDead && Math.random() < 0.5) {
        const dmg = 15 + Math.floor(Math.random() * 15);
        npc.health = Math.max(0, npc.health - dmg);
        showFloatingText(`Wildfire -${dmg} HP! 🔥`, npc.root.position, "#FF6B81", scene, camera, engine);
      }
    });
  }
};
