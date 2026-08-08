/* canvas-draw.js — pointer-based drawing surface for handwritten flashcards.
   Works with finger, mouse, or stylus (pressure-aware via the Pointer
   Events API, which covers all three input types uniformly).

   Uses ONLY pointer events, not touch events too — registering both causes
   each stroke to fire twice on Android Chrome (which emits native pointer
   events for touch/stylus input independently of touch events), leading to
   stuttery, doubled-up lines.

   Sizing is LAZY: createDrawPad() may be called while the canvas's parent
   panel is still display:none (e.g. the "Draw" tab isn't selected yet).
   getBoundingClientRect() returns 0x0 for anything hidden that way, so
   sizing eagerly at construction time silently produces a 0x0 drawing
   buffer — the canvas LOOKS the right size on screen (CSS still stretches
   it) but there's nothing to actually draw into. ensureSized() is called
   every time the panel/side becomes visible instead, and only does real
   work the first time (or if the box was previously 0x0).
*/

const PENCIL_COLORS = {
  black: '#242021',
  red: '#c23b3b',
  blue: '#2e5fa3',
};
const HIGHLIGHTER_COLORS = {
  yellow: '#f5d90a',
  red: '#ff5c7a',
};

function createDrawPad(canvas) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let last = null;
  let hasContent = false;
  let sized = false;

  let currentColor = PENCIL_COLORS.black;
  let isHighlighter = false;

  function fillWhite() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function resizeToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false; // still hidden
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio); // scale applied ONCE, here, and nowhere else
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    fillWhite();
    sized = true;
    return true;
  }

  function ensureSized() {
    if (!sized) resizeToDisplaySize();
  }

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function lineWidthFor(e) {
    if (isHighlighter) return 14;
    if (e.pressure && e.pressure > 0) return 1.5 + e.pressure * 3.5;
    return 2.5;
  }

  function start(e) {
    if (!sized) resizeToDisplaySize(); // last-resort safety net
    e.preventDefault();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    drawing = true;
    hasContent = true;
    last = pos(e);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.globalAlpha = isHighlighter ? 0.45 : 1;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = lineWidthFor(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    last = p;
  }

  function end() {
    drawing = false;
    last = null;
  }

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.style.touchAction = 'none'; // let pointer events handle everything, no browser pan/zoom

  return {
    ensureSized,
    setTool(color, highlighter = false) {
      currentColor = color;
      isHighlighter = highlighter;
    },
    clear() {
      if (sized) fillWhite();
      hasContent = false;
    },
    isEmpty() {
      return !hasContent;
    },
    toBlob(type = 'image/png', quality = 0.92) {
      return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    },
  };
}

window.createDrawPad = createDrawPad;
window.PENCIL_COLORS = PENCIL_COLORS;
window.HIGHLIGHTER_COLORS = HIGHLIGHTER_COLORS;
