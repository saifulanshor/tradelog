// auth.js - Included in every protected page
// Redirects to login if user is not authenticated

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = '../index.html';
    return null;
  }
  currentUser = session.user;
  return session.user;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = '../index.html';
}
