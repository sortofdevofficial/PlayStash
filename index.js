import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const usersContainer = document.getElementById('users-container');

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

    userEmail.textContent = user.email || user.displayName;
    userAvatar.src = user.photoURL || 'favicon.png';

    const creationTime = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime).getTime()
      : Date.now();

    memberSince.textContent = `Member since ${new Date(creationTime).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

    try {
      await set(ref(db, `users/${user.uid}/info`), {
        e: user.email || '',
        dn: user.displayName || 'Player',
        pe: user.photoURL || 'favicon.png',
        jt: creationTime
      });
      console.log("✅ Successfully written to users/" + user.uid + "/info");
    } catch (err) {
      alert("Database Save Error: " + err.message);
    }
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';
  }
});

// Realtime sync for total count and active players list
onValue(ref(db, 'users'), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    userCountEl.textContent = '0';
    usersContainer.innerHTML = '<p class="text-gray-400 text-sm">No players yet.</p>';
    return;
  }

  const users = Object.values(data)
    .map(u => u.info)
    .filter(Boolean);

  userCountEl.textContent = users.length;

  usersContainer.innerHTML = users.map(u => `
    <div class="card-bg border border-gray-800 rounded-lg p-3 flex items-center gap-3">
      <img src="${u.pe || 'favicon.png'}" class="w-10 h-10 rounded-full border border-blue-500/50 object-cover" alt="Profile" />
      <div class="flex flex-col overflow-hidden">
        <span class="font-bold text-sm text-white truncate">${u.dn || 'Player'}</span>
        <span class="text-xs text-blue-400">Joined ${new Date(u.jt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
      </div>
    </div>
  `).join('');
});