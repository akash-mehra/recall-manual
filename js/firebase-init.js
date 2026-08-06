/* firebase-init.js — Firebase app initialization.
   ⚠️ Replace firebaseConfig below with the real config from your Firebase
   project (Project settings → your web app → Config). Everything else in
   auth.js / drive-sync.js depends on this being filled in correctly.

   googleOAuthClientId is a SEPARATE value from firebaseConfig — it's the
   "Web client (auto created by Google Service)" OAuth 2.0 Client ID found
   in Google Cloud Console → APIs & Services → Credentials. Firebase creates
   this automatically once you enable the Google sign-in provider. We need
   it directly (not just via Firebase) so drive-sync.js can silently refresh
   the Drive access token without a popup every hour.
*/

const firebaseConfig = {
  apiKey: "AIzaSyAB3BRDpWuFOt7CCjEp3ZW3c8F7WxYHu4Y",
  authDomain: "recall-manual.firebaseapp.com",
  projectId: "recall-manual",
  storageBucket: "recall-manual.firebasestorage.app",
  messagingSenderId: "224241277021",
  appId: "1:224241277021:web:3ca61e846f3e778c6355b4",
};

const googleOAuthClientId = "224241277021-68q1e47lgoekkrck5aa5bm8vvct146q4.apps.googleusercontent.com";

firebase.initializeApp(firebaseConfig);
const firebaseAuth = firebase.auth();

window.RecallFirebase = { auth: firebaseAuth, config: firebaseConfig, googleOAuthClientId };

