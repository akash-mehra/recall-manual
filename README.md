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
- **Dark theme** — night sky palette, a small moon, and sparse shooting stars
- **Spaced repetition (SM-2-derived)** — Again/Hard/Good/Easy ratings
  reschedule each card; the dashboard shows how many are due per deck
- **Card editing** and **undo-capable delete** for both cards and decks
- **Search** across every deck's typed card text
- **Stats** — total reviews, accuracy, day streak, per-deck breakdown
- **Offline indicator** — banner shown while the browser has no connectivity
- Installable PWA with offline app-shell caching

## Structure

```
index.html      deck dashboard, sign-in, sync status, due-count badges
create.html     add or edit cards (type / draw / photo), per-side content type
study.html      SRS study session — flip, then rate Again/Hard/Good/Easy
settings.html   account, backup frequency, manage/delete decks & cards, theme
library.html    grid of every photo-type card across all decks
search.html     full-text search across all decks' typed card content
stats.html      review history, accuracy, streak, per-deck breakdown
css/theme.css   design tokens + glassmorphism + dark theme overrides
js/db.js        IndexedDB wrapper (decks, cards, reviewLog) + sync dirty-hook
js/srs.js       SM-2-derived scheduling (Again/Hard/Good/Easy)
js/sakura.js    falling petal canvas animation (light theme)
js/stars.js     starfield + shooting stars canvas animation (dark theme)
js/theme.js     light/dark theme switching, moon element
js/offline.js   offline status banner
js/study.js     study session logic
js/canvas-draw.js     handwriting capture (pencil/highlighter/eraser)
js/camera-capture.js  photo capture + compression
js/backup.js    export/import + payload builder used by Drive sync
js/auth.js      Google sign-in via Google Identity Services, requests Drive scope
js/drive-sync.js      Drive appDataFolder backup, configurable frequency
js/nav.js       flushes pending sync before any deliberate in-app navigation
manifest.json, sw.js  PWA install + offline caching (network-first for JS/HTML)
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
