export const GAME_ID = 1;

export const RESOURCE_KEY_MAP = { wh: "wo", food: "w", stone: "s", water: "wa" };

const RESOURCE_KEY_BY_SHORT = Object.fromEntries(
  Object.entries(RESOURCE_KEY_MAP).map(([internal, short]) => [short, internal])
);

const BUILD_CODE = {
  tree: "t", stone: "s", hut: "h", campfire: "c", farm: "f", market: "m", gate: "g",
  tower: "tw", well: "w", wall: "wl", storage: "st"
};

const TYPE_BY_CODE = Object.fromEntries(
  Object.entries(BUILD_CODE).map(([type, code]) => [code, type])
);

const SAVE_INTERVAL_MS = 120000;
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
let onDisconnect = null;
let onAuthStateChanged = null;
let signInAnonymously = null;
let GoogleAuthProvider = null;
let signInWithPopup = null;
let signOut = null;
let db = null;
let auth = null;

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
  GoogleAuthProvider = authMod.GoogleAuthProvider;
  signInWithPopup = authMod.signInWithPopup;
  signOut = authMod.signOut;
  ref = dbMod.ref;
  get = dbMod.get;
  update = dbMod.update;
  onDisconnect = dbMod.onDisconnect;
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

export function getCurrentUser() {
  return auth ? auth.currentUser : null;
}

export async function ensureJoinTime(uid) {
  if (!uid || !db || !ref || !get || !update) return;
  try {
    const infoRef = ref(db, `G/${GAME_ID}/${uid}/i`);
    const snap = await get(infoRef);
    if (!snap.exists() || !snap.val()?.jt) {
      await update(infoRef, { jt: Date.now() });
    }
  } catch (err) {
    console.warn("[db] Setting join time failed:", err);
  }
}

export async function signInWithGoogle() {
  if (!auth || !GoogleAuthProvider || !signInWithPopup) return null;
  const provider = new GoogleAuthProvider();
  try {
    const res = await signInWithPopup(auth, provider);
    if (res.user) {
      await ensureJoinTime(res.user.uid);
    }
    return res.user;
  } catch (err) {
    console.warn("[db] Google sign-in failed:", err);
    throw err;
  }
}

export async function signOutUser() {
  if (!auth || !signOut) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("[db] Sign-out failed:", err);
    throw err;
  }
}

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
    const timer = setTimeout(settle, AUTH_TIMEOUT_MS);

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
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
      await ensureJoinTime(playerId);
      settle();
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
    const health = Math.round(npc.health);
    if (hunger < 100) node.h = hunger;
    if (happiness < 100) node.hp = happiness;
    if (Number.isFinite(health) && health < 100) node.health = health;
    n[npc.id] = node;
  });

  return {
    ts: Date.now(),
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
    registerDisconnectSave();
  } catch (err) {
    console.warn("[db] Save failed:", err);
    dirty = true;
    onStatus("error");
  }
}

function registerDisconnectSave() {
  if (!onDisconnect || !saveRef || !sources) return;
  try {
    onDisconnect(saveRef).update(serializeWorld(sources.placedObjects, sources.activeNPCs, sources.state));
  } catch (err) {
    console.warn("[db] Registering disconnect save failed:", err);
  }
}

function startTimer() {
  if (autosaveTimer || !saveRef) return;
  autosaveTimer = setInterval(() => {
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

export async function listOtherWorlds() {
  if (!get || !ref || !db) return [];
  try {
    const [worldsSnap, usersSnap] = await Promise.all([
      get(ref(db, `G/${GAME_ID}`)),
      get(ref(db, "u"))
    ]);
    if (!worldsSnap.exists()) return [];

    const usersData = usersSnap.exists() ? usersSnap.val() : {};

    const out = [];
    worldsSnap.forEach((childSnap) => {
      const uid = childSnap.key;
      if (uid === playerId) return;
      const val = childSnap.val() || {};
      out.push({
        uid,
        name: usersData[uid]?.i?.dn || null,
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
  registerDisconnectSave();

  document.addEventListener("visibilitychange", () => { if (document.hidden) flushNow(); });
  window.addEventListener("pagehide", flushNow);
}

export { RESOURCE_KEY_BY_SHORT, BUILD_CODE, TYPE_BY_CODE };