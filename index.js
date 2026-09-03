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

// Force long polling to bypass network/COOP header restrictions
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

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
    console.error("Sign-in error:", err);
    alert("Sign-in failed: " + err.message);
  }
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
      await setDoc(userRef, {
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        jt: creationTimestamp
      });
      console.log("✅ Success! Created new document in Firestore under users/" + user.uid);
      return creationTimestamp;
    }

    const data = snap.data();
    if (!data.jt || !data.email) {
      const updatedJt = data.jt || creationTimestamp;
      await setDoc(userRef, {
        email: data.email || user.email || '',
        displayName: data.displayName || user.displayName || '',
        photoURL: data.photoURL || user.photoURL || '',
        jt: updatedJt
      }, { merge: true });
      console.log("✅ Success! Updated missing fields in Firestore for users/" + user.uid);
      return updatedJt;
    }

    console.log("✅ Existing user data loaded from Firestore.");
    return data.jt;
  } catch (err) {
    console.error("❌ Firestore Sync Error:", err.message);
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