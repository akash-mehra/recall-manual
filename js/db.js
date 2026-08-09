/* db.js — IndexedDB layer for Recall Manual
   Stores: decks, cards (with inline blobs for handwriting/photo cards),
   reviewLog (one row per rating, powers session stats/accuracy)
   Chosen over localStorage because handwriting + photo cards need real
   storage headroom (localStorage caps out around 5-10MB per origin).
*/

const DB_NAME = 'recall_manual_db';
const DB_VERSION = 2;

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('decks')) {
        const decks = db.createObjectStore('decks', { keyPath: 'id' });
        decks.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('cards')) {
        const cards = db.createObjectStore('cards', { keyPath: 'id' });
        cards.createIndex('deckId', 'deckId');
        cards.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('reviewLog')) {
        const log = db.createObjectStore('reviewLog', { keyPath: 'id' });
        log.createIndex('timestamp', 'timestamp');
        log.createIndex('deckId', 'deckId');
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

function uid() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

let dirtySuppressed = false;

function markDirty() {
  if (!dirtySuppressed && window.RecallSync && window.RecallSync.markDirty) {
    window.RecallSync.markDirty();
  }
}

async function runSilently(asyncFn) {
  dirtySuppressed = true;
  try {
    return await asyncFn();
  } finally {
    dirtySuppressed = false;
  }
}

async function tx(storeName, mode) {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

/* ---------- Decks ---------- */

const Decks = {
  async create({ id, name, subject = '', subtopic = '', createdAt } = {}) {
    const store = await tx('decks', 'readwrite');
    const deck = {
      id: id || uid(),
      name,
      subject,
      subtopic,
      createdAt: createdAt || Date.now(),
    };
    return new Promise((resolve, reject) => {
      const r = store.add(deck);
      r.onsuccess = () => { markDirty(); resolve(deck); };
      r.onerror = () => reject(r.error);
    });
  },

  async all() {
    const store = await tx('decks', 'readonly');
    return new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result.sort((a, b) => b.createdAt - a.createdAt));
      r.onerror = () => reject(r.error);
    });
  },

  async get(id) {
    const store = await tx('decks', 'readonly');
    return new Promise((resolve, reject) => {
      const r = store.get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },

  async remove(id) {
    const cardStore = await tx('cards', 'readwrite');
    const idx = cardStore.index('deckId');
    await new Promise((resolve, reject) => {
      const r = idx.getAllKeys(id);
      r.onsuccess = async () => {
        for (const key of r.result) cardStore.delete(key);
        resolve();
      };
      r.onerror = () => reject(r.error);
    });
    const deckStore = await tx('decks', 'readwrite');
    return new Promise((resolve, reject) => {
      const r = deckStore.delete(id);
      r.onsuccess = () => { markDirty(); resolve(); };
      r.onerror = () => reject(r.error);
    });
  },

  async clearAll() {
    const store = await tx('decks', 'readwrite');
    return new Promise((resolve, reject) => {
      const r = store.clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },
};

/* ---------- Cards ---------- */
/* card shape:
   {
     id, deckId, type: legacy summary field, front/back each carry their own kind now,
     front: { kind: 'text'|'draw'|'photo', text?: string, imageBlob?: Blob },
     back:  { kind: 'text'|'draw'|'photo', text?: string, imageBlob?: Blob },
     colorTag: null | 'red' | 'yellow' | 'green',   // legacy manual marker, still supported
     struck: boolean,   // manual "exclude from review" override, independent of scheduling
     createdAt, updatedAt,

     -- Spaced repetition (SM-2-derived) --
     dueDate: number (ms epoch) — when this card should next be shown. Cards
       created before SRS existed won't have this field; treat missing as
       "due now" (see Cards.isDue below) rather than backfilling on read,
       so old data doesn't need a migration pass.
     interval: number (days) — current spacing, 0 for a never-reviewed card
     easeFactor: number — SM-2 ease, starts at 2.5
     reviewCount: number — total times rated
     lapses: number — times rated "again"
   }
*/

const DEFAULT_EASE = 2.5;

function isDue(card, now = Date.now()) {
  if (card.struck) return false;
  if (card.dueDate == null) return true; // never scheduled (new or pre-SRS card) — due now
  return card.dueDate <= now;
}

const Cards = {
  async create(card) {
    const store = await tx('cards', 'readwrite');
    const full = {
      id: card.id || uid(),
      colorTag: null,
      struck: false,
      reviewCount: 0,
      lapses: 0,
      interval: 0,
      easeFactor: DEFAULT_EASE,
      dueDate: Date.now(), // new cards are due immediately
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...card,
    };
    return new Promise((resolve, reject) => {
      const r = store.add(full);
      r.onsuccess = () => { markDirty(); resolve(full); };
      r.onerror = () => reject(r.error);
    });
  },

  async byDeck(deckId) {
    const store = await tx('cards', 'readonly');
    const idx = store.index('deckId');
    return new Promise((resolve, reject) => {
      const r = idx.getAll(deckId);
      r.onsuccess = () => resolve(r.result.sort((a, b) => a.createdAt - b.createdAt));
      r.onerror = () => reject(r.error);
    });
  },

  async get(id) {
    const store = await tx('cards', 'readonly');
    return new Promise((resolve, reject) => {
      const r = store.get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },

  async dueInDeck(deckId, now = Date.now()) {
    const cards = await Cards.byDeck(deckId);
    return cards.filter((c) => isDue(c, now));
  },

  isDue,

  async update(id, patch) {
    const store = await tx('cards', 'readwrite');
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return reject(new Error('Card not found'));
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        const putReq = store.put(updated);
        putReq.onsuccess = () => { markDirty(); resolve(updated); };
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async remove(id) {
    const store = await tx('cards', 'readwrite');
    return new Promise((resolve, reject) => {
      const r = store.delete(id);
      r.onsuccess = () => { markDirty(); resolve(); };
      r.onerror = () => reject(r.error);
    });
  },

  async count(deckId) {
    const cards = await Cards.byDeck(deckId);
    return cards.length;
  },

  async clearAll() {
    const store = await tx('cards', 'readwrite');
    return new Promise((resolve, reject) => {
      const r = store.clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },
};

async function clearAllData() {
  await Cards.clearAll();
  await Decks.clearAll();
  await ReviewLog.clearAll();
}

/* ---------- Review log ---------- */
/* One row per rating event — powers session stats/accuracy.
   { id, cardId, deckId, rating: 'again'|'hard'|'good'|'easy', timestamp }
   Deliberately NOT synced to Drive (backup.js doesn't touch this store) —
   it's local usage history, not content, and would bloat the backup file
   for no real benefit.
*/
const ReviewLog = {
  async add({ cardId, deckId, rating }) {
    const store = await tx('reviewLog', 'readwrite');
    const entry = { id: uid(), cardId, deckId, rating, timestamp: Date.now() };
    return new Promise((resolve, reject) => {
      const r = store.add(entry);
      r.onsuccess = () => resolve(entry);
      r.onerror = () => reject(r.error);
    });
  },

  async since(timestamp) {
    const store = await tx('reviewLog', 'readonly');
    const idx = store.index('timestamp');
    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.lowerBound(timestamp);
      const r = idx.getAll(range);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },

  async all() {
    const store = await tx('reviewLog', 'readonly');
    return new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },

  async clearAll() {
    const store = await tx('reviewLog', 'readwrite');
    return new Promise((resolve, reject) => {
      const r = store.clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },
};

async function estimateStorage() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return null;
}

window.RecallDB = { Decks, Cards, ReviewLog, estimateStorage, uid, runSilently, clearAllData };
