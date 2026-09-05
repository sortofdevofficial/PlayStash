export const GAME_ID = 1;

// Game-internal resource name -> database field.
// `wh` is harvested from trees and spent on every building, so it is wood; the
// HUD label "Wheat" is wrong. `food` comes from farms and is eaten by villagers.
export const RESOURCE_KEY_MAP = { wh: "wo", food: "w", stone: "s", water: "wa" };

const RESOURCE_KEY_BY_SHORT = Object.fromEntries(
  Object.entries(RESOURCE_KEY_MAP).map(([internal, short]) => [short, internal])
);

const SAVE_INTERVAL_MS = 3000;
const AUTH_TIMEOUT_MS = 5000;

const firebaseConfig = {
  apiKey: "AIzaSyCWBT35QNUywT-_RgeqeZXv44Z9frUYZMU",
  authDomain: "playstash0.firebaseapp.com",
  projectId: "playstash0",
  storageBucket: "playstash0.firebasestorage.app",
  messagingSenderId: "1015051983836",
  appId: "1:1015051983836:web:3c89a152ce8c476852cd19",
  databaseURL: "https://playstash0-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let ref = null;
let get = null;
let update = null;
let onAuthStateChanged = null;
let db = null;
let auth = null;

// Dynamic import so an unreachable CDN degrades to a playable offline game
// instead of throwing at module-evaluation time and killing the whole page.
try {
  const [appMod, authMod, dbMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")
  ]);

  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  db = dbMod.getDatabase(app);
  onAuthStateChanged = authMod.onAuthStateChanged;
  ref = dbMod.ref;
  get = dbMod.get;
  update = dbMod.update;
} catch (err) {
  console.warn("[db] Firebase unavailable - playing without cloud saves.", err);
}

let playerId = null;
let saveRef = null;
let dirty = false;
let autosaveTimer = null;
let sources = null;
let onStatus = () => {};

export function getPlayerId() { return playerId; }

export function authReady() {
  if (!auth) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(playerId);
    };
    // Never let a slow or blocked auth handshake stall the game forever.
    const timer = setTimeout(settle, AUTH_TIMEOUT_MS);

    onAuthStateChanged(auth, (user) => {
      playerId = user ? user.uid : null;
      saveRef = playerId ? ref(db, `G/${GAME_ID}/${playerId}`) : null;
      settle();
      // Auth outlived the timeout, so boot already committed to a fresh guest
      // world whose ids (tree1, hut1, ...) would collide with a restored save.
      // Autosaving here would overwrite the real save, so ask for a reload instead.
      if (playerId && sources && !autosaveTimer) onStatus("reload");
    });
  });
}

export async function loadSave() {
  if (!saveRef) return null;
  try {
    const snap = await get(saveRef);
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.warn("[db] Load failed:", err);
    return null;
  }
}

export function serializeWorld(placedObjects, activeNPCs, gameState) {
  const r = {};
  for (const [internal, short] of Object.entries(RESOURCE_KEY_MAP)) {
    r[short] = Math.round(gameState.resources[internal] || 0);
  }

  const b = {};
  placedObjects.forEach((obj) => {
    if (!obj.key) return;
    const quadrant = obj.root ? Math.round(obj.root.rotation.y / (Math.PI / 2)) : 0;
    const node = {
      c: `${obj.rootX},${obj.rootZ}`,
      r: ((quadrant % 4) + 4) % 4
    };
    if (obj.type === "tree" || obj.type === "stone") node.hl = obj.health ?? 3;
    b[obj.key] = node;
  });

  const n = {};
  activeNPCs.forEach((npc) => {
    n[npc.id] = {
      c: `${Math.floor(npc.root.position.x)},${Math.floor(npc.root.position.z)}`,
      h: Math.round(npc.hunger),
      hp: Math.round(npc.happiness),
      a: npc.a,
      n: npc.name
    };
  });

  // null deletes the subtree, so a cleared world does not leave stale children behind.
  return {
    r,
    b: Object.keys(b).length ? b : null,
    n: Object.keys(n).length ? n : null
  };
}

async function writeWorld() {
  if (!saveRef || !sources) return;
  onStatus("saving");
  try {
    await update(saveRef, serializeWorld(sources.placedObjects, sources.activeNPCs, sources.state));
    onStatus("saved");
  } catch (err) {
    console.warn("[db] Save failed:", err);
    dirty = true;
    onStatus("error");
  }
}

function startTimer() {
  if (autosaveTimer || !saveRef) return;
  autosaveTimer = setInterval(() => {
    // Throttle, not debounce: villagers drift every frame, so a debounce would never fire.
    if (sources && sources.activeNPCs.length > 0) dirty = true;
    if (!dirty) return;
    dirty = false;
    writeWorld();
  }, SAVE_INTERVAL_MS);
}

export function markDirty() { dirty = true; }

export function flushNow() {
  if (!dirty || !saveRef) return;
  dirty = false;
  writeWorld();
}

export function initAutosave(worldSources, statusCallback) {
  sources = worldSources;
  if (statusCallback) onStatus = statusCallback;
  startTimer();

  document.addEventListener("visibilitychange", () => { if (document.hidden) flushNow(); });
  window.addEventListener("pagehide", flushNow);
}

export { RESOURCE_KEY_BY_SHORT };
