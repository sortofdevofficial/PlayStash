import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
      await set(ref(db, 'users/' + user.uid), {
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        jt: creationTime
      });
      console.log("✅ Written to Realtime Database!");
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