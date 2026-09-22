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
  success: '<svg class="w-4 h-4 fill-emerald-400 shrink-0" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.6-4.2-4.2 1.4-1.4 2.8 2.8 5.8-5.8 1.4 1.4-7.2 7.2Z"/></svg>',
  error: '<svg class="w-4 h-4 fill-red-400 shrink-0" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z"/></svg>',
  info: '<svg class="w-4 h-4 fill-sky-400 shrink-0" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>'
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
    toast('Welcome back to PlayStash 👋', 'info', { label: 'Play WorldForge', href: 'game/worldforge/index.html' });
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

// Shared inline-SVG icon set — used in place of emoji everywhere on the site.
const ICON_SVG = {
  wood: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M3 12c0-3 2.5-5 5.5-5S14 9 14 12s-2.5 5-5.5 5S3 15 3 12Zm2 0a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Zm9-7h7v2h-7V5Zm0 5.5h7v2h-7v-2Zm0 5.5h7v2h-7v-2Z"/></svg>',
  water: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M12 2c3.5 4.5 7 8.8 7 12.5A7 7 0 0 1 5 14.5C5 10.8 8.5 6.5 12 2Zm0 3.4C9.7 8.4 7 11.7 7 14.5a5 5 0 0 0 10 0c0-2.8-2.7-6.1-5-9.1Z"/></svg>',
  wheat: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M12 2c.6 1.6.2 2.7-.7 3.7 1 .2 1.7.9 2 1.9.9-.6 2-.6 2.8.2.9.9.9 2.1.1 3 1 .1 1.8.8 2 1.8.9-.4 2-.1 2.6.7.7.9.6 2.1-.2 2.9l-1.4-1.4c.2-.2.2-.5 0-.7a.5.5 0 0 0-.7 0l-1.4-1.4a1 1 0 0 0-1.4 0L14.3 14a1 1 0 0 0 0 1.4l-1.4 1.4a1 1 0 0 0 0 1.4L11.5 20a1 1 0 0 1-1.4 0l-1.4-1.4a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 0l1.4-1.4a1 1 0 0 1 0-1.4L11.5 12a1 1 0 0 1 0-1.4l1.4-1.4a.5.5 0 0 0 0-.7.5.5 0 0 0-.7 0C11.4 9.3 10.7 9 10 9c-1 0-1.8.6-2.1 1.5-.9-.2-1.8.2-2.3 1-.6.9-.4 2.1.4 2.8-.9.3-1.5 1.1-1.5 2.1 0 1.2 1 2.2 2.2 2.2.3 0 .6-.1.9-.2C7.9 19.5 9 20 10.2 20c.5 0 1-.1 1.4-.3.5.8 1.4 1.3 2.4 1.3 1.5 0 2.8-1.2 2.8-2.8 0-.2 0-.4-.1-.6.9-.3 1.6-1.1 1.6-2.1 0-1-.6-1.8-1.5-2.1.6-.8.6-1.9-.1-2.7C16 10 15 9.8 14.2 10.2 14 9.2 13.1 8.5 12 8.5c.9-1 .8-2.5-.3-3.4C12.5 4.2 12.4 3 12 2Z"/></svg>',
  stone: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M6 18c-2 0-4-1.6-4-4 0-1.9 1.3-3.4 3.1-3.9C5.6 8 7.6 6 10 6c1.4 0 2.7.6 3.6 1.6.4-.1.8-.2 1.2-.2 2.3 0 4.2 1.9 4.2 4.2 0 .3 0 .5-.1.8C20.7 12.8 22 14.3 22 16c0 2-1.8 3.6-4 3.6H6Z"/></svg>',
  food: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M4 11a8 8 0 0 1 16 0v1H4v-1Zm-1 3h18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1Zm7-11h2v3h-2V3Zm-4 1 1.5 2.6L6 8 4.5 5.4 6 4Zm10 0 1.5 1.4L16 8l-1.5-2.4L16 4Z"/></svg>',
  gold: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15ZM11 7h2v1.2c1.2.3 2 1.2 2 2.4h-1.6c0-.5-.5-.9-1.4-.9s-1.4.4-1.4.8c0 .5.5.7 1.6 1 1.5.4 2.8.9 2.8 2.6 0 1.3-.9 2.2-2 2.5V18h-2v-1.2c-1.2-.3-2.1-1.2-2.1-2.5H10c0 .6.6 1 1.5 1s1.5-.4 1.5-.9c0-.5-.6-.7-1.7-1-1.5-.4-2.7-.9-2.7-2.5 0-1.2.9-2.1 2-2.4V7Z"/></svg>',
  iron: '<svg viewBox="0 0 24 24" class="fill-current"><path d="m12 1 1.5 2.6L16 2l.6 3 3-.6L18 7.5 21 9l-2.6 1.5L21 13l-3-.6.6 3-3-1.4L14.9 17 13 15l-1 2.9L10 15l-1.9 2-.6-3-3 1.4.6-3L2 13l2.6-2.5L2 9l3-1.5L4.4 4.4l3 .6L8 2l2.5 1.6L12 1Zm0 6.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>',
  meat: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M16.5 3c-2.5 0-5.5 2-6.5 5-1 3-1 4.5-3 5.5A3.5 3.5 0 0 0 3 17a3.5 3.5 0 0 0 3.5 3.5 3.5 3.5 0 0 0 3.4-2.7c1-2 2.5-2.1 5.5-3.1 3-1 5-4 5-6.5C20.4 5.2 18.8 3 16.5 3ZM6.5 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/></svg>',
  fish: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M2 12s3.5-5 9-5c4 0 6.4 2.3 7.7 4-.2-1.6-.9-3-1.9-4.3l1.5-.9c1.5 1.9 2.4 4.1 2.6 6.4a12 12 0 0 1-2.6 6.4l-1.5-.9c1-1.3 1.7-2.7 1.9-4.3-1.3 1.7-3.7 4-7.7 4-5.5 0-9-5-9-5s1.6-2.3 4-3.7C4.9 10 3.2 11 2 12Zm14.5-.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>',
  box: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M12 2 3 6.5V17.5L12 22l9-4.5V6.5L12 2Zm0 2.24 6.3 3.15L12 10.56 5.7 7.39 12 4.24ZM5 8.85l6 3v7.3l-6-3v-7.3Zm8 10.3v-7.3l6-3v7.3l-6 3Z"/></svg>',
  house: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M4 21V9l8-5 8 5v12h-6v-6h-4v6H4Z"/></svg>',
  person: '<svg viewBox="0 0 24 24" class="fill-current"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2.5c-3.34 0-10 1.68-10 5V22h20v-2.5c0-3.32-6.66-5-10-5Z"/></svg>'
};

function iconSpan(key, extraClass = '') {
  return `<span class="inline-flex items-center justify-center shrink-0 ${extraClass}">${ICON_SVG[key] || ICON_SVG.box}</span>`;
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
        ${iconSpan(data.icon, 'w-4 h-4 text-sky-400')}
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

    startAuthDatabaseListeners();

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
    stopAuthDatabaseListeners();

    loginBtn?.classList.remove('hidden');
    profileSigninBtn?.classList.remove('hidden');
    userProfile?.classList.add('hidden');
    editUsernameCard?.classList.add('hidden');
    if (userEmail) userEmail.textContent = '';
    if (userAvatar) userAvatar.src = '';
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
      <span class="flex items-center gap-1.5">${iconSpan('box', 'w-3 h-3 text-emerald-400')}<span>${totalItems} items total</span></span>
    `;

    card.append(top, chips, footer);
    return card;
  }));
}

playerSearchEl?.addEventListener('input', () => renderDirectory());
playerSortEl?.addEventListener('change', () => renderDirectory());