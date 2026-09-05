export const GAME_ID = 1;

// Game-internal resource name -> database field.
// `wh` is harvested from trees and spent on every building, so it is wood; the
// HUD label "Wheat" is wrong. `food` comes from farms and is eaten by villagers.
export const RESOURCE_KEY_MAP = { wh: "wo", food: "w", stone: "s", water: "wa" };

const RESOURCE_KEY_BY_SHORT = Object.fromEntries(
  Object.entries(RESOURCE_KEY_MAP).map(([internal, short]) => [short, internal])
);

// Build key prefix, so campfire 1 is stored as `c1`. tree/tower, stone/storage
// and well/wall share a first letter, so those pairs take a second character.
const BUILD_CODE = {
  tree: "t", stone: "s", hut: "h", campfire: "c", farm: "f", market: "m", gate: "g",
  tower: "tw", well: "w", wall: "wl", storage: "st"
};

const TYPE_BY_CODE = Object.fromEntries(
  Object.entries(BUILD_CODE).map(([type, code]) => [code, type])
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
let signInAnonymously = null;
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
  signInAnonymously = authMod.signInAnonymously;
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
      if (!user) {
        // No session yet (first visit, or the anonymous user was cleared) — the
        // rules require auth != null, so without an explicit sign-in call the
        // listener would just report null forever and every write would 403.
        if (signInAnonymously) {
          signInAnonymously(auth).catch((err) => {
            console.warn("[db] Anonymous sign-in failed:", err);
            settle();
          });
        } else {
          settle();
        }
        return;
      }

      playerId = user.uid;
      saveRef = ref(db, `G/${GAME_ID}/${playerId}`);
      settle();
      // Auth outlived the timeout, so boot already committed to a fresh guest
      // world whose ids (tree1, hut1, ...) would collide with a restored save.
      // Autosaving here would overwrite the real save, so ask for a reload instead.
      if (sources && !autosaveTimer) onStatus("reload");
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
  // Anything left at its restore-side default is omitted, so a full-health
  // unrotated build stores nothing but its coordinates.
  const r = {};
  for (const [internal, short] of Object.entries(RESOURCE_KEY_MAP)) {
    const amount = Math.round(gameState.resources[internal] || 0);
    if (amount > 0) r[short] = amount;
  }

  const b = {};
  placedObjects.forEach((obj) => {
    if (!obj.key) return;
    const node = { c: `${obj.rootX},${obj.rootZ}` };
    if (obj.root) {
      const quadrant = ((Math.round(obj.root.rotation.y / (Math.PI / 2)) % 4) + 4) % 4;
      if (quadrant) node.r = quadrant;
    }
    if (obj.type === "tree" || obj.type === "stone") {
      const health = obj.health ?? 3;
      if (health < 3) node.hl = health;
    }
    b[obj.key] = node;
  });

  const n = {};
  activeNPCs.forEach((npc) => {
    const node = {
      c: `${Math.floor(npc.root.position.x)},${Math.floor(npc.root.position.z)}`,
      n: npc.name
    };
    const hunger = Math.round(npc.hunger);
    const happiness = Math.round(npc.happiness);
    if (hunger < 100) node.h = hunger;
    if (happiness < 100) node.hp = happiness;
    if (npc.a && npc.a !== "IDLE") node.a = npc.a;
    // Save pending action to resume work after load
    if (npc.pendingAction) node.p = npc.pendingAction;
    // Save target object id for ongoing tasks
    if (npc.targetObjId) node.t = npc.targetObjId;
    n[npc.id] = node;
  });

  // null deletes the subtree, so a cleared world does not leave stale children behind.
  return {
    r: Object.keys(r).length ? r : null,
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

// Lists other players' saved worlds for this game (read-only, public per the
// database rules). Returns [{ uid, buildingCount, npcCount }], excluding our
// own save since that one is already visible locally.
export async function listOtherWorlds() {
  if (!get || !ref || !db) return [];
  try {
    const snap = await get(ref(db, `G/${GAME_ID}`));
    if (!snap.exists()) return [];

    const out = [];
    snap.forEach((childSnap) => {
      const uid = childSnap.key;
      if (uid === playerId) return;
      const val = childSnap.val() || {};
      out.push({
        uid,
        buildingCount: val.b ? Object.keys(val.b).length : 0,
        npcCount: val.n ? Object.keys(val.n).length : 0
      });
    });
    return out;
  } catch (err) {
    console.warn("[db] Listing other worlds failed:", err);
    return [];
  }
}

// Fetches one specific player's saved world by uid (read-only).
export async function loadWorldByUid(uid) {
  if (!get || !ref || !db || !uid) return null;
  try {
    const snap = await get(ref(db, `G/${GAME_ID}/${uid}`));
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.warn("[db] Loading world for", uid, "failed:", err);
    return null;
  }
}

export function initAutosave(worldSources, statusCallback) {
  sources = worldSources;
  if (statusCallback) onStatus = statusCallback;
  startTimer();

  document.addEventListener("visibilitychange", () => { if (document.hidden) flushNow(); });
  window.addEventListener("pagehide", flushNow);
}

export { RESOURCE_KEY_BY_SHORT, BUILD_CODE, TYPE_BY_CODE };