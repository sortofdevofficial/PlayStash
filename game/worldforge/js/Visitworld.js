// In-place "Visit" mode: renders another player's saved world as a
// temporary overlay in the SAME tab/scene the player is already using - no
// page navigation, no new tab. Never touches placedObjects/occupiedGrid or
// calls markDirty(), so the live save can't be corrupted no matter what.
// Leaving disposes every temporary node and hands the camera + world back.
import { scene, camera, createLowPolyTree, createLowPolyStone, envMaterials } from "./environment.js";
import { createLowPolyHut } from "./models/hut.js";
import { createCampfire } from "./models/campfire.js";
import { createFarm } from "./models/farm.js";
import { createWatchtower } from "./models/watchtower.js";
import { createWell } from "./models/well.js";
import { createStorage } from "./models/storage.js";
import { createMarket } from "./models/market.js";
import { gridToWorldCenter } from "./npcBrain.js";
import { TYPE_BY_CODE, loadWorldByUid } from "./db.js";
import { showNotif, state } from "./ui.js";
import { clearTrackedNpc } from "./npcPanel.js";

const BUILDERS = {
  tree: (id, s) => createLowPolyTree(id, s, envMaterials),
  stone: (id, s) => createLowPolyStone(id, s),
  hut: (id, s) => createLowPolyHut(id, s),
  campfire: (id, s) => createCampfire(id, s),
  farm: (id, s) => createFarm(id, s),
  tower: (id, s) => createWatchtower(id, s),
  well: (id, s) => createWell(id, s),
  storage: (id, s) => createStorage(id, s),
  market: (id, s) => createMarket(id, s)
};

const ONE_TILE_TYPES = new Set(["campfire", "well", "stone"]);
function sizeForVisit(type) { return ONE_TILE_TYPES.has(type) ? 1 : 2; }

let visitRoot = null; // a single TransformNode parenting every temporary mesh, so leaving is one .dispose()
let previousCameraState = null;
let previousMode = null;
let onLeaveCallback = null;

export function isVisiting() { return visitRoot !== null; }

function buildVisitScene(worldData) {
  visitRoot = new BABYLON.TransformNode("visitRoot", scene);

  let buildingCount = 0;
  if (worldData.b) {
    Object.entries(worldData.b).forEach(([key, node]) => {
      const code = key.replace(/\d+$/, "");
      const type = TYPE_BY_CODE[code];
      const builder = type && BUILDERS[type];
      if (!builder) return;

      const [cx, cz] = String(node?.c || "").split(",").map(Number);
      if (!Number.isFinite(cx) || !Number.isFinite(cz)) return;

      const pos = gridToWorldCenter(cx, cz, sizeForVisit(type));
      const quadrant = Number.isFinite(node.r) ? ((Math.round(node.r) % 4) + 4) % 4 : 0;

      const objRoot = builder(`visit_${key}`, scene);
      objRoot.position.set(pos.x, 0, pos.z);
      objRoot.rotation.y = quadrant * (Math.PI / 2);
      objRoot.parent = visitRoot;
      buildingCount++;
    });
  }

  return buildingCount;
}

// Hides the player's own world (buildings + NPCs) for the duration of the
// visit so the two don't visually overlap on the shared ground plane, then
// restores everything on leave. Purely a visibility toggle - nothing here
// touches placedObjects/activeNPCs data, so the live save is never at risk.
function setOwnWorldVisible(visible, placedObjects, activeNPCs) {
  placedObjects.forEach((obj) => { if (obj.root) obj.root.setEnabled(visible); });
  activeNPCs.forEach((npc) => { if (npc.root) npc.root.setEnabled(visible); });
}

export async function startVisit(uid, hostName, placedObjects, activeNPCs) {
  if (isVisiting()) return;

  clearTrackedNpc(); // don't fight the visit's camera framing with an active NPC-follow lerp
  showNotif(`Visiting ${hostName || "a player"}'s world…`, "info");
  const worldData = await loadWorldByUid(uid);
  if (!worldData) {
    showNotif("That world couldn't be loaded.", "warn");
    return;
  }

  // Force out of build/remove mode and lock input the same way the ?view=
  // page-navigation path does, so nothing placed/removed while spectating.
  previousMode = state.mode;
  state.mode = "none";
  state.isSpectating = true;

  setOwnWorldVisible(false, placedObjects, activeNPCs);
  const buildingCount = buildVisitScene(worldData);

  // Remember exactly where the player's own camera was so Leave can put it
  // back - otherwise they'd return to their world staring at wherever the
  // visited plot happened to be framed, which is empty space in their own.
  previousCameraState = {
    target: camera.target.clone(),
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius
  };

  camera.setTarget(BABYLON.Vector3.Zero());
  camera.radius = 55;
  camera.alpha = -Math.PI / 2;
  camera.beta = Math.PI / 3;

  showBanner(hostName, buildingCount);
  showNotif(`Now visiting ${hostName || "a player"}'s world (${buildingCount} builds)`, "success");
}

export function endVisit(placedObjects, activeNPCs) {
  if (!isVisiting()) return;
  visitRoot.dispose(false, true);
  visitRoot = null;
  hideBanner();
  setOwnWorldVisible(true, placedObjects, activeNPCs);

  state.isSpectating = false;
  state.mode = previousMode || "none";
  previousMode = null;

  if (previousCameraState) {
    camera.setTarget(previousCameraState.target);
    camera.alpha = previousCameraState.alpha;
    camera.beta = previousCameraState.beta;
    camera.radius = previousCameraState.radius;
    previousCameraState = null;
  }

  showNotif("Back in your own world", "info");
  if (onLeaveCallback) onLeaveCallback();
}

function showBanner(hostName, buildingCount) {
  let banner = document.getElementById("visitBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "visitBanner";
    banner.style.cssText = `
      position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
      z-index: 2500; background: rgba(15, 20, 28, 0.85); color: #fff;
      padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; gap: 10px; backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(banner);
  }
  banner.innerHTML = `
    <span>🌍 Visiting <b>${hostName || "a player"}'s</b> world · ${buildingCount} builds</span>
    <button id="leaveVisitBtn" style="padding:4px 10px; font-size:11px;">Leave</button>
  `;
  banner.style.display = "flex";
}

function hideBanner() {
  const banner = document.getElementById("visitBanner");
  if (banner) banner.style.display = "none";
}

// index.js calls this once at startup, passing the live collections so the
// Leave button (created dynamically inside showBanner) can find them without
// this module needing to own or import that state itself.
export function initVisitWorld(placedObjects, activeNPCs, onLeave) {
  onLeaveCallback = onLeave || null;
  document.body.addEventListener("click", (e) => {
    if (e.target && e.target.id === "leaveVisitBtn") endVisit(placedObjects, activeNPCs);
  });
}