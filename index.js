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
const memberSince = document.getElementById('member-since');

loginBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Login error:', error.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error.message);
  }
});

// Auto-creates users/{uid} document with Unix timestamp (jt) on first login
async function syncUserProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  let jt;

  if (!userSnap.exists()) {
    jt = Date.now(); // Unix timestamp in ms
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      jt: jt
    });
  } else {
    jt = userSnap.data().jt || Date.now();
  }

  return jt;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    userEmail.textContent = user.email;

    const jt = await syncUserProfile(user);
    const joinDate = new Date(jt).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
    memberSince.textContent = `Member since ${joinDate}`;
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
    memberSince.textContent = '';
  }
});