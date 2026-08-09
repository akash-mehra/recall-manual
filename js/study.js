/* study.js — SRS-driven study session.
   Flow: tap to flip -> see the answer -> rate recall (Again/Hard/Good/
   Easy) -> card gets rescheduled via srs.js and drops out of THIS
   session's queue (it's no longer due right now). "Study all cards"
   bypasses the due filter entirely for pre-exam cramming.
*/

(function () {
  const params = new URLSearchParams(window.location.search);
  const deckId = params.get('deck');
  if (!deckId) {
    window.location.href = 'index.html';
    return;
  }

  const STUDY_ALL_KEY = 'recall_manual_study_all_mode';

  const els = {
    deckName: document.getElementById('deckName'),
    progressText: document.getElementById('progressText'),
    progressFill: document.getElementById('progressFill'),
    cardStage: document.getElementById('cardStage'),
    card: document.getElementById('flipCard'),
    frontFace: document.getElementById('cardFront'),
    backFace: document.getElementById('cardBack'),
    ratingRow: document.getElementById('ratingRow'),
    retireBtn: document.getElementById('retireBtn'),
    flipHint: document.getElementById('flipHint'),
    emptyState: document.getElementById('emptyState'),
    completeState: document.getElementById('completeState'),
    studyArea: document.getElementById('studyArea'),
    restartBtn: document.getElementById('restartBtn'),
    studyAllToggle: document.getElementById('studyAllToggle'),
  };

  let allCards = [];
  let sessionCards = [];
  let sessionTotal = 0;
  let index = 0;
  let flipped = false;
  let studyAll = localStorage.getItem(STUDY_ALL_KEY) === '1';

  async function init() {
    const deck = await RecallDB.Decks.get(deckId);
    els.deckName.textContent = deck ? deck.name : 'Deck';
    allCards = await RecallDB.Cards.byDeck(deckId);
    els.studyAllToggle.checked = studyAll;
    buildSession();
    render();
  }

  function buildSession() {
    const now = Date.now();
    const pool = studyAll
      ? allCards.filter((c) => !c.struck)
      : allCards.filter((c) => RecallDB.Cards.isDue(c, now));
    sessionCards = pool.slice().sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));
    sessionTotal = sessionCards.length;
    index = 0;
  }

  function currentCard() {
    return sessionCards[index];
  }

  function faceContent(face) {
    if (!face) return '';
    if (face.imageBlob) {
      const url = URL.createObjectURL(face.imageBlob);
      return `<img src="${url}" alt="card image" class="card-image" />`;
    }
    return `<div class="card-text">${escapeHtml(face.text || '')}</div>`;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render() {
    if (sessionCards.length === 0) {
      els.studyArea.style.display = 'none';
      els.emptyState.style.display = allCards.length === 0 ? 'block' : 'none';
      els.completeState.style.display = allCards.length > 0 ? 'block' : 'none';
      return;
    }
    els.studyArea.style.display = 'block';
    els.emptyState.style.display = 'none';
    els.completeState.style.display = 'none';

    const card = currentCard();
    flipped = false;
    els.card.classList.remove('flipped');
    els.ratingRow.style.display = 'none';
    els.flipHint.style.display = 'block';

    els.frontFace.innerHTML = faceContent(card.front);
    els.backFace.innerHTML = faceContent(card.back);

    const doneCount = sessionTotal - sessionCards.length;
    els.progressText.textContent = `${doneCount} / ${sessionTotal} reviewed`;
    els.progressFill.style.width = sessionTotal ? `${(doneCount / sessionTotal) * 100}%` : '0%';

    updateRatingLabels(card);
  }

  function updateRatingLabels(card) {
    const preview = RecallSRS.previewIntervals(card);
    document.querySelectorAll('.rating-btn').forEach((btn) => {
      const rating = btn.dataset.rating;
      const label = btn.querySelector('.rating-interval');
      if (label) label.textContent = RecallSRS.formatInterval(preview[rating]);
    });
  }

  els.card.addEventListener('click', () => {
    if (flipped) return; // once flipped, use the rating buttons, not another tap
    flipped = true;
    els.card.classList.add('flipped');
    els.ratingRow.style.display = 'flex';
    els.flipHint.style.display = 'none';
  });

  document.querySelectorAll('.rating-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = currentCard();
      const rating = btn.dataset.rating;
      const result = RecallSRS.scheduleNext(card, rating);
      const updated = await RecallDB.Cards.update(card.id, result);
      await RecallDB.ReviewLog.add({ cardId: card.id, deckId, rating });
      Object.assign(card, updated);

      sessionCards.splice(index, 1);
      if (index >= sessionCards.length) index = 0;
      render();
    });
  });

  els.retireBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const card = currentCard();
    const updated = await RecallDB.Cards.update(card.id, { struck: true });
    Object.assign(card, updated);
    sessionCards.splice(index, 1);
    if (index >= sessionCards.length) index = 0;
    render();
  });

  els.restartBtn.addEventListener('click', () => {
    buildSession();
    render();
  });

  els.studyAllToggle.addEventListener('change', (e) => {
    studyAll = e.target.checked;
    localStorage.setItem(STUDY_ALL_KEY, studyAll ? '1' : '0');
    buildSession();
    render();
  });

  init();
})();
