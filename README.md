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
- **Sakura petal ambient background**, light pastel theme
- Installable PWA with offline app-shell caching

## Structure

```
index.html      deck dashboard
create.html     add cards (type / draw / photo)
study.html      flip-card study session
css/theme.css   design tokens + glassmorphism
js/db.js        IndexedDB wrapper (decks, cards, blobs)
js/sakura.js    falling petal canvas animation
js/study.js     study session logic
js/canvas-draw.js     handwriting capture
js/camera-capture.js  photo capture + compression
manifest.json, sw.js  PWA install + offline caching
```

## Notes

No backend, no AI calls, no accounts. All data lives in the browser's
IndexedDB on-device. Clearing site data / browser storage will remove it,
so back up important decks if needed (export/import is a planned addition).
