import { showFloatingText } from "../js/ui.js";

export const earthquake = {
  name: "Earthquake 🌍",
  trigger(npcs, scene, camera, engine) {
    npcs.forEach(npc => {
      if (!npc.isDead && Math.random() < 0.7) {
        const dmg = 20 + Math.floor(Math.random() * 20);
        npc.health = Math.max(0, npc.health - dmg);
        showFloatingText(`Earthquake -${dmg} HP! 🌍`, npc.root.position, "#FF4757", scene, camera, engine);
      }
    });
  }
};
