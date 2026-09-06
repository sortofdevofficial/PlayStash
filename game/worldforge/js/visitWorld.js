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
import { createWallSegment, createGate } from "./models/wall.js";
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
  market: (id, s) => createMarket(id, s),
  wall: (id, s) => createWallSegment(id, s),
  gate: (id, s) => createGate(id, s)
};

const ONE_TILE_TYPES = new Set(["campfire", "well", "stone", "wall", "gate"]);
function sizeForVisit(type) { return ONE_TILE_TYPES.has(type) ? 1 : 2; }

let visitRoot = null; // a single TransformNode parenting every temporary mesh, so leaving is one .dispose()
let previousCameraState = null;
let previousMode = null;
let previousSpectating = false;
let onLeaveCallback = null;

// Captured by initVisitWorld so visitUid()/endVisit() need no arguments.
let livePlacedObjects = null;
let liveActiveNPCs = null;

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
  previousSpectating = !!state.isSpectating;
  state.mode = "none";
  state.isSpectating = true;

  setOwnWorldVisible(false, placedObjects, activeNPCs);

  let buildingCount;
  try {
    buildingCount = buildVisitScene(worldData);
  } catch (err) {
    // The player's own world is already hidden and the Leave button is not
    // created until the end of this function, so a bare throw here would leave
    // them with an invisible village and no way back short of a reload.
    console.warn("[visit] Failed to render world:", err);
    if (visitRoot) { visitRoot.dispose(false, true); visitRoot = null; }
    setOwnWorldVisible(true, placedObjects, activeNPCs);
    state.isSpectating = previousSpectating;
    state.mode = previousMode || "none";
    previousMode = null;
    showNotif("That world couldn't be rendered.", "warn");
    return;
  }

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

export function endVisit(placedObjects = livePlacedObjects, activeNPCs = liveActiveNPCs) {
  if (!isVisiting()) return;
  visitRoot.dispose(false, true);
  visitRoot = null;
  hideBanner();
  setOwnWorldVisible(true, placedObjects, activeNPCs);

  // Restore, don't clear: a player who arrived via ?view= was already
  // spectating and must stay read-only after leaving an in-place visit.
  state.isSpectating = previousSpectating;
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
  // hostName is another player's saved name, so it is only ever set as text -
  // interpolating it into innerHTML would let a crafted name run script here.
  banner.replaceChildren();

  const label = document.createElement("span");
  const who = document.createElement("b");
  who.textContent = `${hostName || "a player"}'s`;
  label.append("🌍 Visiting ", who, ` world · ${buildingCount} builds`);

  const leave = document.createElement("button");
  leave.id = "leaveVisitBtn";
  leave.style.cssText = "padding:4px 10px; font-size:11px;";
  leave.textContent = "Leave";

  banner.append(label, leave);
  banner.style.display = "flex";
}

function hideBanner() {
  const banner = document.getElementById("visitBanner");
  if (banner) banner.style.display = "none";
}

// Entry point for the other-worlds panel: renders that player's world in this
// same tab and scene. Resolves false if a visit is already running or the live
// collections were never handed over by initVisitWorld.
export async function visitUid(uid, hostName) {
  if (!uid || isVisiting() || !livePlacedObjects || !liveActiveNPCs) return false;
  await startVisit(uid, hostName, livePlacedObjects, liveActiveNPCs);
  return isVisiting();
}

// index.js calls this once at startup, passing the live collections so the
// Leave button (created dynamically inside showBanner) can find them without
// this module needing to own or import that state itself.
export function initVisitWorld(placedObjects, activeNPCs, onLeave) {
  livePlacedObjects = placedObjects;
  liveActiveNPCs = activeNPCs;
  onLeaveCallback = onLeave || null;
  document.body.addEventListener("click", (e) => {
    if (e.target && e.target.id === "leaveVisitBtn") endVisit();
  });
}