/* backup.js — export all decks/cards (with blobs base64-encoded) to a single
   JSON file, and import that file back in. This is the safety net for an
   on-device-only storage model with no cloud sync.
*/

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // data URL
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function base64ToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function serializeFace(face) {
  if (!face) return {};
  const out = {};
  if (face.kind) out.kind = face.kind;
  if (face.text) out.text = face.text;
  if (face.imageBlob) out.imageDataUrl = await blobToBase64(face.imageBlob);
  return out;
}

async function deserializeFace(face) {
  if (!face) return {};
  const out = {};
  if (face.kind) out.kind = face.kind;
  if (face.text) out.text = face.text;
  if (face.imageDataUrl) out.imageBlob = await base64ToBlob(face.imageDataUrl);
  return out;
}

async function buildExportPayload() {
  const decks = await RecallDB.Decks.all();
  const payload = { version: 1, exportedAt: new Date().toISOString(), decks: [] };

  for (const deck of decks) {
    const cards = await RecallDB.Cards.byDeck(deck.id);
    const serializedCards = [];
    for (const card of cards) {
      serializedCards.push({
        id: card.id,
        type: card.type,
        colorTag: card.colorTag,
        struck: card.struck,
        reviewCount: card.reviewCount,
        // SRS scheduling state — without these, every sync/export round
        // trip would silently reset review progress back to "new".
        dueDate: card.dueDate,
        interval: card.interval,
        easeFactor: card.easeFactor,
        lapses: card.lapses,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        front: await serializeFace(card.front),
        back: await serializeFace(card.back),
      });
    }
    payload.decks.push({
      id: deck.id,
      name: deck.name,
      subject: deck.subject,
      subtopic: deck.subtopic,
      createdAt: deck.createdAt,
      cards: serializedCards,
    });
  }

  return payload;
}

async function exportAllData() {
  const payload = await buildExportPayload();
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `recall-manual-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importDataFromFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  return importFromPayload(payload, { suffix: ' (imported)' });
}

async function importFromPayload(payload, { suffix = '' } = {}) {
  if (!payload || !Array.isArray(payload.decks)) {
    throw new Error('Not a valid Recall Manual backup file');
  }

  let deckCount = 0;
  let cardCount = 0;

  for (const deckData of payload.decks) {
    const deck = await RecallDB.Decks.create({
      name: deckData.name + suffix,
      subject: deckData.subject || '',
      subtopic: deckData.subtopic || '',
      createdAt: deckData.createdAt,
    });
    deckCount++;

    for (const cardData of deckData.cards || []) {
      await RecallDB.Cards.create({
        deckId: deck.id,
        type: cardData.type,
        colorTag: cardData.colorTag || null,
        struck: !!cardData.struck,
        dueDate: cardData.dueDate,
        interval: cardData.interval,
        easeFactor: cardData.easeFactor,
        lapses: cardData.lapses,
        reviewCount: cardData.reviewCount,
        front: await deserializeFace(cardData.front),
        back: await deserializeFace(cardData.back),
      });
      cardCount++;
    }
  }

  return { deckCount, cardCount };
}

/* Full-replace restore used by Drive sync: wipes local data and rebuilds it
   with the SAME ids as the backup, so this device's local state becomes
   byte-identical to what's on Drive (keeps future syncs consistent).
   Runs inside RecallDB.runSilently so it doesn't immediately re-trigger a
   push back to Drive.
*/
async function replaceAllDataFromPayload(payload) {
  if (!payload || !Array.isArray(payload.decks)) {
    throw new Error('Not a valid Recall Manual backup file');
  }
  await RecallDB.runSilently(async () => {
    await RecallDB.clearAllData();
    for (const deckData of payload.decks) {
      const deck = await RecallDB.Decks.create({
        id: deckData.id,
        name: deckData.name,
        subject: deckData.subject || '',
        subtopic: deckData.subtopic || '',
        createdAt: deckData.createdAt,
      });
      for (const cardData of deckData.cards || []) {
        await RecallDB.Cards.create({
          id: cardData.id,
          deckId: deck.id,
          type: cardData.type,
          colorTag: cardData.colorTag || null,
          struck: !!cardData.struck,
          dueDate: cardData.dueDate,
          interval: cardData.interval,
          easeFactor: cardData.easeFactor,
          lapses: cardData.lapses,
          reviewCount: cardData.reviewCount,
          createdAt: cardData.createdAt,
          front: await deserializeFace(cardData.front),
          back: await deserializeFace(cardData.back),
        });
      }
    }
  });
}

window.RecallBackup = {
  exportAllData,
  importDataFromFile,
  buildExportPayload,
  importFromPayload,
  replaceAllDataFromPayload,
};
