/* drive-sync.js — automatic background sync of the full deck/card backup
   to Google Drive's hidden appDataFolder.

   Strategy: whole-database, last-write-wins. This is NOT a merge — the
   backup is always the complete state of one device. If you edit on two
   devices while offline before either syncs, whichever syncs last wins.
   For a single-user study app this is a reasonable tradeoff for simplicity;
   flagged here in case that ever surprises you.

   Token handling: Firebase's popup sign-in gives us an initial Drive access
   token, but Firebase does not refresh it. We use Google Identity Services
   (GIS) to silently re-request a token (no popup) once the initial one is
   close to expiring, as long as the user has already granted consent.
*/

const BACKUP_FILE_NAME = 'recall-manual-backup.json';
const AUTO_SYNC_DEBOUNCE_MS = 6000;
const LAST_LOCAL_CHANGE_KEY = 'recall_manual_last_local_change';
const LAST_SYNCED_AT_KEY = 'recall_manual_last_synced_at';

const RecallSync = (function () {
  let debounceTimer = null;
  let statusListeners = [];
  let gisInited = false;
  let tokenClient = null;

  function setStatus(status, detail) {
    statusListeners.forEach((fn) => fn(status, detail));
  }
  function onStatus(fn) {
    statusListeners.push(fn);
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

  async function ensureGisReady() {
    if (gisInited) return;
    await loadGisScript();
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: window.RecallFirebase.googleOAuthClientId,
      scope: RecallAuth.DRIVE_SCOPE,
      callback: () => {}, // overridden per-call below
    });
    gisInited = true;
  }

  function requestTokenSilently() {
    return new Promise((resolve, reject) => {
      tokenClient.callback = (resp) => {
        if (resp.error) return reject(resp);
        window.RecallDriveTokenCache = {
          token: resp.access_token,
          expiresAt: Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 55 * 60 * 1000) - 60000,
        };
        resolve(resp.access_token);
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  async function getAccessToken() {
    const cache = window.RecallDriveTokenCache;
    if (cache && cache.token && cache.expiresAt > Date.now()) {
      return cache.token;
    }
    await ensureGisReady();
    return requestTokenSilently();
  }

  async function driveFetch(url, options = {}) {
    const token = await getAccessToken();
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Drive API ${res.status}: ${body}`);
    }
    return res;
  }

  async function findBackupFile() {
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=name='${BACKUP_FILE_NAME}'`;
    const res = await driveFetch(url);
    const data = await res.json();
    return (data.files && data.files[0]) || null;
  }

  async function uploadBackup(existingFileId) {
    const payload = await RecallBackup.buildExportPayload();
    const jsonStr = JSON.stringify(payload);

    const metadata = existingFileId
      ? { name: BACKUP_FILE_NAME }
      : { name: BACKUP_FILE_NAME, parents: ['appDataFolder'] };

    const boundary = 'recall_manual_boundary';
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${jsonStr}\r\n` +
      `--${boundary}--`;

    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    await driveFetch(url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });

    localStorage.setItem(LAST_SYNCED_AT_KEY, String(Date.now()));
  }

  async function downloadBackup(fileId) {
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return res.json();
  }

  function markDirty() {
    localStorage.setItem(LAST_LOCAL_CHANGE_KEY, String(Date.now()));
    if (!RecallAuth.getCurrentUser()) return; // not signed in, nothing to sync
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(pushIfDirty, AUTO_SYNC_DEBOUNCE_MS);
  }

  async function pushIfDirty() {
    const lastChange = Number(localStorage.getItem(LAST_LOCAL_CHANGE_KEY) || 0);
    const lastSynced = Number(localStorage.getItem(LAST_SYNCED_AT_KEY) || 0);
    if (lastChange <= lastSynced) return;
    try {
      setStatus('syncing');
      const existing = await findBackupFile();
      await uploadBackup(existing ? existing.id : null);
      setStatus('synced');
    } catch (err) {
      console.error('Drive sync push failed', err);
      setStatus('error', err.message);
    }
  }

  /* Called once right after sign-in: reconciles local vs remote before
     auto-sync takes over for subsequent changes. */
  async function reconcileOnSignIn() {
    try {
      setStatus('syncing');
      const existing = await findBackupFile();

      if (!existing) {
        // Nothing in Drive yet — push whatever is local.
        await uploadBackup(null);
        setStatus('synced');
        return { action: 'pushed-initial' };
      }

      const remoteTime = new Date(existing.modifiedTime).getTime();
      const lastSynced = Number(localStorage.getItem(LAST_SYNCED_AT_KEY) || 0);
      const lastChange = Number(localStorage.getItem(LAST_LOCAL_CHANGE_KEY) || 0);

      if (lastSynced === 0 || remoteTime > lastSynced) {
        // This device has never synced with this remote, or remote moved
        // since we last touched it — remote wins (pull).
        const payload = await downloadBackup(existing.id);
        await RecallBackup.replaceAllDataFromPayload(payload);
        localStorage.setItem(LAST_SYNCED_AT_KEY, String(Date.now()));
        setStatus('synced');
        return { action: 'pulled', deckCount: payload.decks.length };
      }

      if (lastChange > lastSynced) {
        // Local has unsynced edits newer than our last known sync — push.
        await uploadBackup(existing.id);
        setStatus('synced');
        return { action: 'pushed' };
      }

      setStatus('synced');
      return { action: 'noop' };
    } catch (err) {
      console.error('Drive sync reconciliation failed', err);
      setStatus('error', err.message);
      return { action: 'error', message: err.message };
    }
  }

  return { markDirty, reconcileOnSignIn, pushIfDirty, onStatus, getAccessToken };
})();

window.RecallSync = RecallSync;
