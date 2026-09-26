import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, off, onDisconnect, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { initDiscordWidget } from "./discord.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWBT35QNUywT-_RgeqeZXv44Z9frUYZMU",
  authDomain: "playstash0.firebaseapp.com",
  projectId: "playstash0",
  storageBucket: "playstash0.firebasestorage.app",
  messagingSenderId: "1015051983836",
  appId: "1:1015051983836:web:3c89a152ce8c476852cd19",
  databaseURL: "https://playstash0-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// Initialize Discord widget live updates
initDiscordWidget();

// Anti-Inspect & Security
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', (e) => {
  if (
    e.key === 'F12' || 
    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
    (e.ctrlKey && e.key === 'U') ||
    (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'J' || e.key === 'U'))
  ) {
    e.preventDefault();
  }
});

function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str || '';
  return temp.innerHTML;
}

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const memberSince = document.getElementById('member-since');
const userCountEl = document.getElementById('user-count');

const playstashOnlineCountEl = document.getElementById('playstash-online-count');
const worldforgeOnlineCountEl = document.getElementById('worldforge-online-count');
const onlineCountEl = document.getElementById('online-count');

const usersContainer = document.getElementById('users-container');

const heroOnlineCountEl = document.getElementById('hero-online-count');
const cardOnlineCountEl = document.getElementById('card-online-count');
const heroPlayersBtn = document.getElementById('hero-players-btn');
const profileSigninBtn = document.getElementById('profile-signin-btn');
const playerSearchEl = document.getElementById('player-search');
const playerSortEl = document.getElementById('player-sort');
const playerResultCountEl = document.getElementById('player-result-count');

const TOAST_ICON = {
  success: '<svg class="w-4 h-4 shrink-0" aria-hidden="true"><use href="#ic-check"></use></svg>',
  error: '<svg class="w-4 h-4 shrink-0" aria-hidden="true"><use href="#ic-alert"></use></svg>',
  info: '<svg class="w-4 h-4 shrink-0" aria-hidden="true"><use href="#ic-info"></use></svg>'
};

function toast(msg, type = 'info', action = null) {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = document.createElement('span');
  icon.className = 'flex items-center';
  icon.innerHTML = TOAST_ICON[type] || TOAST_ICON.info;
  const text = document.createElement('span');
  text.className = 'flex-1';
  text.textContent = msg;
  el.append(icon, text);
  if (action && action.href) {
    const link = document.createElement('a');
    link.href = action.href;
    link.textContent = action.label || 'Open';
    link.className = 'shrink-0 px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-black uppercase tracking-wider transition';
    el.appendChild(link);
  }
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, action ? 9000 : 3500);
}

// WELCOME BACK
(function initWelcomeBack() {
  const CLICK_WINDOW_MS = 2000;
  const MIN_AWAY_MS = 3000;
  const MAX_AWAY_MS = 30 * 60 * 1000;
  const COOLDOWN_MS = 10 * 60 * 1000;
  const K_TRIP = 'ps_adtrip';
  const K_SHOWN = 'ps_welcome_shown';
  let lastClick = 0;

  const store = {
    get(k) { try { return Number(sessionStorage.getItem(k) || 0); } catch (e) { return 0; } },
    set(k, v) { try { sessionStorage.setItem(k, String(v)); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };

  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const own = el && el.closest('a[href], #login-btn, #profile-signin-btn, #logout-btn');
    lastClick = own ? 0 : Date.now();
  }, true);

  function markTrip() {
    if (lastClick && Date.now() - lastClick <= CLICK_WINDOW_MS) store.set(K_TRIP, Date.now());
  }

  function maybeWelcome() {
    const left = store.get(K_TRIP);
    if (!left) return;
    store.del(K_TRIP);
    const away = Date.now() - left;
    if (away < MIN_AWAY_MS || away > MAX_AWAY_MS) return;
    if (Date.now() - store.get(K_SHOWN) < COOLDOWN_MS) return;
    store.set(K_SHOWN, Date.now());
    toast('Welcome back to PlayStash', 'info', { label: 'Play WorldForge', href: 'game/worldforge/index.html' });
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) markTrip(); else maybeWelcome(); });
  window.addEventListener('pagehide', markTrip);
  window.addEventListener('pageshow', maybeWelcome);
  maybeWelcome();
})();

const tabGamesBtn = document.getElementById('tab-games-btn');
const tabPlayersBtn = document.getElementById('tab-players-btn');
const tabProfileBtn = document.getElementById('tab-profile-btn');
const tabDiscordBtn = document.getElementById('tab-discord-btn');

const gamesSection = document.getElementById('games-section');
const playersSection = document.getElementById('players-section');
const profileSection = document.getElementById('profile-section');
const discordSection = document.getElementById('discord-section');
const openMyProfileBtn = document.getElementById('open-my-profile-btn');

const profileCardAvatar = document.getElementById('profile-card-avatar');
const profileCardName = document.getElementById('profile-card-name');
const profileCardEmail = document.getElementById('profile-card-email');
const profileCardJoinedPs = document.getElementById('profile-card-joined-ps');
const profileCardJoinedWf = document.getElementById('profile-card-joined-wf');
const profileCardStatusDot = document.getElementById('profile-card-status-dot');
const profileCardStatusText = document.getElementById('profile-card-status-text');

