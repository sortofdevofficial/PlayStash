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

loginBtn.addEventListener('click', () => {
  signInWithPopup(auth, provider).catch((err) => {
    alert("Login failed: " + err.message);
  });
});

logoutBtn.addEventListener('click', () => signOut(auth));

// Auto-creates missing document or missing fields automatically
async function syncUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  
  try {
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Document missing entirely: Auto-create
      const jt = Date.now();
      await setDoc(userRef, { jt });
      console.log('Created new user doc in Firestore:', uid);
      return jt;
    }

    const data = snap.data();
    if (!data.jt) {
      // Document exists but missing 'jt' field: Auto-add field
      const jt = Date.now();
      await setDoc(userRef, { jt }, { merge: true });
      console.log('Added missing jt field to user doc:', uid);
      return jt;
    }

    return data.jt;
  } catch (err) {
    console.error('Firestore Error:', err);
    alert('Firestore Error: ' + err.message);
    throw err;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    
    userEmail.textContent = user.email || user.displayName;
    userAvatar.src = user.photoURL || 'favicon.png';

    try {
      const jt = await syncUserProfile(user.uid);
      const date = new Date(jt);
      memberSince.textContent = `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    } catch (err) {
      memberSince.textContent = 'Member since Today';
    }
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';
  }
});