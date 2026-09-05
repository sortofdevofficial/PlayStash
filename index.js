import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const PILL_CLASSES = 'text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0';

let unsubscribeGameSave = null;

function watchGameSave(uid) {
  if (unsubscribeGameSave) {
    unsubscribeGameSave();
    unsubscribeGameSave = null;
  }
  if (!gameSaveStatusEl) return;

  if (!uid) {
    gameSaveStatusEl.textContent = 'Sign in to save';
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-amber-500/10 text-amber-400 border-amber-500/20`;
    return;
  }

  unsubscribeGameSave = onValue(ref(db, `G/${GAME_ID}/${uid}`), (snap) => {
    const data = snap.val();

    if (!data) {
      gameSaveStatusEl.textContent = 'New World';
      gameSaveStatusEl.className = `${PILL_CLASSES} bg-blue-500/10 text-blue-400 border-blue-500/20`;
      return;
    }

    const builds = data.b ? Object.keys(data.b).length : 0;
    const villagers = data.n ? Object.keys(data.n).length : 0;
    gameSaveStatusEl.textContent = `Continue · ${builds} builds · ${villagers} villagers`;
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`;
  }, () => {
    gameSaveStatusEl.textContent = 'Save unavailable';
    gameSaveStatusEl.className = `${PILL_CLASSES} bg-gray-800/80 text-gray-400 border-gray-700/80`;
  });
}

// Date Formatter Helper (Includes Day, Month, Year, Hour, Minute, Second)
function formatDateDetailed(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

loginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Sign In Error: " + err.message);
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    watchGameSave(user.uid);

    userEmail.textContent = user.displayName || user.email;
    userAvatar.src = user.photoURL || 'favicon.png';

    const creationTime = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime).getTime()
      : Date.now();

    memberSince.textContent = `Joined ${formatDateDetailed(creationTime)}`;

    try {
      await set(ref(db, `users/${user.uid}/info`), {
        e: user.email || '',
        dn: user.displayName || 'Player',
        pe: user.photoURL || 'favicon.png',
        jt: creationTime
      });
      console.log("✅ Successfully updated profile in Realtime Database!");
    } catch (err) {
      alert("Database Save Error: " + err.message);
    }
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';
    watchGameSave(null);
  }
});

// Presence System: Tracks real-time online connections
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

// Realtime User Network Sync
onValue(ref(db, 'users'), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    userCountEl.textContent = '0';
    usersContainer.innerHTML = '<div class="card-bg border border-gray-800/80 rounded-xl p-4 text-center text-gray-400 text-sm">No registered players yet.</div>';
    return;
  }

  const users = Object.values(data)
    .map(u => u.info)
    .filter(Boolean)
    .sort((a, b) => (b.jt || 0) - (a.jt || 0));

  userCountEl.textContent = users.length;

  usersContainer.innerHTML = users.map(u => `
    <div class="card-bg border border-gray-800/80 rounded-xl p-3.5 flex items-center gap-3.5 hover:border-gray-700 transition">
      <img src="${u.pe || 'favicon.png'}" class="w-10 h-10 rounded-full border border-blue-500/40 object-cover shrink-0" alt="Profile" />
      <div class="flex flex-col min-w-0 flex-1">
        <span class="font-bold text-sm text-white truncate">${u.dn || 'Anonymous Player'}</span>
        <span class="text-[11px] text-blue-400/90 font-medium truncate mt-0.5">Joined ${formatDateDetailed(u.jt)}</span>
      </div>
    </div>
  `).join('');
});