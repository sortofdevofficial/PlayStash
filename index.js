import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- SECURITY & CONSOLE CONTROLS ---
(() => {
  // Disable Right Click Context Menu
  document.addEventListener('contextmenu', e => e.preventDefault());

  // Block Developer Shortcut Keys
  document.addEventListener('keydown', e => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
      (e.ctrlKey && ['U', 'u', 'S', 's'].includes(e.key))
    ) {
      e.preventDefault();
    }
  });

  // Neuter Console Logs
  const noop = () => {};
  window.console.log = noop;
  window.console.warn = noop;
  window.console.error = noop;
  window.console.info = noop;
  window.console.debug = noop;
})();

// Dynamic Header Border on Scroll Effect
const header = document.getElementById('main-header');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    header?.classList.add('scrolled');
  } else {
    header?.classList.remove('scrolled');
  }
});

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

const GAME_ID = 1;
const PILL_CLASSES = 'text-[10px] font-mono px-2 py-0.5 rounded border shrink-0';

let unsubscribeGameSave = null;

function watchGameSave(uid) {
  if (unsubscribeGameSave) {
    unsubscribeGameSave();
    unsubscribeGameSave = null;
  }
  if (!gameSaveStatusEl) return;

  if (!uid) {
    gameSaveStatusEl.textContent = 'Sign in to save';
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-slate-900 text-slate-400 border-slate-800`;
    return;
  }

  unsubscribeGameSave = onValue(ref(db, `G/${GAME_ID}/${uid}`), (snap) => {
    const data = snap.val();

    if (!data) {
      gameSaveStatusEl.textContent = 'New World';
      gameSaveStatusEl.className = `${PILL_CLASSES} bg-blue-950 text-blue-400 border-blue-800`;
      return;
    }

    const builds = data.b ? Object.keys(data.b).length : 0;
    const villagers = data.n ? Object.keys(data.n).length : 0;
    gameSaveStatusEl.textContent = `Continue · ${builds} builds · ${villagers} villagers`;
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-emerald-950 text-emerald-400 border-emerald-800`;
  }, () => {
    gameSaveStatusEl.textContent = 'Save offline';
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-slate-900 text-slate-500 border-slate-800`;
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

// Google Sign-In Only
loginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Authentication Error: " + err.message);
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user && !user.isAnonymous) {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');

    userEmail.textContent = user.displayName || user.email;
    userAvatar.src = safeAvatarUrl(user.photoURL);

    const creationTime = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime).getTime()
      : Date.now();

    memberSince.textContent = `Joined ${formatDateDetailed(creationTime)}`;

    try {
      await set(ref(db, `u/${user.uid}/i`), {
        e: user.email || '',
        dn: user.displayName || 'Player',
        pe: user.photoURL || 'favicon.png',
        jt: creationTime
      });
    } catch (err) {
      // Ignored due to console lock
    }

    watchGameSave(user.uid);
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';
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
  onlineCountEl.textContent = onlineTotal;
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

// User Roster Sync
onValue(ref(db, 'u'), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    userCountEl.textContent = '0';
    usersContainer.innerHTML = '<div class="console-card rounded-lg p-4 text-center text-slate-500 text-xs font-mono">No registered profiles in database.</div>';
    return;
  }

  const users = Object.values(data)
    .map(u => u.i)
    .filter(Boolean)
    .sort((a, b) => (b.jt || 0) - (a.jt || 0));

  userCountEl.textContent = users.length;

  usersContainer.replaceChildren(...users.map(u => {
    const card = document.createElement('div');
    card.className = 'console-card rounded-lg p-3 flex items-center gap-3 hover:border-slate-700 transition duration-200';

    const img = document.createElement('img');
    img.src = safeAvatarUrl(u.pe);
    img.className = 'w-8 h-8 rounded border border-slate-700 object-cover shrink-0';
    img.alt = 'Profile';

    const details = document.createElement('div');
    details.className = 'flex flex-col min-w-0 flex-1';

    const name = document.createElement('span');
    name.className = 'font-bold text-xs text-slate-200 truncate font-mono';
    name.textContent = u.dn || 'Player';

    const joined = document.createElement('span');
    joined.className = 'text-[10px] text-slate-500 font-mono truncate';
    joined.textContent = `Joined ${formatDateDetailed(u.jt)}`;

    details.append(name, joined);
    card.append(img, details);
    return card;
  }));
}, () => {
  userCountEl.textContent = '—';
  usersContainer.innerHTML = `<div class="console-card rounded-lg p-4 text-center text-slate-500 text-xs font-mono">Directory sync error.</div>`;
});