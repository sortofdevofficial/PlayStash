import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, push, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const profileCardJoined = document.getElementById('profile-card-joined');
const profileCardStatusDot = document.getElementById('profile-card-status-dot');
const profileCardStatusText = document.getElementById('profile-card-status-text');

// Stats Elements
const profileBuildingsCount = document.getElementById('profile-buildings-count');
const profileNpcsCount = document.getElementById('profile-npcs-count');
const profileResourcesCount = document.getElementById('profile-resources-count');

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
const modalJoined = document.getElementById('modal-joined');
const modalBuildings = document.getElementById('modal-buildings');
const modalNpcs = document.getElementById('modal-npcs');
const modalResources = document.getElementById('modal-resources');
const closeModalBtn = document.getElementById('close-modal-btn');
const closeModalBottomBtn = document.getElementById('close-modal-bottom-btn');

let rawUsersData = {};
let rawGamesData = {};

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
  return new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

const closeModal = () => profileModal?.classList.add('hidden');
closeModalBtn?.addEventListener('click', closeModal);
closeModalBottomBtn?.addEventListener('click', closeModal);

function openUserModal(user, uid) {
  if (!profileModal) return;
  const gameSave = rawGamesData[uid] || {};
  const bCount = gameSave.b ? Object.keys(gameSave.b).length : 0;
  const nCount = gameSave.n ? Object.keys(gameSave.n).length : 0;
  const rSum = gameSave.r ? Object.values(gameSave.r).reduce((a, b) => a + Number(b || 0), 0) : 0;

  modalAvatar.src = safeAvatarUrl(user.pe);
  modalName.textContent = user.dn || 'Player';
  modalEmail.textContent = user.e ? user.e.replace(/(?<=.{2}).(?=.*@)/g, "*") : 'PlayStash Member';
  modalJoined.textContent = `Joined: ${formatDateDetailed(user.jt)}`;

  if (modalBuildings) modalBuildings.textContent = bCount;
  if (modalNpcs) modalNpcs.textContent = nCount;
  if (modalResources) modalResources.textContent = rSum;

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

    showUsernameStatus('Name updated successfully!', true);
  } catch (err) {
    showUsernameStatus('Failed to update name.', false);
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

logoutBtn?.addEventListener('click', () => signOut(auth));

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
    const formattedDate = formatDateDetailed(creationTime);
    memberSince.textContent = `Joined ${formattedDate}`;
    if (profileCardJoined) profileCardJoined.textContent = `Joined: ${formattedDate}`;

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
    if (profileCardJoined) profileCardJoined.textContent = 'Status: Offline';
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
}

const connectedRef = ref(db, ".info/connected");
const presenceRef = ref(db, "presence");

onValue(connectedRef, (snap) => {
  if (snap.val() === true) {
    const myPresenceRef = push(presenceRef);
    onDisconnect(myPresenceRef).remove();
    set(myPresenceRef, { online: true, ts: serverTimestamp() });
  }
});

onValue(presenceRef, (snap) => {
  const onlineData = snap.val();
  const onlineTotal = onlineData ? Object.keys(onlineData).length : 0;
  if (onlineCountEl) onlineCountEl.textContent = onlineTotal;
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
    usersContainer.innerHTML = '<div class="console-glass rounded-2xl p-6 text-center text-slate-400 text-xs">No registered players yet.</div>';
    return;
  }

  const entries = Object.entries(rawUsersData)
    .filter(([uid, u]) => u && u.i)
    .map(([uid, u]) => ({ uid, ...u.i }))
    .sort((a, b) => (b.jt || 0) - (a.jt || 0));

  if (userCountEl) userCountEl.textContent = entries.length;

  usersContainer.replaceChildren(...entries.map(u => {
    const gameSave = rawGamesData[u.uid] || {};
    const bCount = gameSave.b ? Object.keys(gameSave.b).length : 0;
    const nCount = gameSave.n ? Object.keys(gameSave.n).length : 0;

    const card = document.createElement('div');
    card.className = 'console-card rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-sky-500/50 cursor-pointer transition duration-300';
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

    const joined = document.createElement('span');
    joined.className = 'text-[10px] text-sky-400 font-medium truncate mt-0.5';
    joined.textContent = `Joined ${formatDateDetailed(u.jt)}`;

    details.append(name, joined);
    left.append(img, details);

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2 shrink-0 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-bold text-slate-300 font-mono';
    right.innerHTML = `<span>🧱 ${bCount}</span> <span class="text-slate-700">|</span> <span>👤 ${nCount}</span>`;

    card.append(left, right);
    return card;
  }));
}