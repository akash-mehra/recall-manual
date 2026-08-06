/* sakura.js — ambient falling petal layer.
   Sits in a fixed full-screen canvas behind app content (z-index handled in CSS).
   Petals are drawn as soft rounded shapes, not images, so no asset loading needed.
*/

(function () {
  function initSakura(canvasId = 'sakura-canvas', density = 22) {
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

    const colors = ['#F9C5D5', '#F7A8C4', '#FBD9E4', '#F2A6BE'];

    function makePetal() {
      return {
        x: Math.random() * w,
        y: Math.random() * -h,
        size: 6 + Math.random() * 8,
        speedY: 0.4 + Math.random() * 0.9,
        speedX: 0.3 + Math.random() * 0.6,
        drift: Math.random() * Math.PI * 2,
        driftSpeed: 0.01 + Math.random() * 0.02,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.03,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.55 + Math.random() * 0.35,
      };
    }

    const petals = Array.from({ length: density }, makePetal);

    function drawPetal(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      // simple petal shape: two overlapping curves forming a leaf/petal silhouette
      ctx.moveTo(0, -p.size);
      ctx.quadraticCurveTo(p.size * 0.8, -p.size * 0.4, 0, p.size);
      ctx.quadraticCurveTo(-p.size * 0.8, -p.size * 0.4, 0, -p.size);
      ctx.fill();
      ctx.restore();
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const p of petals) {
        p.drift += p.driftSpeed;
        p.y += p.speedY;
        p.x += Math.sin(p.drift) * p.speedX;
        p.rotation += p.rotationSpeed;

        if (p.y > h + 20) {
          p.y = -20;
          p.x = Math.random() * w;
        }
        if (p.x > w + 20) p.x = -20;
        if (p.x < -20) p.x = w + 20;

        drawPetal(p);
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  window.initSakura = initSakura;
})();
