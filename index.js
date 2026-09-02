const SUPABASE_URL = 'https://gmacloctceeksjkufqtf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtYWNsb2N0Y2Vla3Nqa3VmcXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzY1MTEsImV4cCI6MjEwMzkxMjUxMX0.BqR3bAO6qKUB28f2tpZfdS4aOC0CgXmvOkl2FMm7Crs';

// Correct client initialization (v2 CDN style)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userEmail = document.getElementById('user-email');

// Google OAuth Trigger
loginBtn.addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href // Uses exact current URL path
    }
  });
  if (error) {
    console.error('Login error:', error.message);
    alert('Login Error: ' + error.message);
  }
});

// Logout Trigger
logoutBtn.addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error('Logout error:', error.message);
    alert('Logout Error: ' + error.message);
  }
});

// Auth Session Listener
async function initAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  updateUI(session?.user);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateUI(session?.user);
  });
}

function updateUI(user) {
  if (user) {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    userEmail.textContent = user.email;
  } else {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    userEmail.textContent = '';
  }
}

initAuth();