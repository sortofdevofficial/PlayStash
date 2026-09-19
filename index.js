import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, off, onDisconnect, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const tabGamesBtn = document.getElementById('tab-games-btn');
const tabPlayersBtn = document.getElementById('tab-players-btn');
const tabProfileBtn = document.getElementById('tab-profile-btn');

const gamesSection = document.getElementById('games-section');
const playersSection = document.getElementById('players-section');
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

const resourceMap = {
  wo: { name: 'Wood', icon: '🪵' }, wood: { name: 'Wood', icon: '🪵' },
  wa: { name: 'Water', icon: '💧' }, water: { name: 'Water', icon: '💧' },
  w: { name: 'Wheat', icon: '🌾' }, wheat: { name: 'Wheat', icon: '🌾' },
  s: { name: 'Stone', icon: '🪨' }, stone: { name: 'Stone', icon: '🪨' },
  f: { name: 'Food', icon: '🍲' }, food: { name: 'Food', icon: '🍲' },
  g: { name: 'Gold', icon: '🪙' }, gold: { name: 'Gold', icon: '🪙' },
  i: { name: 'Iron', icon: '⚙️' }, iron: { name: 'Iron', icon: '⚙️' },
  m: { name: 'Meat', icon: '🥩' }, meat: { name: 'Meat', icon: '🥩' },
  fi: { name: 'Fish', icon: '🐟' }, fish: { name: 'Fish', icon: '🐟' }
};

function switchTab(selected) {
  const activeClass = "px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-sky-500/20 border border-sky-400/40 transition cursor-pointer";
  const inactiveClass = "px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 border border-transparent transition cursor-pointer";

  if (tabGamesBtn) tabGamesBtn.className = selected === 'games' ? activeClass : inactiveClass;
  if (tabPlayersBtn) tabPlayersBtn.className = selected === 'players' ? activeClass : inactiveClass;
  if (tabProfileBtn) tabProfileBtn.className = selected === 'profile' ? activeClass : inactiveClass;

  gamesSection?.classList.toggle('hidden', selected !== 'games');
  playersSection?.classList.toggle('hidden', selected !== 'players');
  profileSection?.classList.toggle('hidden', selected !== 'profile');
}

tabGamesBtn?.addEventListener('click', () => switchTab('games'));
tabPlayersBtn?.addEventListener('click', () => switchTab('players'));
tabProfileBtn?.addEventListener('click', () => switchTab('profile'));
openMyProfileBtn?.addEventListener('click', () => switchTab('profile'));

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
      const meta = resourceMap[lowerKey] || { name: key.toUpperCase(), icon: '📦' };
      
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
    itemCard.className = 'bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs';
    itemCard.innerHTML = `
      <span class="text-slate-300 font-bold flex items-center gap-2">
        <span>${data.icon}</span>
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
}

loginBtn?.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Sign In Error: " + err.message);
  }
});

logoutBtn?.addEventListener('click', async () => {
  await signOut(auth);
});

// ---------------------------------------------------------------------------
// PRESENCE  (same schema as WorldForge: presence/{tabSessionId} = {online, loc, uid, ts})
//  - one node per browser tab, so guests, multi-tab and account switching all work
//  - counts are shown to EVERYONE (guests too) and never reset on sign-out
//  - deduped by uid, staleness measured on the server clock
// ---------------------------------------------------------------------------
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
  for (const key in val) {
    const p = val[key];
    if (!p || p.online === false) continue;
    if (typeof p.ts === 'number' && now - p.ts > PRESENCE_STALE_MS) continue;
    const id = p.uid || key;
    all.add(id);
    if (p.loc === 'worldforge') wf.add(id); else ps.add(id);
  }
  if (ps.size === 0 && wf.size === 0) { ps.add(selfId); all.add(selfId); }
  return { ps: ps.size, wf: wf.size, total: all.size };
}

function renderPresenceCounts(c) {
  if (playstashOnlineCountEl) playstashOnlineCountEl.textContent = c.ps;
  if (worldforgeOnlineCountEl) worldforgeOnlineCountEl.textContent = c.wf;
  if (onlineCountEl) onlineCountEl.textContent = c.total;
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

  // Firebase forgets onDisconnect handlers when the socket drops, so re-arm on every reconnect.
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

  // Counts for everyone, guests included. Never torn down on sign-out.
  onValue(ref(db, 'presence'), (snap) => {
    renderPresenceCounts(computePresenceCounts(snap.val() || {}, presenceOffset, presenceSessionId));
  }, (err) => {
    console.warn('presence read blocked - check database rules for presence/:', err.message);
    renderPresenceCounts({ ps: 1, wf: 0, total: 1 });
  });
}

// Called on every auth change: stamp the uid on this tab's node, and give guests an
// anonymous session so they can be counted (same as WorldForge does).
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

function renderDirectory() {
  if (!usersContainer) return;
  if (!rawUsersData || Object.keys(rawUsersData).length === 0) {
    if (userCountEl) userCountEl.textContent = '0';
    usersContainer.innerHTML = '<div class="glass-box rounded-2xl p-6 text-center text-slate-400 text-xs">Sign in to view registered players.</div>';
    return;
  }

  const entries = Object.entries(rawUsersData)
    .filter(([uid, u]) => u && u.i)
    .map(([uid, u]) => ({ uid, ...u.i }))
    .sort((a, b) => (b.jt || 0) - (a.jt || 0));

  if (userCountEl) userCountEl.textContent = entries.length;

  usersContainer.replaceChildren(...entries.map(u => {
    const gameSave = rawGamesData[u.uid] || {};
    const res = gameSave.r || {};
    
    const wood = Number(res.wo || res.wood || 0);
    const water = Number(res.wa || res.water || 0);
    const wheat = Number(res.w || res.wheat || 0);
    const stone = Number(res.s || res.stone || 0);

    const wfJoinedDate = gameSave.i && gameSave.i.jt ? formatDateDetailed(gameSave.i.jt) : 'Not played yet';

    const card = document.createElement('div');
    card.className = 'card-box rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-sky-500/50 cursor-pointer transition duration-300';
    card.addEventListener('click', () => openUserModal(u, u.uid));

    const left = document.createElement('div');
    left.className = 'flex items-center gap-3.5 min-w-0';

    const img = document.createElement('img');
    img.src = safeAvatarUrl(u.pe);
    img.className = 'w-11 h-11 rounded-full border border-sky-400/50 object-cover shrink-0 shadow-md';
    img.alt = 'Profile';

    const details = document.createElement('div');
    details.className = 'flex flex-col min-w-0';

    const name = document.createElement('span');
    name.className = 'font-bold text-xs text-white truncate';
    name.textContent = u.dn || 'Player';

    const psJoined = document.createElement('span');
    psJoined.className = 'text-[10px] text-sky-400 font-medium truncate mt-0.5';
    psJoined.textContent = `Joined PlayStash: ${formatDateDetailed(u.jt)}`;

    const wfJoined = document.createElement('span');
    wfJoined.className = 'text-[10px] text-emerald-400 font-medium truncate';
    wfJoined.textContent = `Joined WorldForge: ${wfJoinedDate}`;

    details.append(name, psJoined, wfJoined);
    left.append(img, details);

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2 shrink-0 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-300 font-mono flex-wrap justify-end';
    right.innerHTML = `
      <span>🪵 ${wood}</span>
      <span>💧 ${water}</span>
      <span>🌾 ${wheat}</span>
      <span>🪨 ${stone}</span>
    `;

    card.append(left, right);
    return card;
  }));
}