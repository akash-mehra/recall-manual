/* canvas-draw.js — pointer-based drawing surface for handwritten flashcards.
   Works with finger, mouse, or stylus (pressure-aware via the Pointer
   Events API, which covers all three input types uniformly).

   HIGHLIGHTER SMOOTHING: drawing many short semi-transparent line segments
   directly onto the canvas (one per pointermove) causes each segment's
   round line-cap to alpha-blend independently, so overlapping joints
   between segments build up extra opacity — visible as a "beaded" texture
   instead of one smooth translucent stroke. Fixed by drawing the current
   stroke onto an offscreen buffer at full opacity (where overlaps just
   overwrite cleanly), then compositing that whole buffer onto the visible
   canvas ONCE per frame at the target opacity — so the alpha is applied
   uniformly to the stroke's silhouette rather than per-segment.

   Sizing is LAZY: createDrawPad() may be called while the canvas's parent
   panel is still display:none. getBoundingClientRect() returns 0x0 for
   anything hidden that way, so sizing eagerly at construction time
   silently produces a 0x0 drawing buffer. ensureSized() is called instead
   whenever the panel/side actually becomes visible.
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

const DEFAULT_SIZES = { pencil: 2.5, highlighter: 14, eraser: 22 };
const DEFAULT_HIGHLIGHTER_OPACITY = 0.28;

function createDrawPad(canvas) {
  const ctx = canvas.getContext('2d');
  const strokeBuffer = document.createElement('canvas');
  const strokeCtx = strokeBuffer.getContext('2d');
  const snapshot = document.createElement('canvas');
  const snapshotCtx = snapshot.getContext('2d');

  let drawing = false;
  let last = null;
  let hasContent = false;
  let sized = false;

  let currentColor = PENCIL_COLORS.black;
  let isHighlighter = false;
  let isEraser = false;
  let highlighterOpacity = DEFAULT_HIGHLIGHTER_OPACITY;
  const sizes = { ...DEFAULT_SIZES };

  function activeCategory() {
    if (isEraser) return 'eraser';
    if (isHighlighter) return 'highlighter';
    return 'pencil';
  }

  function fillWhite(targetCtx, w, h) {
    targetCtx.save();
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, w, h);
    targetCtx.restore();
  }

  function resizeToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false; // still hidden
    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    fillWhite(ctx, canvas.width, canvas.height);

    strokeBuffer.width = canvas.width;
    strokeBuffer.height = canvas.height;
    strokeCtx.scale(ratio, ratio);
    strokeCtx.lineCap = 'round';
    strokeCtx.lineJoin = 'round';

    snapshot.width = canvas.width;
    snapshot.height = canvas.height;

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

  function currentSize() {
    return sizes[activeCategory()];
  }

  function lineWidthFor(e) {
    if (isEraser || isHighlighter) return currentSize();
    const base = sizes.pencil;
    if (e.pressure && e.pressure > 0) return base * (0.6 + e.pressure * 0.8);
    return base;
  }

  function start(e) {
    if (!sized) resizeToDisplaySize(); // last-resort safety net
    e.preventDefault();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    drawing = true;
    hasContent = true;
    last = pos(e);

    if (isHighlighter) {
      // Freeze the "before this stroke" pixels, and clear the stroke buffer
      // to fully transparent so this stroke builds up cleanly on its own.
      snapshotCtx.clearRect(0, 0, snapshot.width, snapshot.height);
      snapshotCtx.drawImage(canvas, 0, 0, snapshot.width, snapshot.height);
      strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
      strokeCtx.clearRect(0, 0, strokeBuffer.width, strokeBuffer.height);
      const ratio = window.devicePixelRatio || 1;
      strokeCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    const width = lineWidthFor(e);

    if (isHighlighter) {
      // Draw this segment opaque onto the stroke buffer (overlaps just
      // overwrite, no alpha buildup), then recomposite buffer -> visible
      // canvas once at the target opacity, on top of the frozen snapshot.
      strokeCtx.globalAlpha = 1;
      strokeCtx.strokeStyle = currentColor;
      strokeCtx.lineWidth = width;
      strokeCtx.beginPath();
      strokeCtx.moveTo(last.x, last.y);
      strokeCtx.lineTo(p.x, p.y);
      strokeCtx.stroke();

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(snapshot, 0, 0);
      ctx.globalAlpha = highlighterOpacity;
      ctx.drawImage(strokeBuffer, 0, 0);
      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
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
      isEraser = false;
    },
    setEraser() {
      isEraser = true;
      isHighlighter = false;
    },
    setSize(px) {
      sizes[activeCategory()] = px;
    },
    getSizeForActiveTool() {
      return currentSize();
    },
    getActiveCategory: activeCategory,
    setHighlighterOpacity(alpha) {
      highlighterOpacity = alpha;
    },
    getHighlighterOpacity() {
      return highlighterOpacity;
    },
    clear() {
      if (sized) fillWhite(ctx, canvas.width, canvas.height);
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
window.DEFAULT_SIZES = DEFAULT_SIZES;
window.DEFAULT_HIGHLIGHTER_OPACITY = DEFAULT_HIGHLIGHTER_OPACITY;
