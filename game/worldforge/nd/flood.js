import { showFloatingText } from "../js/ui.js";

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
