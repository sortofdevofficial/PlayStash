import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- SECURITY & CONSOLE CONTROLS ---
(() => {
  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
      (e.ctrlKey && ['U', 'u', 'S', 's'].includes(e.key))
    ) {
      e.preventDefault();
    }
  });

  const noop = () => {};
  window.console.log = noop;
  window.console.warn = noop;
  window.console.error = noop;
  window.console.info = noop;
  window.console.debug = noop;
})();

const firebaseConfig = {
  apiKey: "AIzaSyCWBT35QNUywT-_RgeqeZXv44Z9frUYZMU",
  authDomain: "playstash0.firebaseapp.com",
  projectId: "playstash0",
  storageBucket: "playstash0.firebasestorage.app",
  messagingSenderId: "1015051983836",
  appId: "1:1015051983836:web:3c89a152ce8c476852cd19",
  measurementId: "G-6JH69Z3HNQ",
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
const gameSaveStatusEl = document.getElementById('game-save-status');

// Navigation Tabs
const tabGamesBtn = document.getElementById('tab-games-btn');
const tabPlayersBtn = document.getElementById('tab-players-btn');
const tabProfileBtn = document.getElementById('tab-profile-btn');

const gamesSection = document.getElementById('games-section');
const playersSection = document.getElementById('players-section');
const profileSection = document.getElementById('profile-section');
const openMyProfileBtn = document.getElementById('open-my-profile-btn');

// Profile Dashboard Elements
const profileCardAvatar = document.getElementById('profile-card-avatar');
const profileCardName = document.getElementById('profile-card-name');
const profileCardEmail = document.getElementById('profile-card-email');
const profileCardJoined = document.getElementById('profile-card-joined');
const profileCardSaveCount = document.getElementById('profile-card-save-count');
const profileCardLevel = document.getElementById('profile-card-level');
const profileCardStatusDot = document.getElementById('profile-card-status-dot');
const profileCardStatusText = document.getElementById('profile-card-status-text');

// Modal Elements
const profileModal = document.getElementById('profile-modal');
const modalAvatar = document.getElementById('modal-avatar');
const modalName = document.getElementById('modal-name');
const modalEmail = document.getElementById('modal-email');
const modalJoined = document.getElementById('modal-joined');
const closeModalBtn = document.getElementById('close-modal-btn');
const closeModalBottomBtn = document.getElementById('close-modal-bottom-btn');

const GAME_ID = 1;
const PILL_CLASSES = 'text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border shrink-0';

let unsubscribeGameSave = null;

// --- TAB SWITCHER LOGIC ---
function switchTab(selected) {
  const activeClass = "pb-1 text-xs font-bold uppercase tracking-widest text-white border-b-2 border-sky-400 transition cursor-pointer";
  const inactiveClass = "pb-1 text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition cursor-pointer";

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

function watchGameSave(uid) {
  if (unsubscribeGameSave) {
    unsubscribeGameSave();
    unsubscribeGameSave = null;
  }
  if (!gameSaveStatusEl) return;

  if (!uid) {
    gameSaveStatusEl.textContent = 'Sign in to save';
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-slate-800 text-slate-400 border-slate-700`;
    if (profileCardSaveCount) profileCardSaveCount.textContent = '0 Games';
    return;
  }

  unsubscribeGameSave = onValue(ref(db, `G/${GAME_ID}/${uid}`), (snap) => {
    const data = snap.val();

    if (!data) {
      gameSaveStatusEl.textContent = 'New Save State';
      gameSaveStatusEl.className = `${PILL_CLASSES} bg-sky-500/20 text-sky-400 border-sky-500/30`;
      if (profileCardSaveCount) profileCardSaveCount.textContent = '0 Saves';
      return;
    }

    const builds = data.b ? Object.keys(data.b).length : 0;
    const villagers = data.n ? Object.keys(data.n).length : 0;
    gameSaveStatusEl.textContent = `Save Sync: ${builds} builds · ${villagers} villagers`;
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-emerald-500/20 text-emerald-400 border-emerald-500/30`;
    if (profileCardSaveCount) profileCardSaveCount.textContent = '1 Active';
  }, () => {
    gameSaveStatusEl.textContent = 'Save Unavailable';
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-slate-800 text-slate-500 border-slate-700`;
  });
}

function formatDateDetailed(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Modal Controls
const closeModal = () => profileModal?.classList.add('hidden');
closeModalBtn?.addEventListener('click', closeModal);
closeModalBottomBtn?.addEventListener('click', closeModal);

function openUserModal(user) {
  if (!profileModal) return;
  modalAvatar.src = safeAvatarUrl(user.pe);
  modalName.textContent = user.dn || 'Anonymous Player';
  modalEmail.textContent = user.e ? user.e.replace(/(?<=.{2}).(?=.*@)/g, "*") : 'PlayStash Member';
  modalJoined.textContent = `PlayStash Member Since: ${formatDateDetailed(user.jt)}`;
  profileModal.classList.remove('hidden');
}

// Google Authentication
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

    const displayName = user.displayName || user.email || 'Player';
    const avatarUrl = safeAvatarUrl(user.photoURL);

    userEmail.textContent = displayName;
    userAvatar.src = avatarUrl;

    if (profileCardAvatar) profileCardAvatar.src = avatarUrl;
    if (profileCardName) profileCardName.textContent = displayName;
    if (profileCardEmail) profileCardEmail.textContent = user.email || 'PlayStash Google Account';
    if (profileCardLevel) {
      profileCardLevel.textContent = 'LEVEL 1';
      profileCardLevel.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30';
    }
    if (profileCardStatusDot) profileCardStatusDot.className = 'absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-[#060911] rounded-full';
    if (profileCardStatusText) {
      profileCardStatusText.textContent = 'ONLINE';
      profileCardStatusText.className = 'text-xs font-extrabold text-emerald-400 block mt-1';
    }

    const creationTime = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime).getTime()
      : Date.now();

    const formattedDate = formatDateDetailed(creationTime);
    memberSince.textContent = `Joined ${formattedDate}`;
    if (profileCardJoined) profileCardJoined.textContent = `PlayStash Member Since: ${formattedDate}`;

    try {
      await set(ref(db, `u/${user.uid}/i`), {
        e: user.email || '',
        dn: displayName,
        pe: user.photoURL || 'favicon.png',
        jt: creationTime
      });
    } catch (err) {
      // Console hidden
    }

    watchGameSave(user.uid);
  } else {
    loginBtn?.classList.remove('hidden');
    userProfile?.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';

    if (profileCardAvatar) profileCardAvatar.src = 'favicon.png';
    if (profileCardName) profileCardName.textContent = 'Guest Player';
    if (profileCardEmail) profileCardEmail.textContent = 'Sign in to view full profile details';
    if (profileCardJoined) profileCardJoined.textContent = 'PlayStash Member: Offline';
    if (profileCardLevel) {
      profileCardLevel.textContent = 'LOCKED';
      profileCardLevel.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700';
    }
    if (profileCardStatusDot) profileCardStatusDot.className = 'absolute bottom-1 right-1 w-5 h-5 bg-slate-600 border-2 border-[#060911] rounded-full';
    if (profileCardStatusText) {
      profileCardStatusText.textContent = 'OFFLINE';
      profileCardStatusText.className = 'text-xs font-extrabold text-slate-500 block mt-1';
    }

    watchGameSave(null);
  }
});

// Telemetry & Presence System
const connectedRef = ref(db, ".info/connected");
const presenceRef = ref(db, "presence");

onValue(connectedRef, (snap) => {
  if (snap.val() === true) {
    const myPresenceRef = push(presenceRef);
    onDisconnect(myPresenceRef).remove();
    set(myPresenceRef, {
      online: true,
      ts: serverTimestamp()
    });
  }
});

onValue(presenceRef, (snap) => {
  const onlineData = snap.val();
  const onlineTotal = onlineData ? Object.keys(onlineData).length : 0;
  if (onlineCountEl) onlineCountEl.textContent = onlineTotal;
});

function safeAvatarUrl(url) {
  if (typeof url !== 'string' || !url) return 'favicon.png';
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : 'favicon.png';
  } catch {
    return 'favicon.png';
  }
}

// Realtime User Network Sync
onValue(ref(db, 'u'), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    if (userCountEl) userCountEl.textContent = '0';
    usersContainer.innerHTML = '<div class="ps-glass rounded-2xl p-4 text-center text-slate-400 text-xs">No registered players yet.</div>';
    return;
  }

  const users = Object.values(data)
    .map(u => u.i)
    .filter(Boolean)
    .sort((a, b) => (b.jt || 0) - (a.jt || 0));

  if (userCountEl) userCountEl.textContent = users.length;

  usersContainer.replaceChildren(...users.map(u => {
    const card = document.createElement('div');
    card.className = 'ps-glass rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-sky-500/50 cursor-pointer transition duration-300';
    card.addEventListener('click', () => openUserModal(u));

    const img = document.createElement('img');
    img.src = safeAvatarUrl(u.pe);
    img.className = 'w-9 h-9 rounded-full border border-sky-400/50 object-cover shrink-0 shadow-sm';
    img.alt = 'Profile';

    const details = document.createElement('div');
    details.className = 'flex flex-col min-w-0 flex-1';

    const name = document.createElement('span');
    name.className = 'font-bold text-xs text-white truncate';
    name.textContent = u.dn || 'Player';

    const joined = document.createElement('span');
    joined.className = 'text-[10px] text-sky-400 font-medium truncate mt-0.5';
    joined.textContent = `Joined ${formatDateDetailed(u.jt)}`;

    details.append(name, joined);
    card.append(img, details);
    return card;
  }));
}, () => {
  if (userCountEl) userCountEl.textContent = '—';
  usersContainer.innerHTML = `<div class="ps-glass rounded-2xl p-4 text-center text-slate-400 text-xs">Player network unavailable.</div>`;
});