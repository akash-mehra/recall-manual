/* auth.js — Google sign-in via Google Identity Services (GIS) directly,
   NOT Firebase Auth.

   Why: Firebase's popup/redirect sign-in shuttles data between the
   authDomain (recall-manual.firebaseapp.com) and this app's origin
   (akash-mehra.github.io) via cross-site storage. Android Chrome
   increasingly blocks that by default, which fails SILENTLY — no error,
   sign-in just never completes. GIS's token client talks directly to
   Google as a first-party flow and is built to keep working as
   third-party cookies go away, so it sidesteps the problem entirely.

   One token, both identity and Drive access: we request 'openid email
   profile' (identity) plus the Drive appdata scope together, so a single
   consent grants everything drive-sync.js needs too.
*/

const OAUTH_CLIENT_ID = '224241277021-68q1e47lgoekkrck5aa5bm8vvct146q4.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const OAUTH_SCOPES = `openid email profile ${DRIVE_SCOPE}`;

const TOKEN_CACHE_KEY = 'recall_manual_google_token_v1';
const USER_CACHE_KEY = 'recall_manual_google_user_v1';

const RecallAuth = (function () {
  // undefined = "not checked yet", null = "checked, signed out", object = signed in.
  // Using undefined as the sentinel (rather than null) lets a listener that
  // registers AFTER restoreSession() has already run still get replayed the
  // signed-out state — otherwise the page never hears about it and just
  // sits blank, which is exactly the bug this fixes.
  let currentUser = undefined;
  let lastError = null;
  const listeners = [];
  let tokenClient = null;
  let gisReadyPromise = null;

  function onAuthChange(fn) {
    listeners.push(fn);
    if (currentUser !== undefined) fn(currentUser);
  }

  function notify(user) {
    currentUser = user;
    listeners.forEach((fn) => fn(user));
  }

  function loadGisScript() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        return resolve();
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureTokenClient() {
    if (tokenClient) return tokenClient;
    if (!gisReadyPromise) gisReadyPromise = loadGisScript();
    await gisReadyPromise;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: OAUTH_CLIENT_ID,
      scope: OAUTH_SCOPES,
      callback: () => {}, // overridden per-request below
    });
    return tokenClient;
  }

  function saveToken(resp) {
    const record = {
      token: resp.access_token,
      expiresAt: Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 55 * 60 * 1000) - 60000,
    };
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(record));
    window.RecallDriveTokenCache = record; // drive-sync.js reads this directly
    return record;
  }

  function readCachedToken() {
    try {
      const raw = localStorage.getItem(TOKEN_CACHE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      window.RecallDriveTokenCache = record;
      return record;
    } catch {
      return null;
    }
  }

  async function fetchUserInfo(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch profile info');
    const data = await res.json();
    return {
      uid: data.sub,
      displayName: data.name || data.email,
      email: data.email,
      photoURL: data.picture || '',
    };
  }

  function requestToken({ silent }) {
    return new Promise(async (resolve, reject) => {
      const client = await ensureTokenClient();
      client.callback = (resp) => {
        if (resp.error) return reject(resp);
        resolve(resp);
      };
      client.requestAccessToken({ prompt: silent ? '' : 'consent' });
    });
  }

  /* On page load: only restore from a locally cached session — never make
     an unsolicited GIS request here. Even a "silent" request can surface
     as a blocked-popup warning to the user if there's no click behind it,
     which is confusing on a page they haven't interacted with yet. The
     gate should show static sign-in options and stay quiet until tapped.
  */
  function restoreSession() {
    const cachedUser = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || 'null');
    const cachedToken = readCachedToken();
    if (cachedUser) {
      // Show as signed in even if the token itself has expired — a fresh
      // token will be fetched lazily (still user-gesture-adjacent, e.g.
      // triggered by an in-app action) the next time getAccessToken() is
      // actually needed, rather than eagerly on page load.
      notify(cachedUser);
    } else {
      notify(null);
    }
  }

  async function signIn() {
    lastError = null;
    try {
      const resp = await requestToken({ silent: false });
      const record = saveToken(resp);
      const user = await fetchUserInfo(record.token);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      notify(user);
      return user;
    } catch (err) {
      lastError = err;
      notify(null);
      throw err;
    }
  }

  function signOut() {
    const cached = readCachedToken();
    if (cached && cached.token && window.google && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(cached.token, () => {});
    }
    localStorage.removeItem(TOKEN_CACHE_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    window.RecallDriveTokenCache = null;
    notify(null);
  }

  /* Used by drive-sync.js — returns a valid access token, refreshing
     silently first if the cached one is stale. */
  async function getAccessToken() {
    const cached = readCachedToken();
    if (cached && cached.token && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    const resp = await requestToken({ silent: true });
    const record = saveToken(resp);
    return record.token;
  }

  function getCurrentUser() {
    return currentUser;
  }

  function getLastError() {
    return lastError;
  }

  restoreSession();
  // Preload the GIS script + token client eagerly so that by the time the
  // user taps "Sign in", requestAccessToken() fires synchronously within
  // the click handler — mobile browsers are more likely to block the
  // consent popup if there's an async gap (script loading) in between.
  ensureTokenClient().catch(() => {});

  return {
    signIn,
    signOut,
    onAuthChange,
    getCurrentUser,
    getAccessToken,
    getLastError,
    DRIVE_SCOPE,
  };
})();

window.RecallAuth = RecallAuth;
