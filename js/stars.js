/* stars.js — ambient dark-theme background: a few stars drift down every
   2-3 seconds, twinkling faintly, then fade past the bottom. Deliberately
   sparse (unlike sakura.js's continuous petal stream) so it reads as a
   quiet night sky rather than a snow effect.
*/

(function () {
  function initStars(canvasId = 'sakura-canvas') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w, h;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let stars = [];
    let spawnTimer = null;

    function spawnBatch() {
      const count = 1 + Math.floor(Math.random() * 3); // 1-3 stars per batch
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: -10,
          size: 1.3 + Math.random() * 1.8,
          speedY: 0.25 + Math.random() * 0.35,
          drift: (Math.random() - 0.5) * 0.25,
          opacity: 0.55 + Math.random() * 0.4,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.03 + Math.random() * 0.03,
        });
      }
      spawnTimer = setTimeout(spawnBatch, 2000 + Math.random() * 1000); // every 2-3s
    }
    spawnBatch();

    function drawStar(s) {
      const twinkle = 0.65 + 0.35 * Math.sin(s.twinklePhase);
      ctx.save();
      ctx.globalAlpha = s.opacity * twinkle;
      ctx.fillStyle = '#f5f1ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      // faint sparkle cross on the slightly larger stars
      if (s.size > 2.2) {
        ctx.strokeStyle = '#f5f1ff';
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = s.opacity * twinkle * 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x - s.size * 2, s.y);
        ctx.lineTo(s.x + s.size * 2, s.y);
        ctx.moveTo(s.x, s.y - s.size * 2);
        ctx.lineTo(s.x, s.y + s.size * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y += s.speedY;
        s.x += s.drift;
        s.twinklePhase += s.twinkleSpeed;
        drawStar(s);
      }
      stars = stars.filter((s) => s.y < h + 20);
      requestAnimationFrame(tick);
    }
    tick();

    return () => {
      clearTimeout(spawnTimer);
      window.removeEventListener('resize', resize);
    };
  }

  window.initStars = initStars;
})();
