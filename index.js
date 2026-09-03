import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Bypasses popup COOP header blocks completely
loginBtn.addEventListener('click', () => {
  signInWithRedirect(auth, provider);
});

logoutBtn.addEventListener('click', () => signOut(auth));

// Catch any redirect sign-in errors
getRedirectResult(auth).catch((err) => {
  if (err && err.code) alert("Auth Error: " + err.message);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    
    userEmail.textContent = user.email || user.displayName;
    userAvatar.src = user.photoURL || 'favicon.png';

    // Derive immutable Unix timestamp directly from Google Auth metadata (Zero database reads required)
    const creationTime = user.metadata?.creationTime 
      ? new Date(user.metadata.creationTime).getTime() 
      : Date.now();

    const date = new Date(creationTime);
    memberSince.textContent = `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

    // Direct write/merge to users/{uid}
    try {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        jt: creationTime
      }, { merge: true });
      console.log("✅ Data successfully saved in Firestore for user:", user.uid);
    } catch (err) {
      console.error("Firestore Write Failed:", err);
      alert("Firestore Write Error: " + err.message);
    }
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';
  }
});