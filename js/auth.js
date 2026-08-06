/* auth.js — Google sign-in via Firebase, requesting the Drive appdata scope
   up front so the first sign-in also grants Drive access. Exposes a small
   pub/sub so other scripts (drive-sync.js, page UI) can react to auth state.

   Uses signInWithRedirect rather than signInWithPopup: popups depend on a
   cookie-based handshake between the popup and opener window that mobile
   browsers increasingly block by default, which surfaces as a generic
   "requested action is invalid" error inside the popup. Redirect avoids
   that entirely by navigating the whole page instead.
*/

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const RecallAuth = (function () {
  let currentUser = null;
  const listeners = [];
  let redirectResultChecked = false;

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

  // Capture the result of a redirect-based sign-in (runs once on page load).
  let redirectError = null;
  const redirectResultPromise = firebase.auth().getRedirectResult()
    .then((result) => {
      redirectResultChecked = true;
      if (result && result.credential) {
        const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
        if (credential && credential.accessToken) {
          window.RecallDriveTokenCache = {
            token: credential.accessToken,
            expiresAt: Date.now() + 55 * 60 * 1000,
          };
        }
      }
      return result;
    })
    .catch((err) => {
      redirectResultChecked = true;
      redirectError = err;
      console.error('Redirect sign-in error', err);
      return null;
    });

  function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    provider.setCustomParameters({ prompt: 'consent' });
    return firebase.auth().signInWithRedirect(provider);
  }

  async function signOutUser() {
    await firebase.auth().signOut();
    window.RecallDriveTokenCache = null;
  }

  function getCurrentUser() {
    return currentUser;
  }

  function getRedirectError() {
    return redirectError;
  }

  return {
    signIn,
    signOut: signOutUser,
    onAuthChange,
    getCurrentUser,
    DRIVE_SCOPE,
    redirectResultPromise,
    getRedirectError,
  };
})();

window.RecallAuth = RecallAuth;
