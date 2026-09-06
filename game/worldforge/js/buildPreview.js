// buildPreview.js – renders interactive 3-D previews for build-menu cards
import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";

const creators = {
  hut:      createLowPolyHut,
  campfire: createCampfire,
  farm:     createFarm,
  tower:    createWatchtower,
  well:     createWell,
  storage:  createStorage,
  market:   createMarket,
};

// Every preview shares one rAF loop. A separate engine.runRenderLoop per card
// meant seven extra render pipelines on top of the game's own, all still
// spinning while the tab was backgrounded.
const previews = [];
let lastTick = 0;
let ticking = false;

function tick(now) {
  requestAnimationFrame(tick);
  if (document.hidden) return;

  // Time-based so the spin looks identical on a 60Hz and a 144Hz display.
  const delta = lastTick ? Math.min((now - lastTick) / 1000, 0.1) : 0;
  lastTick = now;

  for (const p of previews) {
    p.root.rotation.y += delta * 0.5;
    p.scene.render();
  }
}

function startTicking() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
  window.addEventListener("resize", () => previews.forEach((p) => p.engine.resize()));
}

function initPreview(canvas, modelKey) {
  // Guard: canvas must have non-zero pixel size
  if (canvas.width === 0 || canvas.height === 0) {
    canvas.width  = 56;
    canvas.height = 56;
  }

  const creator = creators[modelKey];

  const engine = new BABYLON.Engine(canvas, true, {
    stencil: true,
    alpha: true,
  });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // transparent bg

  const camera = new BABYLON.ArcRotateCamera(
    "cam", -Math.PI / 4, Math.PI / 3, 4,
    BABYLON.Vector3.Zero(), scene
  );
  // Don't attach control – we drive rotation ourselves
  new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 2, 0), scene);

  const root = creator(`prev_${modelKey}`, scene);
  // Compute bounding box and auto-fit camera
  scene.executeWhenReady(() => {
    const bb = root.getHierarchyBoundingVectors(true);
    const size = bb.max.subtract(bb.min);
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.radius = maxDim * 2.2 || 4;
    camera.target = new BABYLON.Vector3(0, size.y * 0.3, 0);
  });

  previews.push({ engine, scene, root });
  startTicking();
}

// Each preview needs its own WebGL context, and browsers evict the oldest
// context once their cap is hit (~16 in Chrome, fewer on iOS) - which would
// take the game's context with it. So a card is only built once it has
// actually scrolled into view; cards never looked at never cost an engine.
function initAllPreviews() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      initPreview(entry.target, entry.target.dataset.model);
    });
  }, { rootMargin: "120px" });

  document.querySelectorAll("canvas.build-preview").forEach((c) => {
    if (c.dataset.model && creators[c.dataset.model]) observer.observe(c);
  });
}

// If DOM already ready (likely), run now; otherwise wait.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAllPreviews);
} else {
  initAllPreviews();
}