const profileBuildingsCount = document.getElementById('profile-buildings-count');
const profileNpcsCount = document.getElementById('profile-npcs-count');
const profileResourcesCount = document.getElementById('profile-resources-count');
const profileResourcesList = document.getElementById('profile-resources-list');

const editUsernameCard = document.getElementById('edit-username-card');
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const usernameStatusMsg = document.getElementById('username-status-msg');

const profileModal = document.getElementById('profile-modal');
const modalAvatar = document.getElementById('modal-avatar');
const modalName = document.getElementById('modal-name');
const modalEmail = document.getElementById('modal-email');
const modalJoinedPs = document.getElementById('modal-joined-ps');
const modalJoinedWf = document.getElementById('modal-joined-wf');
const modalBuildings = document.getElementById('modal-buildings');
const modalNpcs = document.getElementById('modal-npcs');
const modalResources = document.getElementById('modal-resources');
const modalResourcesList = document.getElementById('modal-resources-list');
const closeModalBtn = document.getElementById('close-modal-btn');
const closeModalBottomBtn = document.getElementById('close-modal-bottom-btn');

let rawUsersData = {};
let rawGamesData = {};

// Icons are <use> references into the low-poly sprite in index.html — the same
// sheet WorldForge's HUD uses, so a wood log looks identical on either page.
const ICON_IDS = {
  wood: 'ic-wood',
  water: 'ic-water',
  wheat: 'ic-food',
  food: 'ic-food',
  stone: 'ic-stone',
  gold: 'ic-gold',
  iron: 'ic-iron',
  meat: 'ic-meat',
  fish: 'ic-fish',
  box: 'ic-cap',
  house: 'ic-pop',
  person: 'ic-folk',
  medal: 'ic-medal-gold',
  chat: 'ic-chat'
};

function iconSpan(key, extraClass = '') {
  const id = ICON_IDS[key] || ICON_IDS.box;
  return `<span class="inline-flex items-center justify-center shrink-0 ${extraClass}"><svg class="w-full h-full" aria-hidden="true"><use href="#${id}"></use></svg></span>`;
}

const resourceMap = {
  wo: { name: 'Wood', icon: 'wood' }, wood: { name: 'Wood', icon: 'wood' },
  wa: { name: 'Water', icon: 'water' }, water: { name: 'Water', icon: 'water' },
  w: { name: 'Wheat', icon: 'wheat' }, wheat: { name: 'Wheat', icon: 'wheat' },
  s: { name: 'Stone', icon: 'stone' }, stone: { name: 'Stone', icon: 'stone' },
  f: { name: 'Food', icon: 'food' }, food: { name: 'Food', icon: 'food' },
  g: { name: 'Gold', icon: 'gold' }, gold: { name: 'Gold', icon: 'gold' },
  i: { name: 'Iron', icon: 'iron' }, iron: { name: 'Iron', icon: 'iron' },
  m: { name: 'Meat', icon: 'meat' }, meat: { name: 'Meat', icon: 'meat' },
  fi: { name: 'Fish', icon: 'fish' }, fish: { name: 'Fish', icon: 'fish' }
};

const TAB_BASE = 'nav-tab flex-1 sm:flex-none px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5';
const TAB_ACTIVE = TAB_BASE + ' text-white bg-sky-500/20 border border-sky-400/40';
const TAB_INACTIVE = TAB_BASE + ' text-slate-400 hover:text-slate-200 border border-transparent';
const TAB_NAMES = ['games', 'players', 'profile', 'discord'];

function switchTab(selected, { updateHash = true } = {}) {
  [[tabGamesBtn, 'games'], [tabPlayersBtn, 'players'], [tabProfileBtn, 'profile'], [tabDiscordBtn, 'discord']].forEach(([btn, name]) => {
    if (!btn) return;
    btn.className = selected === name ? TAB_ACTIVE : TAB_INACTIVE;
    btn.setAttribute('aria-selected', String(selected === name));
  });

  [[gamesSection, 'games'], [playersSection, 'players'], [profileSection, 'profile'], [discordSection, 'discord']].forEach(([el, name]) => {
    if (!el) return;
    const show = selected === name;
    el.classList.toggle('hidden', !show);
    if (show) {
      el.classList.remove('fade-in');
      void el.offsetWidth;
      el.classList.add('fade-in');
    }
  });

  if (updateHash) {
    try { history.replaceState(null, '', '#' + selected); } catch (e) {}
  }
}

