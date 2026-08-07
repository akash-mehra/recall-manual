/* canvas-draw.js — pointer-based drawing surface for handwritten flashcards.
   Works with finger, mouse, or stylus (pressure-aware via the Pointer
   Events API, which covers all three input types uniformly).

   Uses ONLY pointer events, not touch events too — registering both causes
   each stroke to fire twice on Android Chrome (which emits native pointer
   events for touch/stylus input independently of touch events), leading to
   stuttery, doubled-up lines.
*/

function createDrawPad(canvas) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let last = null;
  let hasContent = false;

  function resizeToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio); // scale is applied ONCE, here, and nowhere else
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#5b3b4c';
    fillWhite();
  }

  function fillWhite() {
    // Fill in device-pixel space (identity transform), then restore back to
    // whatever scale was already active — restore() alone puts that scale
    // back correctly, so we must NOT re-apply ctx.scale() again afterward.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  resizeToDisplaySize();

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function lineWidthFor(e) {
    if (e.pressure && e.pressure > 0) return 1.5 + e.pressure * 3.5;
    return 2.5;
  }

  function start(e) {
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
    ctx.lineWidth = lineWidthFor(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
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
    clear() {
      fillWhite();
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
