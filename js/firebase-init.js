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
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

const googleOAuthClientId = "REPLACE_ME.apps.googleusercontent.com";

firebase.initializeApp(firebaseConfig);
const firebaseAuth = firebase.auth();

window.RecallFirebase = { auth: firebaseAuth, config: firebaseConfig, googleOAuthClientId };

