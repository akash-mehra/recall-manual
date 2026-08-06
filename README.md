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
js/firebase-init.js   Firebase config (fill in your own project values)
js/auth.js      Google sign-in via Firebase, requests Drive scope
js/drive-sync.js      Drive appDataFolder backup, silent token refresh, auto-sync
manifest.json, sw.js  PWA install + offline caching
```

## Setting up Google sign-in + Drive sync

1. Create a Firebase project, register a web app, copy the config into
   `js/firebase-init.js` (replace the `REPLACE_ME` placeholders).
2. Enable the Google sign-in provider in Firebase Authentication, and add
   your GitHub Pages domain under Authorized domains.
3. In the same Google Cloud project, enable the Google Drive API.
4. Configure the OAuth consent screen (Testing mode is fine for personal use;
   add yourself as a test user).
5. Grab the auto-created "Web client" OAuth Client ID from Google Cloud
   Console → Credentials, and paste it into `googleOAuthClientId` in
   `js/firebase-init.js`.

Sync is whole-database, last-write-wins — not a merge. If you edit on two
devices while both are offline before either syncs, whichever syncs last
overwrites the other. Fine for typical single-device-at-a-time use; worth
knowing if you ever go multi-device simultaneously.

## Notes

No backend beyond Firebase Auth + Drive. All flashcard data lives in the
browser's IndexedDB on-device, optionally backed up to your own Google
Drive (hidden app-data folder — Recall Manual is the only thing that can
see it). Local export/import to a JSON file is also available without
signing in at all.
