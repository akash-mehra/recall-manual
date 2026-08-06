/* auth.js — Google sign-in via Firebase, requesting the Drive appdata scope
   up front so the first sign-in also grants Drive access. Exposes a small
   pub/sub so other scripts (drive-sync.js, page UI) can react to auth state.
*/

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const RecallAuth = (function () {
  let currentUser = null;
  const listeners = [];

  function onAuthChange(fn) {
    listeners.push(fn);
    if (currentUser !== null) fn(currentUser);
  }

  function notify(user) {
    currentUser = user;
    listeners.forEach((fn) => fn(user));
  }

  firebase.auth().onAuthStateChanged((user) => {
    notify(user);
  });

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    provider.setCustomParameters({ prompt: 'consent' });
    const result = await firebase.auth().signInWithPopup(provider);
    const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken) {
      // Seed the token cache so drive-sync.js doesn't need an immediate refresh
      window.RecallDriveTokenCache = {
        token: credential.accessToken,
        expiresAt: Date.now() + 55 * 60 * 1000, // Google tokens last ~1hr; refresh a bit early
      };
    }
    return result.user;
  }

  async function signOutUser() {
    await firebase.auth().signOut();
    window.RecallDriveTokenCache = null;
  }

  function getCurrentUser() {
    return currentUser;
  }

  return { signIn, signOut: signOutUser, onAuthChange, getCurrentUser, DRIVE_SCOPE };
})();

window.RecallAuth = RecallAuth;
