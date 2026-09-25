// buildPreview.js – renders interactive 3-D previews for build-menu cards
import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { createLumbermill } from "./models/lumbermill.js";

const creators = {
  hut:      createLowPolyHut,
  campfire: createCampfire,
  farm:     createFarm,
  tower:    createWatchtower,
  well:     createWell,
  storage:  createStorage,
  market:   createMarket,
  lumbermill: createLumbermill,
};

// Every preview shares one rAF loop, and each card only spins for a fixed
// intro: eight scenes rendering forever is eight extra WebGL passes per frame
// on a menu the player mostly reads rather than watches.
const PREVIEW_SPIN_FRAMES = 150;

const previews = [];
let lastTick = 0;
let ticking = false;

function anyPending() {
  return previews.some((p) => p.framesLeft > 0);
}

function tick(now) {
  if (!anyPending()) {
    ticking = false;
    lastTick = 0;
    return; // loop stops on the last drawn frame
  }
  requestAnimationFrame(tick);
  if (document.hidden) return;

  // Time-based so the spin looks identical on a 60Hz and a 144Hz display.
  const delta = lastTick ? Math.min((now - lastTick) / 1000, 0.1) : 0;
  lastTick = now;

  for (const p of previews) {
    if (p.framesLeft <= 0) continue;
    p.framesLeft--;
    p.root.rotation.y += delta * 0.5;
    p.scene.render();
  }
}

function startTicking() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
}

// A resized canvas loses its backbuffer, so each preview redraws once and stops.
function redrawOnce() {
  previews.forEach((p) => {
    p.engine.resize();
    p.scene.render();
  });
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
  // Warm, gentle lighting for cozy card previews
  const hemi = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 2.5, 0.5), scene);
  hemi.intensity = 1.15;
  hemi.diffuse = new BABYLON.Color3(1.0, 0.95, 0.88);
  hemi.groundColor = new BABYLON.Color3(0.45, 0.40, 0.35);

  const root = creator(`prev_${modelKey}`, scene);
  // Compute bounding box and auto-fit camera
  scene.executeWhenReady(() => {
    const bb = root.getHierarchyBoundingVectors(true);
    const size = bb.max.subtract(bb.min);
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.radius = maxDim * 2.2 || 4;
    camera.target = new BABYLON.Vector3(0, size.y * 0.3, 0);
  });

  previews.push({ engine, scene, root, framesLeft: PREVIEW_SPIN_FRAMES });
  startTicking();
}

// Each preview needs its own WebGL context, and browsers evict the oldest
// context once their cap is hit (~16 in Chrome, fewer on iOS) - which would
// take the game's context with it. So a card is only built once it has
// actually scrolled into view; cards never looked at never cost an engine.
function initAllPreviews() {
  window.addEventListener("resize", redrawOnce);
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