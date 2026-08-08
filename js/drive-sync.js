/* drive-sync.js — background sync of the full deck/card backup to Google
   Drive's hidden appDataFolder, with a configurable frequency.

   Strategy: whole-database, last-write-wins. This is NOT a merge — the
   backup is always the complete state of one device. If you edit on two
   devices while offline before either syncs, whichever syncs last wins.
   For a single-user study app this is a reasonable tradeoff for simplicity;
   flagged here in case that ever surprises you.

   Sync frequency (set from settings.html, stored in localStorage):
   - 'auto'   : pushes ~6s after your last edit (debounced)
   - 'hourly' : pushes if dirty, checked periodically while the app is open
   - 'daily'  : same, on a 24h threshold
   - 'manual' : never pushes automatically — only via "Backup now"

   Caveat: 'hourly'/'daily' only run while the app is actually open in a
   tab. This is a browser PWA, not a native app with guaranteed background
   execution — there's no way around this without a server component.

   Token handling lives entirely in auth.js (RecallAuth.getAccessToken),
   since sign-in itself is done via the same Google Identity Services token
   client — one grant covers both identity and this Drive scope.
*/

const BACKUP_FILE_NAME = 'recall-manual-backup.json';
const AUTO_SYNC_DEBOUNCE_MS = 6000;
const LAST_LOCAL_CHANGE_KEY = 'recall_manual_last_local_change';
const LAST_SYNCED_AT_KEY = 'recall_manual_last_synced_at';
const SYNC_MODE_KEY = 'recall_manual_sync_mode';
const PERIODIC_CHECK_MS = 5 * 60 * 1000; // check every 5 min while app is open
const FREQUENCY_MS = { hourly: 60 * 60 * 1000, daily: 24 * 60 * 60 * 1000 };

const RecallSync = (function () {
  let debounceTimer = null;
  let periodicTimer = null;
  let statusListeners = [];

  function setStatus(status, detail) {
    statusListeners.forEach((fn) => fn(status, detail));
  }
  function onStatus(fn) {
    statusListeners.push(fn);
  }

  function getSyncMode() {
    return localStorage.getItem(SYNC_MODE_KEY) || 'auto';
  }

  function setSyncMode(mode) {
    localStorage.setItem(SYNC_MODE_KEY, mode);
    schedulePeriodicCheck();
  }

  function getLastSyncedAt() {
    const v = Number(localStorage.getItem(LAST_SYNCED_AT_KEY) || 0);
    return v || null;
  }

  async function driveFetch(url, options = {}) {
    const token = await RecallAuth.getAccessToken();
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
    if (getSyncMode() === 'auto') {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(pushIfDirty, AUTO_SYNC_DEBOUNCE_MS);
    }
    // hourly/daily/manual: periodic timer or explicit "Backup now" handles it
  }

  /* Cancels any pending debounced push and does it NOW instead, awaited.
     Critical for navigation: a setTimeout scheduled by markDirty() is
     destroyed the instant the page navigates away (e.g. "Save & finish"
     jumping straight to study.html), so a card saved seconds before
     leaving the page could silently never make it to Drive — no error,
     it just never ran. Call this before any deliberate same-app
     navigation that follows a mutation. */
  async function flushPendingSync() {
    clearTimeout(debounceTimer);
    if (!RecallAuth.getCurrentUser()) return;
    if (getSyncMode() !== 'auto') return; // hourly/daily/manual don't auto-push on navigation
    await pushIfDirty();
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

  /* Explicit manual trigger from settings — always pushes, even if nothing
     changed, so the user gets a clear "just backed up" confirmation. */
  async function backupNow() {
    if (!RecallAuth.getCurrentUser()) {
      throw new Error('Sign in first to back up to Drive');
    }
    setStatus('syncing');
    try {
      const existing = await findBackupFile();
      await uploadBackup(existing ? existing.id : null);
      setStatus('synced');
    } catch (err) {
      console.error('Manual backup failed', err);
      setStatus('error', err.message);
      throw err;
    }
  }

  function schedulePeriodicCheck() {
    clearInterval(periodicTimer);
    const mode = getSyncMode();
    const threshold = FREQUENCY_MS[mode];
    if (!threshold) return; // auto and manual don't use the periodic timer

    periodicTimer = setInterval(() => {
      if (!RecallAuth.getCurrentUser()) return;
      const lastChange = Number(localStorage.getItem(LAST_LOCAL_CHANGE_KEY) || 0);
      const lastSynced = Number(localStorage.getItem(LAST_SYNCED_AT_KEY) || 0);
      const dueForSync = Date.now() - lastSynced >= threshold;
      if (lastChange > lastSynced && dueForSync) {
        pushIfDirty();
      }
    }, PERIODIC_CHECK_MS);
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
    } finally {
      schedulePeriodicCheck();
    }
  }

  return {
    markDirty,
    reconcileOnSignIn,
    pushIfDirty,
    flushPendingSync,
    backupNow,
    onStatus,
    getSyncMode,
    setSyncMode,
    getLastSyncedAt,
    _schedulePeriodicCheck: schedulePeriodicCheck,
  };
})();

window.RecallSync = RecallSync;

// Keep the periodic hourly/daily check running on whichever page happens to
// be open, not just the dashboard — study.html and create.html need it too.
RecallAuth.onAuthChange((user) => {
  if (user) RecallSync._schedulePeriodicCheck();
});
