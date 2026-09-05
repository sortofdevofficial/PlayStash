// buildPreview.js – renders interactive 3-D previews for build-menu cards
import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { createWallSegment, createGate } from "./models/wall.js";

const creators = {
  hut:      createLowPolyHut,
  campfire: createCampfire,
  farm:     createFarm,
  tower:    createWatchtower,
  well:     createWell,
  storage:  createStorage,
  market:   createMarket,
  wall:     createWallSegment,
  gate:     createGate,
};

function initPreview(canvas, modelKey) {
  // Guard: canvas must have non-zero pixel size
  if (canvas.width === 0 || canvas.height === 0) {
    canvas.width  = 56;
    canvas.height = 56;
  }

  const creator = creators[modelKey];
  if (!creator) {
    console.warn(`buildPreview: no creator for "${modelKey}"`);
    return;
  }

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
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

  // Always slowly rotate so the model is clearly visible
  engine.runRenderLoop(() => {
    root.rotation.y += 0.008;
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
}

// Module scripts run after DOMContentLoaded; just scan directly.
function initAllPreviews() {
  document.querySelectorAll("canvas.build-preview").forEach((c) => {
    const model = c.dataset.model;
    if (model) initPreview(c, model);
  });
}

// If DOM already ready (likely), run now; otherwise wait.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAllPreviews);
} else {
  initAllPreviews();
}
