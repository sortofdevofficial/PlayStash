import { ref, set, update, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const PRESENCE_LOC = 'playstash';
const PRESENCE_HEARTBEAT_MS = 25000;
const PRESENCE_STALE_MS = 150000;

let presenceStarted = false;
let presenceArmed = false;
let presenceOffset = 0;
let presenceSessionId = null;
let presenceNodeRef = null;
let anonAttempted = false;

export let presenceWho = new Map();
let presenceWhoKey = '';

function getPresenceSessionId() {
  try {
    const existing = sessionStorage.getItem('ps_presence_sid');
    if (existing) return existing;
    const fresh = 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionStorage.setItem('ps_presence_sid', fresh);
    return fresh;
  } catch (e) {
    return 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
}

function presencePayload(auth) {
  return { online: true, loc: PRESENCE_LOC, uid: auth.currentUser ? auth.currentUser.uid : null, ts: serverTimestamp() };
}

function computePresenceCounts(val, offset, selfId) {
  const now = Date.now() + offset;
  const ps = new Set(), wf = new Set(), all = new Set();
  const who = new Map();
  for (const key in val) {
    const p = val[key];
    if (!p || p.online === false) continue;
    if (typeof p.ts === 'number' && now - p.ts > PRESENCE_STALE_MS) continue;
    const uid = p.uid || (key.startsWith('s_') ? null : key);
    const id = uid || key;
    all.add(id);
    const inWf = p.loc === 'worldforge';
    if (inWf) wf.add(id); else ps.add(id);
    if (uid && (inWf || !who.has(uid))) who.set(uid, inWf ? 'worldforge' : 'playstash');
  }
  if (ps.size === 0 && wf.size === 0) { ps.add(selfId); all.add(selfId); }
  return { ps: ps.size, wf: wf.size, total: all.size, who };
}

function setCount(el, value) {
  if (!el) return;
  const text = String(value);
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function renderPresenceCounts(c, renderDirCallback) {
  setCount(document.getElementById('playstash-online-count'), c.ps);
  setCount(document.getElementById('worldforge-online-count'), c.wf);
  setCount(document.getElementById('online-count'), c.total);
  setCount(document.getElementById('hero-online-count'), c.wf);
  setCount(document.getElementById('card-online-count'), c.wf);

  const who = c.who || new Map();
  const key = [...who].map(([u, l]) => u + ':' + l).sort().join('|');
  if (key !== presenceWhoKey) {
    presenceWhoKey = key;
    presenceWho = who;
    if (renderDirCallback) renderDirCallback();
  }
}

async function armPresence(auth, db) {
  if (!presenceNodeRef) return;
  try {
    await onDisconnect(presenceNodeRef).remove();
    await set(presenceNodeRef, presencePayload(auth));
    presenceArmed = true;
  } catch (err) {
    presenceArmed = false;
    console.warn('presence write:', err.message);
  }
}

export function startPresence(auth, db, renderDirCallback) {
  if (presenceStarted) return;
  presenceStarted = true;

  presenceSessionId = getPresenceSessionId();
  presenceNodeRef = ref(db, `presence/${presenceSessionId}`);
  renderPresenceCounts({ ps: 1, wf: 0, total: 1 }, renderDirCallback);

  onValue(ref(db, '.info/serverTimeOffset'), (snap) => { presenceOffset = Number(snap.val()) || 0; });

  onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() === true) armPresence(auth, db);
    else presenceArmed = false;
  });

  setInterval(() => {
    if (!presenceArmed) { armPresence(auth, db); return; }
    update(presenceNodeRef, presencePayload(auth)).catch(() => { presenceArmed = false; });
  }, PRESENCE_HEARTBEAT_MS);

  window.addEventListener('pageshow', (e) => { if (e.persisted) armPresence(auth, db); });
  window.addEventListener('pagehide', () => { try { set(presenceNodeRef, null); } catch (e) {} });

  onValue(ref(db, 'presence'), (snap) => {
    renderPresenceCounts(computePresenceCounts(snap.val() || {}, presenceOffset, presenceSessionId), renderDirCallback);
  }, (err) => {
    console.warn('presence read blocked:', err.message);
    renderPresenceCounts({ ps: 1, wf: 0, total: 1 }, renderDirCallback);
  });
}

export function syncPresenceIdentity(user, auth, db, renderDirCallback) {
  startPresence(auth, db, renderDirCallback);
  if (user) {
    armPresence(auth, db);
  } else if (!anonAttempted) {
    anonAttempted = true;
    signInAnonymously(auth).catch((err) => console.warn('anonymous sign-in:', err.message));
  }
}