tabGamesBtn?.addEventListener('click', () => switchTab('games'));
tabPlayersBtn?.addEventListener('click', () => switchTab('players'));
tabProfileBtn?.addEventListener('click', () => switchTab('profile'));
tabDiscordBtn?.addEventListener('click', () => switchTab('discord'));
openMyProfileBtn?.addEventListener('click', () => switchTab('profile'));
heroPlayersBtn?.addEventListener('click', () => { switchTab('players'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
profileSigninBtn?.addEventListener('click', () => loginBtn?.click());

const initialTab = location.hash.replace('#', '');
if (TAB_NAMES.includes(initialTab)) switchTab(initialTab, { updateHash: false });
window.addEventListener('hashchange', () => {
  const t = location.hash.replace('#', '');
  if (TAB_NAMES.includes(t)) switchTab(t, { updateHash: false });
});

// Load bot community data (giveaways/levels/voice/invites) immediately on page load,
// not lazily on tab click — it now lives inside the Discord tab. Deferred to the next
// microtask so it runs after the rest of this module (including `let` declarations
// further down the file) has finished initializing.
queueMicrotask(() => loadCommunityData());
queueMicrotask(() => loadModerationData());

function formatDateDetailed(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function safeAvatarUrl(url) {
  if (typeof url !== 'string' || !url) return 'favicon.png';
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : 'favicon.png';
  } catch {
    return 'favicon.png';
  }
}

function renderDetailedResources(resourceObj, containerElement) {
  if (!containerElement) return;
  containerElement.innerHTML = '';

  const mappedResources = {};

  if (resourceObj && typeof resourceObj === 'object') {
    Object.entries(resourceObj).forEach(([key, val]) => {
      const lowerKey = key.toLowerCase();
      const meta = resourceMap[lowerKey] || { name: key.toUpperCase(), icon: 'box' };
      
      if (!mappedResources[meta.name]) {
        mappedResources[meta.name] = { amount: 0, icon: meta.icon };
      }
      mappedResources[meta.name].amount += Number(val || 0);
    });
  }

  const entries = Object.entries(mappedResources);
  if (entries.length === 0) {
    containerElement.innerHTML = '<span class="text-xs text-slate-400">No resources collected yet</span>';
    return;
  }

  entries.forEach(([name, data]) => {
    const itemCard = document.createElement('div');
    itemCard.className = 'bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs hover:border-sky-500/40 transition';
    itemCard.innerHTML = `
      <span class="text-slate-300 font-bold flex items-center gap-2">
        ${iconSpan(data.icon, 'w-4 h-4')}
        <span>${sanitizeHTML(name)}</span>
      </span>
      <span class="font-black text-sky-400 font-mono">${Number(data.amount)}</span>
    `;
    containerElement.appendChild(itemCard);
  });
}

const closeModal = () => profileModal?.classList.add('hidden');
closeModalBtn?.addEventListener('click', closeModal);
closeModalBottomBtn?.addEventListener('click', closeModal);
profileModal?.addEventListener('click', (e) => { if (e.target === profileModal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

async function openUserModal(user, uid) {
  if (!profileModal) return;
  const gameSave = rawGamesData[uid] || {};
  const bCount = gameSave.b ? Object.keys(gameSave.b).length : 0;
  const nCount = gameSave.n ? Object.keys(gameSave.n).length : 0;
  const rSum = gameSave.r ? Object.values(gameSave.r).reduce((a, b) => a + Number(b || 0), 0) : 0;

  modalAvatar.src = safeAvatarUrl(user.pe);
  modalName.textContent = user.dn || 'Player';
  modalEmail.textContent = user.e ? user.e.replace(/(?<=.{2}).(?=.*@)/g, "*") : 'PlayStash Member';

  const playstashJoined = formatDateDetailed(user.jt);
  let worldforgeJoined = 'Not played yet';

  if (gameSave.i && gameSave.i.jt) {
    worldforgeJoined = formatDateDetailed(gameSave.i.jt);
  } else {
    try {
      const snap = await get(ref(db, `G/1/${uid}/i/jt`));
      if (snap.exists()) worldforgeJoined = formatDateDetailed(snap.val());
    } catch(e) {}
  }

  if (modalJoinedPs) modalJoinedPs.textContent = `Joined PlayStash: ${playstashJoined}`;
  if (modalJoinedWf) modalJoinedWf.textContent = `Joined WorldForge: ${worldforgeJoined}`;

  if (modalBuildings) modalBuildings.textContent = bCount;
  if (modalNpcs) modalNpcs.textContent = nCount;
  if (modalResources) modalResources.textContent = rSum;

  renderDetailedResources(gameSave.r, modalResourcesList);
  profileModal.classList.remove('hidden');
}

saveUsernameBtn?.addEventListener('click', async () => {
  const rawName = usernameInput.value.trim();
  const newName = sanitizeHTML(rawName); 
  const currentUser = auth.currentUser;

  if (!currentUser) return;
  if (!newName) {
    showUsernameStatus('Name cannot be empty', false);
    return;
  }

  try {
    await updateProfile(currentUser, { displayName: newName });
    await update(ref(db, `u/${currentUser.uid}/i`), { dn: newName });

    if (userEmail) userEmail.textContent = newName;
    if (profileCardName) profileCardName.textContent = newName;
    usernameInput.value = '';

    showUsernameStatus('Name saved successfully!', true);
  } catch (err) {
    showUsernameStatus('Could not save name.', false);
  }
});

function showUsernameStatus(msg, isSuccess) {
  if (!usernameStatusMsg) return;
  usernameStatusMsg.textContent = msg;
  usernameStatusMsg.className = `text-[11px] font-medium ${isSuccess ? 'text-emerald-400' : 'text-red-400'} block`;
  setTimeout(() => usernameStatusMsg.classList.add('hidden'), 3000);
  toast(msg, isSuccess ? 'success' : 'error');
}

loginBtn?.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err && (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request')) return;
    toast('Sign in failed: ' + (err && err.message ? err.message : 'please try again'), 'error');
  }
});

logoutBtn?.addEventListener('click', async () => {
  await signOut(auth);
});

// PRESENCE
const PRESENCE_LOC = 'playstash';
const PRESENCE_HEARTBEAT_MS = 25000;
const PRESENCE_STALE_MS = 150000;

let presenceStarted = false;
let presenceArmed = false;
let presenceOffset = 0;
let presenceSessionId = null;
let presenceNodeRef = null;
let anonAttempted = false;

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

function presencePayload() {
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

let presenceWho = new Map();
let presenceWhoKey = '';

function renderPresenceCounts(c) {
  setCount(playstashOnlineCountEl, c.ps);
  setCount(worldforgeOnlineCountEl, c.wf);
  setCount(onlineCountEl, c.total);
  setCount(heroOnlineCountEl, c.wf);
  setCount(cardOnlineCountEl, c.wf);

  const who = c.who || new Map();
  const key = [...who].map(([u, l]) => u + ':' + l).sort().join('|');
  if (key !== presenceWhoKey) {
    presenceWhoKey = key;
    presenceWho = who;
    renderDirectory();
  }
}

async function armPresence() {
  if (!presenceNodeRef) return;
  try {
    await onDisconnect(presenceNodeRef).remove();
    await set(presenceNodeRef, presencePayload());
    presenceArmed = true;
  } catch (err) {
    presenceArmed = false;
    console.warn('presence write:', err.message);
  }
}

function startPresence() {
  if (presenceStarted) return;
  presenceStarted = true;

  presenceSessionId = getPresenceSessionId();
  presenceNodeRef = ref(db, `presence/${presenceSessionId}`);
  renderPresenceCounts({ ps: 1, wf: 0, total: 1 });

  onValue(ref(db, '.info/serverTimeOffset'), (snap) => { presenceOffset = Number(snap.val()) || 0; });

  onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() === true) armPresence();
    else presenceArmed = false;
  });

  setInterval(() => {
    if (!presenceArmed) { armPresence(); return; }
    update(presenceNodeRef, presencePayload()).catch(() => { presenceArmed = false; });
  }, PRESENCE_HEARTBEAT_MS);

  window.addEventListener('pageshow', (e) => { if (e.persisted) armPresence(); });
  window.addEventListener('pagehide', () => { try { set(presenceNodeRef, null); } catch (e) {} });

  onValue(ref(db, 'presence'), (snap) => {
    renderPresenceCounts(computePresenceCounts(snap.val() || {}, presenceOffset, presenceSessionId));
  }, (err) => {
    console.warn('presence read blocked - check database rules for presence/:', err.message);
    renderPresenceCounts({ ps: 1, wf: 0, total: 1 });
  });
}

function syncPresenceIdentity(user) {
  startPresence();
  if (user) {
    armPresence();
  } else if (!anonAttempted) {
    anonAttempted = true;
    signInAnonymously(auth).catch((err) => console.warn('anonymous sign-in:', err.message));
  }
}

function startAuthDatabaseListeners() {
  // These paths require auth != null. onAuthStateChanged fires once with
  // user === null before anonymous sign-in resolves, so skip attaching
  // here until we actually have a signed-in user (anonymous or not).
  if (!auth.currentUser) return;

  onValue(ref(db, 'u'), (snapshot) => {
    rawUsersData = snapshot.val() || {};
    renderDirectory();
  }, (err) => console.warn("u listener:", err.message));

  onValue(ref(db, 'G/1'), (snapshot) => {
    rawGamesData = snapshot.val() || {};
    renderDirectory();
    if (auth.currentUser) updatePersonalProfileStats(auth.currentUser.uid);
  }, (err) => console.warn("G listener:", err.message));
}

function stopAuthDatabaseListeners() {
  off(ref(db, 'u'));
  off(ref(db, 'G/1'));
  
  rawUsersData = {};
  rawGamesData = {};
  renderDirectory();
}

onAuthStateChanged(auth, async (user) => {
  syncPresenceIdentity(user);
  // syncPresenceIdentity triggers anonymous sign-in when user is null,
  // which re-fires this callback with a real (anonymous) user — that
  // second pass is when startAuthDatabaseListeners actually attaches.
  startAuthDatabaseListeners();

  if (user && !user.isAnonymous) {
    loginBtn?.classList.add('hidden');
    profileSigninBtn?.classList.add('hidden');
    userProfile?.classList.remove('hidden');
    editUsernameCard?.classList.remove('hidden');

    const displayName = user.displayName || user.email || 'Player';
    const avatarUrl = safeAvatarUrl(user.photoURL);

    if (userEmail) userEmail.textContent = displayName;
    if (userAvatar) userAvatar.src = avatarUrl;

    if (profileCardAvatar) profileCardAvatar.src = avatarUrl;
    if (profileCardName) profileCardName.textContent = displayName;
    if (profileCardEmail) profileCardEmail.textContent = user.email || 'PlayStash Account';
    if (profileCardStatusDot) profileCardStatusDot.className = 'absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-[#030712] rounded-full';
    if (profileCardStatusText) {
      profileCardStatusText.textContent = 'ONLINE';
      profileCardStatusText.className = 'text-xs font-extrabold text-emerald-400 block';
    }

    const creationTime = user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now();
    const formattedPsDate = formatDateDetailed(creationTime);
    if (memberSince) memberSince.textContent = `Joined ${formattedPsDate}`;
    if (profileCardJoinedPs) profileCardJoinedPs.textContent = `Joined PlayStash: ${formattedPsDate}`;

    try {
      await update(ref(db, `u/${user.uid}/i`), {
        e: user.email || '',
        dn: displayName,
        pe: user.photoURL || 'favicon.png',
        jt: creationTime
      });
    } catch (err) {}

    let wfJoinedTime = null;
    try {
      const snap = await get(ref(db, `G/1/${user.uid}/i/jt`));
      if (snap.exists()) wfJoinedTime = snap.val();
    } catch(e) {}

    if (profileCardJoinedWf) {
      profileCardJoinedWf.textContent = `Joined WorldForge: ${wfJoinedTime ? formatDateDetailed(wfJoinedTime) : 'Not played yet'}`;
    }

    updatePersonalProfileStats(user.uid);
  } else {
    loginBtn?.classList.remove('hidden');
    profileSigninBtn?.classList.remove('hidden');
    userProfile?.classList.add('hidden');
    editUsernameCard?.classList.add('hidden');
    if (userEmail) userEmail.textContent = '';
    if (userAvatar) userAvatar.src = 'favicon.png';
    if (memberSince) memberSince.textContent = '';

    if (profileCardAvatar) profileCardAvatar.src = 'favicon.png';
    if (profileCardName) profileCardName.textContent = 'Guest Player';
    if (profileCardEmail) profileCardEmail.textContent = 'Sign in to view profile details';
    if (profileCardJoinedPs) profileCardJoinedPs.textContent = 'Joined PlayStash: -';
    if (profileCardJoinedWf) profileCardJoinedWf.textContent = 'Joined WorldForge: -';
    if (profileCardStatusDot) profileCardStatusDot.className = 'absolute bottom-1 right-1 w-5 h-5 bg-slate-600 border-2 border-[#030712] rounded-full';
    if (profileCardStatusText) {
      profileCardStatusText.textContent = 'OFFLINE';
      profileCardStatusText.className = 'text-xs font-extrabold text-slate-500 block';
    }
  }
});

function updatePersonalProfileStats(uid) {
  const gameSave = rawGamesData[uid] || {};
  const bCount = gameSave.b ? Object.keys(gameSave.b).length : 0;
  const nCount = gameSave.n ? Object.keys(gameSave.n).length : 0;
  const rSum = gameSave.r ? Object.values(gameSave.r).reduce((a, b) => a + Number(b || 0), 0) : 0;

  if (profileBuildingsCount) profileBuildingsCount.textContent = bCount;
  if (profileNpcsCount) profileNpcsCount.textContent = nCount;
  if (profileResourcesCount) profileResourcesCount.textContent = rSum;

  renderDetailedResources(gameSave.r, profileResourcesList);
}

function buildPlayerList() {
  return Object.entries(rawUsersData || {})
    .filter(([uid, u]) => u && u.i)
    .map(([uid, u]) => {
      const save = rawGamesData[uid] || {};
      return {
        uid, ...u.i,
        _b: save.b ? Object.keys(save.b).length : 0,
        _n: save.n ? Object.keys(save.n).length : 0,
        _online: presenceWho.get(uid) || null
      };
    });
}

function filterPlayers(list, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((p) => String(p.dn || 'Player').toLowerCase().includes(q));
}

function sortPlayers(list, mode) {
  const byNewest = (a, b) => (b.jt || 0) - (a.jt || 0);
  const cmp = {
    online: (a, b) => (Number(!!b._online) - Number(!!a._online)) || byNewest(a, b),
    newest: byNewest,
    buildings: (a, b) => (b._b - a._b) || byNewest(a, b),
    villagers: (a, b) => (b._n - a._n) || byNewest(a, b),
    name: (a, b) => String(a.dn || '').localeCompare(String(b.dn || ''), undefined, { sensitivity: 'base' })
  }[mode] || byNewest;
  return [...list].sort(cmp);
}

function emptyMessage(text, withSignIn) {
  const box = document.createElement('div');
  box.className = 'col-span-full glass-box rounded-2xl p-8 text-center text-slate-400 text-xs font-medium flex flex-col items-center gap-4';
  const p = document.createElement('span');
  p.textContent = text;
  box.appendChild(p);
  if (withSignIn) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-main text-white font-black px-6 py-3 rounded-full text-xs uppercase tracking-wider active:scale-95';
    btn.textContent = 'Sign in with Google';
    btn.addEventListener('click', () => loginBtn?.click());
    box.appendChild(btn);
  }
  return box;
}

let directoryAnimated = false;

function renderDirectory() {
  if (!usersContainer) return;

  const all = buildPlayerList();
  if (userCountEl) userCountEl.textContent = all.length;

  if (all.length === 0) {
    if (playerResultCountEl) playerResultCountEl.textContent = '0';
    usersContainer.replaceChildren(emptyMessage('Sign in to view registered players.', !auth.currentUser || auth.currentUser.isAnonymous));
    return;
  }

  const query = playerSearchEl ? playerSearchEl.value : '';
  const list = sortPlayers(filterPlayers(all, query), playerSortEl ? playerSortEl.value : 'online');
  if (playerResultCountEl) playerResultCountEl.textContent = list.length;

  if (list.length === 0) {
    usersContainer.replaceChildren(emptyMessage(`No players match "${query.trim()}".`, false));
    return;
  }

  const animate = !directoryAnimated;
  directoryAnimated = true;

  usersContainer.replaceChildren(...list.map((u) => {
    const gameSave = rawGamesData[u.uid] || {};
    const res = gameSave.r || {};

    const wood = Number(res.wo || res.wood || 0);
    const water = Number(res.wa || res.water || 0);
    const wheat = Number(res.w || res.wheat || 0);
    const stone = Number(res.s || res.stone || 0);
    const food = Number(res.f || res.food || 0);
    const gold = Number(res.g || res.gold || 0);
    const totalItems = wood + water + wheat + stone + food + gold
      + Number(res.i || res.iron || 0) + Number(res.m || res.meat || 0) + Number(res.fi || res.fish || 0);

    const wfJoinedDate = gameSave.i && gameSave.i.jt ? formatDateDetailed(gameSave.i.jt) : 'Not played yet';

    const card = document.createElement('div');
    card.className = 'card-box rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:-translate-y-0.5' + (animate ? ' fade-in' : '');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View ${u.dn || 'Player'}`);
    card.addEventListener('click', () => openUserModal(u, u.uid));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUserModal(u, u.uid); }
    });

    const top = document.createElement('div');
    top.className = 'flex items-center gap-3.5 min-w-0';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'relative shrink-0';
    const img = document.createElement('img');
    img.src = safeAvatarUrl(u.pe);
    img.className = 'w-12 h-12 rounded-full border object-cover shadow-md ' + (u._online ? 'border-emerald-400/70' : 'border-sky-400/40');
    img.alt = '';
    avatarWrap.appendChild(img);
    const dot = document.createElement('span');
    dot.className = 'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0b1220] ' + (u._online ? 'bg-emerald-400 dot-online' : 'bg-slate-600');
    avatarWrap.appendChild(dot);

    const details = document.createElement('div');
    details.className = 'flex flex-col min-w-0';

    const name = document.createElement('span');
    name.className = 'font-bold text-sm text-white truncate';
    name.textContent = u.dn || 'Player';

    const status = document.createElement('span');
    status.className = 'text-[10px] font-extrabold uppercase tracking-wider mt-0.5 ' + (u._online ? 'text-emerald-400' : 'text-slate-500');
    status.textContent = u._online ? (u._online === 'worldforge' ? 'Online · WorldForge' : 'Online · Hub') : 'Offline';

    const psJoined = document.createElement('span');
    psJoined.className = 'text-[10px] text-sky-400/90 font-medium truncate mt-0.5';
    psJoined.textContent = `Joined PlayStash: ${formatDateDetailed(u.jt)}`;

    const wfJoined = document.createElement('span');
    wfJoined.className = 'text-[10px] text-emerald-400/90 font-medium truncate';
    wfJoined.textContent = `Joined WorldForge: ${wfJoinedDate}`;

    details.append(name, status, psJoined, wfJoined);
    top.append(avatarWrap, details);

    const chips = document.createElement('div');
    chips.className = 'flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-slate-300 font-mono';
    const chipData = [
      { icon: 'house', val: u._b, color: 'text-slate-200' },
      { icon: 'person', val: u._n, color: 'text-sky-300' },
      { icon: 'wood', val: wood, color: 'text-amber-300' },
      { icon: 'water', val: water, color: 'text-sky-300' },
      { icon: 'wheat', val: wheat, color: 'text-yellow-300' },
      { icon: 'stone', val: stone, color: 'text-slate-300' }
    ];
    chipData.forEach(({ icon, val, color }) => {
      const c = document.createElement('span');
      c.className = `bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 flex items-center gap-1 ${color}`;
      c.innerHTML = `${iconSpan(icon, 'w-3 h-3')}<span>${Number(val || 0)}</span>`;
      chips.appendChild(c);
    });

    const footer = document.createElement('div');
    footer.className = 'flex items-center text-[10px] text-slate-500 pt-2 border-t border-slate-800/70';
    footer.innerHTML = `
      <span class="flex items-center gap-1.5">${iconSpan('box', 'w-3 h-3')}<span>${totalItems} items total</span></span>
    `;

    card.append(top, chips, footer);
    return card;
  }));
}

playerSearchEl?.addEventListener('input', () => renderDirectory());
playerSortEl?.addEventListener('change', () => renderDirectory());

// ============================================================
// COMMUNITY TAB — live data from the Discord bot's HTTP API
// ============================================================

const BOT_API_BASE = 'https://72wkgkq29b.apps.bot-hosting.cloud';
const BOT_API_KEY = 'sortofdev'; // Public-safe: this key is read-only on the bot's /api endpoints.

let communityLoaded = false;

function escapeHtmlJs(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDuration(sec) {
  sec = Number(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtUptime(ms) {
  const sec = Math.floor(Number(ms || 0) / 1000);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function communityAvatarImg(user, size = 'w-8 h-8') {
  const src = user.avatar || 'favicon.png';
  const name = escapeHtmlJs(user.username || 'User');
  return `<img src="${src}" class="${size} rounded-full object-cover border border-slate-700/80 shrink-0" alt="${name}" onerror="this.src='favicon.png'" />`;
}

function renderGiveawayCard(g) {
  const isDone = g.done;
  const timeLabel = isDone
    ? `Ended ${g.endedAt ? new Date(g.endedAt).toLocaleDateString() : ''}`
    : `Ends ${new Date(g.endsAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const winnersLine = isDone
    ? (g.winners && g.winners.length
        ? `<div class="flex items-center gap-1.5 flex-wrap mt-2">${g.winners.map((w) => `<span class="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full pl-1 pr-2 py-0.5 text-[10px] text-emerald-300 font-bold">${communityAvatarImg(w, 'w-4 h-4')}${escapeHtmlJs(w.username)}</span>`).join('')}</div>`
        : `<div class="text-[10px] text-slate-500 mt-2">No valid entries</div>`)
    : '';

  return `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 hover:border-amber-500/30 transition">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-black text-white truncate">${escapeHtmlJs(g.prize)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">#${g.gwId} · Hosted by ${escapeHtmlJs(g.host?.username || 'Unknown')}</div>
        </div>
        <span class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${isDone ? 'bg-slate-700/50 text-slate-400' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}">${isDone ? 'Ended' : 'Live'}</span>
      </div>
      <div class="flex items-center gap-3 mt-3 text-[10px] text-slate-400">
        <span class="flex items-center gap-1">${iconSpan('person', 'w-3 h-3')}<span>${g.entries} entered</span></span>
        <span class="flex items-center gap-1">${iconSpan('medal', 'w-3 h-3')}<span>${g.winnersCount} winner${g.winnersCount === 1 ? '' : 's'}</span></span>
        <span>${timeLabel}</span>
      </div>
      ${winnersLine}
    </div>
  `;
}

function renderLeaderboardRow({ rank, user, right, sub }) {
  const MEDALS = ['ic-medal-gold', 'ic-medal-silver', 'ic-medal-bronze'];
  const medal = rank >= 1 && rank <= 3
    ? `<svg class="w-5 h-5 inline-block align-middle" aria-hidden="true"><use href="#${MEDALS[rank - 1]}"></use></svg>`
    : `#${rank}`;
  return `
    <div class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90">
      <span class="w-7 text-center text-xs font-black text-slate-400 shrink-0">${medal}</span>
      ${communityAvatarImg(user)}
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-white truncate">${escapeHtmlJs(user.username)}</div>
        ${sub ? `<div class="text-[10px] text-slate-500 truncate">${sub}</div>` : ''}
      </div>
      <span class="shrink-0 text-xs font-black text-sky-400 font-mono">${right}</span>
    </div>
  `;
}

async function loadCommunityData() {
  if (communityLoaded) return;
  communityLoaded = true;

  const offlineEl = document.getElementById('community-offline');
  const statPing = document.getElementById('community-stat-ping');
  const statMembers = document.getElementById('community-stat-members');
  const statGiveaways = document.getElementById('community-stat-giveaways');
  const statUptime = document.getElementById('community-stat-uptime');
  const activeGwEl = document.getElementById('community-active-giveaways');
  const recentGwEl = document.getElementById('community-recent-giveaways');
  const msgLbEl = document.getElementById('community-msg-leaderboard');
  const voiceLbEl = document.getElementById('community-voice-leaderboard');
  const inviteLbEl = document.getElementById('community-invite-leaderboard');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BOT_API_BASE}/api/community`, {
      headers: { Authorization: `Bearer ${BOT_API_KEY}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    offlineEl?.classList.add('hidden');

    if (statPing) statPing.textContent = `${data.stats?.ping ?? '–'}ms`;
    if (statMembers) statMembers.textContent = data.stats?.members ?? '–';
    if (statGiveaways) statGiveaways.textContent = data.giveaways?.active?.length ?? 0;
    if (statUptime) statUptime.textContent = fmtUptime(data.stats?.uptime);

    const active = data.giveaways?.active || [];
    if (activeGwEl) {
      activeGwEl.innerHTML = active.length
        ? active.map(renderGiveawayCard).join('')
        : `<div class="col-span-full p-6 text-center text-slate-400 text-xs">No giveaways running right now.</div>`;
    }

    const recent = data.giveaways?.recent || [];
    if (recentGwEl) {
      recentGwEl.innerHTML = recent.length
        ? recent.map(renderGiveawayCard).join('')
        : `<div class="col-span-full p-6 text-center text-slate-400 text-xs">No past giveaways yet.</div>`;
    }

    const messages = data.leaderboard?.messages || [];
    if (msgLbEl) {
      msgLbEl.innerHTML = messages.length
        ? messages.map((m) => renderLeaderboardRow({ rank: m.rank, user: m.user, right: `Lv.${m.level}`, sub: `${m.messages.toLocaleString()} messages` })).join('')
        : `<div class="p-6 text-center text-slate-400 text-xs">No message activity yet.</div>`;
    }

    const voice = data.leaderboard?.voice || [];
    if (voiceLbEl) {
      voiceLbEl.innerHTML = voice.length
        ? voice.map((v) => renderLeaderboardRow({ rank: v.rank, user: v.user, right: fmtDuration(v.seconds) })).join('')
        : `<div class="p-6 text-center text-slate-400 text-xs">No voice activity yet.</div>`;
    }

    const invites = data.invites || [];
    if (inviteLbEl) {
      inviteLbEl.innerHTML = invites.length
        ? invites.map((v) => renderLeaderboardRow({ rank: v.rank, user: v.user, right: v.total, sub: `${v.regular} joined · ${v.left} left · ${v.fake} fake` })).join('')
        : `<div class="p-6 text-center text-slate-400 text-xs">No invite activity yet.</div>`;
    }
  } catch (err) {
    console.warn('Community API fetch failed:', err.message);
    offlineEl?.classList.remove('hidden');
    [activeGwEl, recentGwEl].forEach((el) => { if (el) el.innerHTML = `<div class="col-span-full p-6 text-center text-slate-500 text-xs">Unavailable</div>`; });
    [msgLbEl, voiceLbEl, inviteLbEl].forEach((el) => { if (el) el.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">Unavailable</div>`; });
    communityLoaded = false; // allow a later manual retry
  }
}

// ============================================================
// MODERATION — live tickets & warns from the moderation bot's API
// ============================================================

const MOD_API_BASE = 'https://1gkm2xh7wx.apps.bot-hosting.cloud';
const MOD_API_KEY = 'sortofdev'; // Public-safe: read-only on the mod bot's /api endpoints.

let moderationLoaded = false;

function renderTicketCard(t, isClosed) {
  const statusLabel = isClosed ? 'Closed' : (t.status === 'claimed' ? 'Claimed' : 'Open');
  const statusClass = isClosed ? 'bg-slate-700/50 text-slate-400' : (t.status === 'claimed' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-sky-500/15 text-sky-300 border border-sky-500/30');
  const timeLabel = isClosed
    ? `Closed ${new Date(t.closedAt).toLocaleDateString()}`
    : `Opened ${new Date(t.createdAt).toLocaleDateString()}`;

  return `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 hover:border-sky-500/30 transition">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-black text-white truncate">#${t.ticketId} · ${escapeHtmlJs(t.categoryLabel)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Opened by ${escapeHtmlJs(t.opener.username)}</div>
        </div>
        <span class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${statusClass}">${statusLabel}</span>
      </div>
      ${t.reason ? `<div class="text-[10px] text-slate-500 mt-2 truncate">${escapeHtmlJs(t.reason)}</div>` : ''}
      <div class="flex items-center gap-3 mt-3 text-[10px] text-slate-400 flex-wrap">
        ${t.claimedBy ? `<span class="flex items-center gap-1">${iconSpan('person', 'w-3 h-3')}<span>Claimed by ${escapeHtmlJs(t.claimedBy.username)}</span></span>` : ''}
        ${isClosed && t.closedBy ? `<span class="flex items-center gap-1">${iconSpan('person', 'w-3 h-3')}<span>Closed by ${escapeHtmlJs(t.closedBy.username)}</span></span>` : ''}
        <span class="flex items-center gap-1">${iconSpan('chat', 'w-3 h-3')}<span>${t.messageCount} messages</span></span>
        <span>${timeLabel}</span>
      </div>
      ${isClosed && t.closeReason ? `<div class="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-800/70 truncate">Close reason: ${escapeHtmlJs(t.closeReason)}</div>` : ''}
    </div>
  `;
}

function renderWarnRow(w) {
  const ts = new Date(w.at).toLocaleDateString();
  return `
    <div class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90">
      ${communityAvatarImg(w.user)}
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-white truncate">${escapeHtmlJs(w.user.username)} <span class="text-slate-500 font-normal">#${w.id}</span></div>
        <div class="text-[10px] text-slate-500 truncate">${escapeHtmlJs(w.reason)} · by ${escapeHtmlJs(w.moderator.username)} · ${ts}</div>
      </div>
      <span class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${w.active ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-slate-700/50 text-slate-400'}">${w.active ? 'Active' : 'Removed'}</span>
    </div>
  `;
}

async function loadModerationData() {
  if (moderationLoaded) return;
  moderationLoaded = true;

  const offlineEl = document.getElementById('moderation-offline');
  const statOpen = document.getElementById('moderation-stat-open');
  const statClosed = document.getElementById('moderation-stat-closed');
  const statWarns = document.getElementById('moderation-stat-warns');
  const statPing = document.getElementById('moderation-stat-ping');
  const openEl = document.getElementById('moderation-open-tickets');
  const closedEl = document.getElementById('moderation-closed-tickets');
  const warnsEl = document.getElementById('moderation-warns');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${MOD_API_BASE}/api/moderation`, {
      headers: { Authorization: `Bearer ${MOD_API_KEY}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    offlineEl?.classList.add('hidden');

    if (statOpen) statOpen.textContent = data.stats?.openTicketCount ?? 0;
    if (statClosed) statClosed.textContent = data.tickets?.closed?.length ?? 0;
    if (statWarns) statWarns.textContent = data.stats?.activeWarnCount ?? 0;
    if (statPing) statPing.textContent = `${data.stats?.ping ?? '–'}ms`;

    const open = data.tickets?.open || [];
    if (openEl) {
      openEl.innerHTML = open.length
        ? open.map((t) => renderTicketCard(t, false)).join('')
        : `<div class="col-span-full p-6 text-center text-slate-400 text-xs">No open tickets right now.</div>`;
    }

    const closed = data.tickets?.closed || [];
    if (closedEl) {
      closedEl.innerHTML = closed.length
        ? closed.map((t) => renderTicketCard(t, true)).join('')
        : `<div class="col-span-full p-6 text-center text-slate-400 text-xs">No closed tickets yet.</div>`;
    }

    const warnList = data.warns || [];
    if (warnsEl) {
      warnsEl.innerHTML = warnList.length
        ? warnList.map(renderWarnRow).join('')
        : `<div class="p-6 text-center text-slate-400 text-xs">No warns on record.</div>`;
    }
  } catch (err) {
    console.warn('Moderation API fetch failed:', err.message);
    offlineEl?.classList.remove('hidden');
    [openEl, closedEl].forEach((el) => { if (el) el.innerHTML = `<div class="col-span-full p-6 text-center text-slate-500 text-xs">Unavailable</div>`; });
    if (warnsEl) warnsEl.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">Unavailable</div>`;
    moderationLoaded = false;
  }
}