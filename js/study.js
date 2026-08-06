/* study.js — session runner for the flip-card study screen.
   Behavior ported from the original Recall app:
   - tap/click card to flip between front and back
   - color-tag cycle (none -> green -> yellow -> red -> none) as a confidence marker
   - strike toggle marks a card as done/mastered, greys it out with a line-through
*/

(function () {
  const params = new URLSearchParams(window.location.search);
  const deckId = params.get('deck');
  if (!deckId) {
    window.location.href = 'index.html';
    return;
  }

  const els = {
    deckName: document.getElementById('deckName'),
    progressText: document.getElementById('progressText'),
    progressFill: document.getElementById('progressFill'),
    cardStage: document.getElementById('cardStage'),
    card: document.getElementById('flipCard'),
    frontFace: document.getElementById('cardFront'),
    backFace: document.getElementById('cardBack'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    strikeBtn: document.getElementById('strikeBtn'),
    colorDots: document.querySelectorAll('.color-dot'),
    emptyState: document.getElementById('emptyState'),
    completeState: document.getElementById('completeState'),
    studyArea: document.getElementById('studyArea'),
    restartBtn: document.getElementById('restartBtn'),
    hideStruckToggle: document.getElementById('hideStruckToggle'),
  };

  let allCards = [];
  let sessionCards = [];
  let index = 0;
  let flipped = false;
  let hideStruck = false;

  async function init() {
    const deck = await RecallDB.Decks.get(deckId);
    els.deckName.textContent = deck ? deck.name : 'Deck';
    allCards = await RecallDB.Cards.byDeck(deckId);
    buildSession();
    render();
  }

  function buildSession() {
    sessionCards = hideStruck ? allCards.filter((c) => !c.struck) : allCards.slice();
    if (index >= sessionCards.length) index = 0;
  }

  function currentCard() {
    return sessionCards[index];
  }

  function faceContent(face) {
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

    els.frontFace.innerHTML = faceContent(card.front || {});
    els.backFace.innerHTML = faceContent(card.back || {});

    els.card.classList.toggle('struck', !!card.struck);
    applyColorClass(card.colorTag);

    els.progressText.textContent = `${index + 1} / ${sessionCards.length}`;
    els.progressFill.style.width = `${((index + 1) / sessionCards.length) * 100}%`;

    els.prevBtn.disabled = index === 0;
    els.nextBtn.textContent = index === sessionCards.length - 1 ? 'Finish' : 'Next';

    els.colorDots.forEach((dot) => {
      dot.classList.toggle('selected', dot.dataset.color === card.colorTag);
    });
  }

  function applyColorClass(color) {
    els.card.classList.remove('tag-green', 'tag-yellow', 'tag-red');
    if (color) els.card.classList.add(`tag-${color}`);
  }

  els.card.addEventListener('click', () => {
    flipped = !flipped;
    els.card.classList.toggle('flipped', flipped);
  });

  els.nextBtn.addEventListener('click', () => {
    if (index < sessionCards.length - 1) {
      index++;
      render();
    } else {
      els.studyArea.style.display = 'none';
      els.completeState.style.display = 'block';
    }
  });

  els.prevBtn.addEventListener('click', () => {
    if (index > 0) {
      index--;
      render();
    }
  });

  els.strikeBtn.addEventListener('click', async () => {
    const card = currentCard();
    const updated = await RecallDB.Cards.update(card.id, { struck: !card.struck });
    Object.assign(card, updated);
    if (hideStruck && card.struck) {
      buildSession();
    }
    render();
  });

  els.colorDots.forEach((dot) => {
    dot.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = currentCard();
      const color = dot.dataset.color;
      const next = card.colorTag === color ? null : color;
      const updated = await RecallDB.Cards.update(card.id, { colorTag: next });
      Object.assign(card, updated);
      render();
    });
  });

  els.restartBtn.addEventListener('click', () => {
    index = 0;
    buildSession();
    render();
  });

  els.hideStruckToggle.addEventListener('change', (e) => {
    hideStruck = e.target.checked;
    index = 0;
    buildSession();
    render();
  });

  init();
})();
