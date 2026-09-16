import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, push, onDisconnect, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const memberSince = document.getElementById('member-since');
const userCountEl = document.getElementById('user-count');

// Presence Counters
const playstashOnlineCountEl = document.getElementById('playstash-online-count');
const worldforgeOnlineCountEl = document.getElementById('worldforge-online-count');
const onlineCountEl = document.getElementById('online-count');

const usersContainer = document.getElementById('users-container');

// Navigation Tabs
const tabGamesBtn = document.getElementById('tab-games-btn');
const tabPlayersBtn = document.getElementById('tab-players-btn');
const tabProfileBtn = document.getElementById('tab-profile-btn');

const gamesSection = document.getElementById('games-section');
const playersSection = document.getElementById('players-section');
const profileSection = document.getElementById('profile-section');
const openMyProfileBtn = document.getElementById('open-my-profile-btn');

// Profile Page Elements
const profileCardAvatar = document.getElementById('profile-card-avatar');
const profileCardName = document.getElementById('profile-card-name');
const profileCardEmail = document.getElementById('profile-card-email');
const profileCardJoinedPs = document.getElementById('profile-card-joined-ps');
const profileCardJoinedWf = document.getElementById('profile-card-joined-wf');
const profileCardStatusDot = document.getElementById('profile-card-status-dot');
const profileCardStatusText = document.getElementById('profile-card-status-text');

// Stats Elements
const profileBuildingsCount = document.getElementById('profile-buildings-count');
const profileNpcsCount = document.getElementById('profile-npcs-count');
const profileResourcesCount = document.getElementById('profile-resources-count');
const profileResourcesList = document.getElementById('profile-resources-list');

// Change Name Elements
const editUsernameCard = document.getElementById('edit-username-card');
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const usernameStatusMsg = document.getElementById('username-status-msg');

// Modal Elements
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
  wo: { name: 'Wood', icon: '🪵' },
  wood: { name: 'Wood', icon: '🪵' },
  wa: { name: 'Water', icon: '💧' },
  water: { name: 'Water', icon: '💧' },
  w: { name: 'Wheat', icon: '🌾' },
  wheat: { name: 'Wheat', icon: '🌾' },
  s: { name: 'Stone', icon: '🪨' },
  stone: { name: 'Stone', icon: '🪨' },
  f: { name: 'Food', icon: '🍲' },
  food: { name: 'Food', icon: '🍲' },
  g: { name: 'Gold', icon: '🪙' },
  gold: { name: 'Gold', icon: '🪙' },
  i: { name: 'Iron', icon: '⚙️' },
  iron: { name: 'Iron', icon: '⚙️' },
  m: { name: 'Meat', icon: '🥩' },
  meat: { name: 'Meat', icon: '🥩' },
  fi: { name: 'Fish', icon: '🐟' },
  fish: { name: 'Fish', icon: '🐟' }
};

const tooltipStyles = document.createElement('style');
tooltipStyles.textContent = `
  @keyframes popSmiley {
    0% { transform: translateY(8px) scale(0.3) rotate(-15deg); opacity: 0; }
    60% { transform: translateY(-4px) scale(1.25) rotate(10deg); opacity: 1; }
    100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes slideWhyTooltip {
    0% { transform: translateY(8px) scale(0.92); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  .smiley-pop-anim {
    animation: popSmiley 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  .why-tooltip-anim {
    animation: slideWhyTooltip 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
`;
document.head.appendChild(tooltipStyles);

function setupButtonHoverEffects() {
  if (loginBtn) {
    if (getComputedStyle(loginBtn).position === 'static') {
      loginBtn.style.position = 'relative';
    }
    
    let smileyEl = null;

    loginBtn.addEventListener('mouseenter', () => {
      if (smileyEl) smileyEl.remove();
      smileyEl = document.createElement('div');
      smileyEl.className = 'absolute -top-11 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500/20 backdrop-blur-md text-amber-300 rounded-full border border-amber-400/50 shadow-lg text-xs font-bold flex items-center justify-center pointer-events-none z-50 smiley-pop-anim whitespace-nowrap';
      smileyEl.innerHTML = 'HALO 😇';
      loginBtn.appendChild(smileyEl);
    });

    loginBtn.addEventListener('mouseleave', () => {
      if (smileyEl) {
        smileyEl.remove();
        smileyEl = null;
      }
    });
  }

  if (logoutBtn) {
    if (getComputedStyle(logoutBtn).position === 'static') {
      logoutBtn.style.position = 'relative';
    }

    let whyTooltipEl = null;

    logoutBtn.addEventListener('mouseenter', () => {
      if (whyTooltipEl) whyTooltipEl.remove();
      whyTooltipEl = document.createElement('div');
      whyTooltipEl.className = 'absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-slate-200 text-[11px] font-bold rounded-xl border border-red-500/40 shadow-2xl whitespace-nowrap pointer-events-none z-50 why-tooltip-anim flex items-center gap-1.5';
      whyTooltipEl.innerHTML = '<span class="text-red-400 font-extrabold">Why? 😭</span>';
      logoutBtn.appendChild(whyTooltipEl);
    });

    logoutBtn.addEventListener('mouseleave', () => {
      if (whyTooltipEl) {
        whyTooltipEl.remove();
        whyTooltipEl = null;
      }
    });
  }
}

