/* db.js — IndexedDB layer for Recall Manual
   Stores: decks, cards (with inline blobs for handwriting/photo cards)
   Chosen over localStorage because handwriting + photo cards need real
   storage headroom (localStorage caps out around 5-10MB per origin).
*/

const DB_NAME = 'recall_manual_db';
const DB_VERSION = 1;

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
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

function uid() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

async function tx(storeName, mode) {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

/* ---------- Decks ---------- */

const Decks = {
  async create({ name, subject = '', subtopic = '' }) {
    const store = await tx('decks', 'readwrite');
    const deck = {
      id: uid(),
      name,
      subject,
      subtopic,
      createdAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const r = store.add(deck);
      r.onsuccess = () => resolve(deck);
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
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },
};

/* ---------- Cards ---------- */
/* card shape:
   {
     id, deckId, type: 'text' | 'handwriting' | 'photo',
     front: { text?: string, imageBlob?: Blob },
     back:  { text?: string, imageBlob?: Blob },
     colorTag: null | 'red' | 'yellow' | 'green',
     struck: boolean,
     reviewCount: number,
     createdAt, updatedAt
   }
*/

const Cards = {
  async create(card) {
    const store = await tx('cards', 'readwrite');
    const full = {
      id: uid(),
      colorTag: null,
      struck: false,
      reviewCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...card,
    };
    return new Promise((resolve, reject) => {
      const r = store.add(full);
      r.onsuccess = () => resolve(full);
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

  async update(id, patch) {
    const store = await tx('cards', 'readwrite');
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return reject(new Error('Card not found'));
        const updated = { ...existing, ...patch, updatedAt: Date.now() };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async remove(id) {
    const store = await tx('cards', 'readwrite');
    return new Promise((resolve, reject) => {
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },

  async count(deckId) {
    const cards = await Cards.byDeck(deckId);
    return cards.length;
  },
};

async function estimateStorage() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return null;
}

window.RecallDB = { Decks, Cards, estimateStorage, uid };
