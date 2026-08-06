/* canvas-draw.js — pointer-based drawing surface for handwritten flashcards.
   Works with finger, mouse, or stylus (pressure-aware where the device exposes it).
*/

function createDrawPad(canvas) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let last = null;
  let hasContent = false;

  function resizeToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const prevData = canvas.toDataURL();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#5b3b4c';
    fillWhite();
  }

  function fillWhite() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const ratio = window.devicePixelRatio || 1;
    ctx.scale(ratio, ratio);
  }

  resizeToDisplaySize();

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function lineWidthFor(e) {
    if (e.pressure && e.pressure > 0) return 1.5 + e.pressure * 3.5;
    return 2.5;
  }

  function start(e) {
    e.preventDefault();
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
  window.addEventListener('pointerup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

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
