import { showFloatingText } from "../js/ui.js";

export const lightning = {
  name: "Lightning Strike ⚡",
  trigger(npcs, scene, camera, engine) {
    const aliveNpcs = npcs.filter(npc => !npc.isDead);
    if (aliveNpcs.length === 0) return;
    const target = aliveNpcs[Math.floor(Math.random() * aliveNpcs.length)];
    const dmg = 40 + Math.floor(Math.random() * 30);
    target.health = Math.max(0, target.health - dmg);
    showFloatingText(`Lightning Strike -${dmg} HP! ⚡`, target.root.position, "#FFD700", scene, camera, engine);
  }
};
