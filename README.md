# Recall Manual 🌸

A manual, no-AI flashcard PWA. You write, draw, or photograph your own cards —
nothing is generated for you.

## Features

- **Three card input modes:** type text, hand-draw (stylus/finger), or photo capture
- **IndexedDB storage** — handles handwriting and photo blobs at real scale, unlike
  localStorage-based prototypes
- **Glassmorphic flip-card study screen** with tap-to-flip
- **Confidence color tagging** (green / yellow / red) per card
- **Strike-through** to mark a card done/mastered
- **Google sign-in + automatic Drive sync** — backs up to a hidden app-data
  folder in your Drive, whole-database last-write-wins sync
- **Sakura petal ambient background**, light pastel theme
- Installable PWA with offline app-shell caching

## Structure

```
index.html      deck dashboard, sign-in, sync status
create.html     add cards (type / draw / photo)
study.html      flip-card study session
css/theme.css   design tokens + glassmorphism
js/db.js        IndexedDB wrapper (decks, cards, blobs) + sync dirty-hook
js/sakura.js    falling petal canvas animation
js/study.js     study session logic
js/canvas-draw.js     handwriting capture
js/camera-capture.js  photo capture + compression
js/backup.js    export/import + payload builder used by Drive sync
js/auth.js      Google sign-in via Google Identity Services (GIS), requests Drive scope
js/drive-sync.js      Drive appDataFolder backup, auto-sync
manifest.json, sw.js  PWA install + offline caching
```

## Setting up Google sign-in + Drive sync

Sign-in uses Google Identity Services (GIS) directly rather than Firebase
Auth. Firebase's popup/redirect sign-in depends on shuttling data between
its authDomain (`*.firebaseapp.com`) and this app's origin via cross-site
storage, which mobile browsers increasingly block by default — it fails
silently (no error, sign-in just never completes) on some Android Chrome
setups. GIS talks to Google directly as a first-party flow instead.

1. In Google Cloud Console, create (or reuse) a project.
2. APIs & Services → enable the **Google Drive API**.
3. APIs & Services → **Google Auth Platform** → run the setup wizard:
   choose **External** audience, fill in app name/support email, and under
   **Audience** add your own Google account as a **test user** (keeps the
   app out of Google's review queue since it's for personal use).
4. APIs & Services → Credentials → **Create credentials → OAuth client ID**
   → Application type: **Web application**. Add your GitHub Pages origin
   (e.g. `https://akash-mehra.github.io`) under **Authorized JavaScript
   origins**. No redirect URI is needed since GIS's token client doesn't
   use one.
5. Copy the generated Client ID and paste it into `OAUTH_CLIENT_ID` in
   `js/auth.js`.

Sync is whole-database, last-write-wins — not a merge. If you edit on two
devices while both are offline before either syncs, whichever syncs last
overwrites the other. Fine for typical single-device-at-a-time use; worth
knowing if you ever go multi-device simultaneously.

## Notes

No backend beyond Google's own OAuth/Drive APIs. All flashcard data lives
in the browser's IndexedDB on-device, optionally backed up to your own
Google Drive (hidden app-data folder — Recall Manual is the only thing
that can see it). Local export/import to a JSON file is also available
without signing in at all.