setupButtonHoverEffects();

function switchTab(selected) {
  const activeClass = "px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-sky-500/20 border border-sky-400/40 transition cursor-pointer";
  const inactiveClass = "px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 border border-transparent transition cursor-pointer";

  tabGamesBtn.className = selected === 'games' ? activeClass : inactiveClass;
  tabPlayersBtn.className = selected === 'players' ? activeClass : inactiveClass;
  tabProfileBtn.className = selected === 'profile' ? activeClass : inactiveClass;

  gamesSection.classList.toggle('hidden', selected !== 'games');
  playersSection.classList.toggle('hidden', selected !== 'players');
  profileSection.classList.toggle('hidden', selected !== 'profile');
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
        <span>${name}</span>
      </span>
      <span class="font-black text-sky-400 font-mono">${data.amount}</span>
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
  const newName = usernameInput.value.trim();
  const currentUser = auth.currentUser;

  if (!currentUser) return;
  if (!newName) {
    showUsernameStatus('Name cannot be empty', false);
    return;
  }

  try {
    await updateProfile(currentUser, { displayName: newName });
    await update(ref(db, `u/${currentUser.uid}/i`), { dn: newName });

    userEmail.textContent = newName;
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
  alert("Why? 😭");
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user && !user.isAnonymous) {
    loginBtn?.classList.add('hidden');
    userProfile?.classList.remove('hidden');
    editUsernameCard?.classList.remove('hidden');

    const displayName = user.displayName || user.email || 'Player';
    const avatarUrl = safeAvatarUrl(user.photoURL);

    userEmail.textContent = displayName;
    userAvatar.src = avatarUrl;

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
    memberSince.textContent = `Joined ${formattedPsDate}`;
    if (profileCardJoinedPs) profileCardJoinedPs.textContent = `Joined PlayStash: ${formattedPsDate}`;

    let wfJoinedTime = null;
    try {
      const snap = await get(ref(db, `G/1/${user.uid}/i/jt`));
      if (snap.exists()) wfJoinedTime = snap.val();
    } catch(e) {}

    if (profileCardJoinedWf) {
      profileCardJoinedWf.textContent = `Joined WorldForge: ${wfJoinedTime ? formatDateDetailed(wfJoinedTime) : 'Not played yet'}`;
    }

    try {
      await update(ref(db, `u/${user.uid}/i`), {
        e: user.email || '',
        dn: displayName,
        pe: user.photoURL || 'favicon.png',
        jt: creationTime
      });
    } catch (err) {}

    updatePersonalProfileStats(user.uid);
  } else {
    loginBtn?.classList.remove('hidden');
    userProfile?.classList.add('hidden');
    editUsernameCard?.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';

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

// Presence tracking specifically for PlayStash Homepage
const connectedRef = ref(db, ".info/connected");
const homepagePresenceRef = ref(db, "presence/homepage");

onValue(connectedRef, (snap) => {
  if (snap.val() === true) {
    const myPresenceRef = push(homepagePresenceRef);
    onDisconnect(myPresenceRef).remove();
    set(myPresenceRef, { online: true, ts: serverTimestamp() });
  }
});

// Calculate and display online users breakdown for PlayStash, WorldForge, and total
onValue(ref(db, "presence"), (snap) => {
  const presenceData = snap.val() || {};
  
  let playstashCount = 0;
  let worldforgeCount = 0;
  let totalOnline = 0;

  if (presenceData.homepage && typeof presenceData.homepage === 'object') {
    playstashCount = Object.keys(presenceData.homepage).length;
  }

  if (presenceData.worldforge && typeof presenceData.worldforge === 'object') {
    worldforgeCount = Object.keys(presenceData.worldforge).length;
  }

  Object.values(presenceData).forEach((group) => {
    if (group && typeof group === 'object') {
      totalOnline += Object.keys(group).length;
    }
  });

  if (playstashOnlineCountEl) playstashOnlineCountEl.textContent = playstashCount;
  if (worldforgeOnlineCountEl) worldforgeOnlineCountEl.textContent = worldforgeCount;
  if (onlineCountEl) onlineCountEl.textContent = totalOnline;
});

// Sync Game Data
onValue(ref(db, 'G/1'), (snapshot) => {
  rawGamesData = snapshot.val() || {};
  renderDirectory();
  if (auth.currentUser) updatePersonalProfileStats(auth.currentUser.uid);
});

// Sync Users
onValue(ref(db, 'u'), (snapshot) => {
  rawUsersData = snapshot.val() || {};
  renderDirectory();
});

function renderDirectory() {
  if (!rawUsersData) {
    if (userCountEl) userCountEl.textContent = '0';
    usersContainer.innerHTML = '<div class="glass-box rounded-2xl p-6 text-center text-slate-400 text-xs">No registered players yet.</div>';
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