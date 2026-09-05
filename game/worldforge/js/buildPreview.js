// buildPreview.js – renders interactive 3‑D previews for build‑menu cards
import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { createWallSegment, createGate } from "./models/wall.js";

const creators = {
  hut: createLowPolyHut,
  campfire: createCampfire,
  farm: createFarm,
  tower: createWatchtower,
  well: createWell,
  storage: createStorage,
  market: createMarket,
  wall: createWallSegment,
  gate: createGate,
};

function initPreview(canvas, modelKey) {
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new BABYLON.Scene(engine);
  const camera = new BABYLON.ArcRotateCamera(
    "cam",
    Math.PI / 2,
    Math.PI / 2.5,
    5,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);
  new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

  const creator = creators[modelKey];
  if (!creator) {
    console.warn(`No preview creator for model ${modelKey}`);
    return;
  }
  const root = creator(`preview_${modelKey}`, scene);
  root.scaling.scaleInPlace(0.5);

  let hover = false;
  canvas.addEventListener("pointerenter", () => (hover = true));
  canvas.addEventListener("pointerleave", () => (hover = false));

  engine.runRenderLoop(() => {
    if (hover) {
      root.rotation.y += 0.01;
    }
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
}

window.addEventListener("DOMContentLoaded", () => {
  const canvases = document.querySelectorAll("canvas.build-preview");
  canvases.forEach((c) => {
    const model = c.dataset.model;
    if (model) {
      initPreview(c, model);
    }
  });
});
