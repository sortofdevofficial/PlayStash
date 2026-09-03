import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Force Long-Polling to prevent "client is offline" connection drops across regions
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

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

async function syncUserProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  const creationTimestamp = user.metadata?.creationTime 
    ? new Date(user.metadata.creationTime).getTime() 
    : Date.now();

  try {
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Auto-create user document if missing
      await setDoc(userRef, {
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        jt: creationTimestamp
      });
      console.log("Successfully created user document in Firestore!");
      return creationTimestamp;
    }

    const data = snap.data();
    
    // Fill in missing fields if any are absent
    if (!data.jt || !data.email) {
      const updatedJt = data.jt || creationTimestamp;
      await setDoc(userRef, {
        email: data.email || user.email || '',
        displayName: data.displayName || user.displayName || '',
        photoURL: data.photoURL || user.photoURL || '',
        jt: updatedJt
      }, { merge: true });
      return updatedJt;
    }

    return data.jt;
  } catch (err) {
    console.error("Firestore sync error:", err);
    return creationTimestamp;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    
    userEmail.textContent = user.email || user.displayName;
    userAvatar.src = user.photoURL || 'favicon.png';

    const jt = await syncUserProfile(user);
    const date = new Date(jt);
    memberSince.textContent = `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
    userAvatar.src = '';
    memberSince.textContent = '';
  }
});