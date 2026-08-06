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
  if (face.text) out.text = face.text;
  if (face.imageBlob) out.imageDataUrl = await blobToBase64(face.imageBlob);
  return out;
}

async function deserializeFace(face) {
  if (!face) return {};
  const out = {};
  if (face.text) out.text = face.text;
  if (face.imageDataUrl) out.imageBlob = await base64ToBlob(face.imageDataUrl);
  return out;
}

async function exportAllData() {
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
  if (!payload || !Array.isArray(payload.decks)) {
    throw new Error('Not a valid Recall Manual backup file');
  }

  let deckCount = 0;
  let cardCount = 0;

  for (const deckData of payload.decks) {
    const deck = await RecallDB.Decks.create({
      name: deckData.name + ' (imported)',
      subject: deckData.subject || '',
      subtopic: deckData.subtopic || '',
    });
    deckCount++;

    for (const cardData of deckData.cards || []) {
      await RecallDB.Cards.create({
        deckId: deck.id,
        type: cardData.type,
        colorTag: cardData.colorTag || null,
        struck: !!cardData.struck,
        front: await deserializeFace(cardData.front),
        back: await deserializeFace(cardData.back),
      });
      cardCount++;
    }
  }

  return { deckCount, cardCount };
}

window.RecallBackup = { exportAllData, importDataFromFile };
