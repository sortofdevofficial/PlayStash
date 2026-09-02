import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWBT35QNUywT-_RgeqeZXv44Z9frUYZMU",
  authDomain: "playstash0.firebaseapp.com",
  projectId: "playstash0",
  storageBucket: "playstash0.firebasestorage.app",
  messagingSenderId: "1015051983836",
  appId: "1:1015051983836:web:3c89a152ce8c476852cd19",
  measurementId: "G-6JH69Z3HNQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const memberSince = document.getElementById('member-since');

loginBtn.addEventListener('click', () => signInWithPopup(auth, provider).catch(console.error));
logoutBtn.addEventListener('click', () => signOut(auth).catch(console.error));

// Stores ONLY the numeric Unix timestamp (`jt`) per user for minimal storage overhead
async function syncUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists() || !snap.data()?.jt) {
    const jt = Date.now();
    await setDoc(userRef, { jt }, { merge: true });
    return jt;
  }

  return snap.data().jt;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    
    // Auth profile elements (0 database reads/writes)
    userEmail.textContent = user.email || user.displayName;
    userAvatar.src = user.photoURL || 'favicon.png';

    try {
      const jt = await syncUserProfile(user.uid);
      const date = new Date(jt);
      memberSince.textContent = `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    } catch (err) {
      console.error('Firestore Error:', err);
    }
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';
  }
});