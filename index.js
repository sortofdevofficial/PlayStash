import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, update, onValue, off, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { initDiscordWidget } from "./discord.js";
import { syncPresenceIdentity } from "./presence.js";
import { renderDirectory, sanitizeHTML, formatDateDetailed, safeAvatarUrl, renderDetailedResources } from "./directory.js";

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

// Anti-Inspect Security
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

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const memberSince = document.getElementById('member-since');

const heroPlayersBtn = document.getElementById('hero-players-btn');
const profileSigninBtn = document.getElementById('profile-signin-btn');
const playerSearchEl = document.getElementById('player-search');
const playerSortEl = document.getElementById('player-sort');
const statCardDiscord = document.getElementById('stat-card-discord');

const tabGamesBtn = document.getElementById('tab-games-btn');
const tabPlayersBtn = document.getElementById('tab-players-btn');
const tabDiscordBtn = document.getElementById('tab-discord-btn');
const tabProfileBtn = document.getElementById('tab-profile-btn');

const gamesSection = document.getElementById('games-section');
const playersSection = document.getElementById('players-section');
const discordSection = document.getElementById('discord-section');
const profileSection = document.getElementById('profile-section');
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
const closeModalBtn = document.getElementById('close-modal-btn');
const closeModalBottomBtn = document.getElementById('close-modal-bottom-btn');

let rawUsersData = {};
let rawGamesData = {};

function toast(msg, type = 'info', action = null) {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = document.createElement('span');
  icon.textContent = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
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

// WELCOME BACK BANNER
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
  window.addEventListener('pageshow', maybeWelcome);
})();

// TAB CATEGORY SYSTEM
const TAB_BASE = 'nav-tab flex-1 sm:flex-none px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer';
const TAB_ACTIVE = TAB_BASE + ' text-white bg-sky-500/20 border border-sky-400/40';
const TAB_INACTIVE = TAB_BASE + ' text-slate-400 hover:text-slate-200 border border-transparent';
const TAB_NAMES = ['games', 'players', 'discord', 'profile'];

function switchTab(selected, { updateHash = true } = {}) {
  [
    [tabGamesBtn, 'games'], 
    [tabPlayersBtn, 'players'], 
    [tabDiscordBtn, 'discord'], 
    [tabProfileBtn, 'profile']
  ].forEach(([btn, name]) => {
    if (!btn) return;
    btn.className = selected === name ? TAB_ACTIVE : TAB_INACTIVE;
    btn.setAttribute('aria-selected', String(selected === name));
  });

  [
    [gamesSection, 'games'], 
    [playersSection, 'players'], 
    [discordSection, 'discord'], 
    [profileSection, 'profile']
  ].forEach(([el, name]) => {
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
tabDiscordBtn?.addEventListener('click', () => switchTab('discord'));
tabProfileBtn?.addEventListener('click', () => switchTab('profile'));

openMyProfileBtn?.addEventListener('click', () => switchTab('profile'));
statCardDiscord?.addEventListener('click', () => switchTab('discord'));
heroPlayersBtn?.addEventListener('click', () => { switchTab('players'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
profileSigninBtn?.addEventListener('click', () => loginBtn?.click());

const initialTab = location.hash.replace('#', '');
if (TAB_NAMES.includes(initialTab)) switchTab(initialTab, { updateHash: false });
window.addEventListener('hashchange', () => {
  const t = location.hash.replace('#', '');
  if (TAB_NAMES.includes(t)) switchTab(t, { updateHash: false });
});

// MODAL CLOSE CONTROLS
const closeModal = () => profileModal?.classList.add('hidden');
closeModalBtn?.addEventListener('click', closeModal);
closeModalBottomBtn?.addEventListener('click', closeModal);
profileModal?.addEventListener('click', (e) => { if (e.target === profileModal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// EDIT USERNAME
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

// AUTH HANDLERS
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

function triggerDirectoryRender() {
  renderDirectory(rawUsersData, rawGamesData, auth, db);
}

function startAuthDatabaseListeners() {
  onValue(ref(db, 'u'), (snapshot) => {
    rawUsersData = snapshot.val() || {};
    triggerDirectoryRender();
  }, (err) => console.warn("u listener:", err.message));

  onValue(ref(db, 'G/1'), (snapshot) => {
    rawGamesData = snapshot.val() || {};
    triggerDirectoryRender();
    if (auth.currentUser) updatePersonalProfileStats(auth.currentUser.uid);
  }, (err) => console.warn("G listener:", err.message));
}

function stopAuthDatabaseListeners() {
  off(ref(db, 'u'));
  off(ref(db, 'G/1'));
  
  rawUsersData = {};
  rawGamesData = {};
  triggerDirectoryRender();
}

onAuthStateChanged(auth, async (user) => {
  syncPresenceIdentity(user, auth, db, triggerDirectoryRender);

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

// SEARCH / SORT LISTENERS
playerSearchEl?.addEventListener('input', () => triggerDirectoryRender());
playerSortEl?.addEventListener('change', () => triggerDirectoryRender());