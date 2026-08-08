/* stars.js — dark-theme ambient background.
   Two layers:
   1. A static field of small twinkling stars scattered across the sky —
      this is the actual "starry sky", always present, doesn't move.
   2. Occasional shooting stars: fast diagonal streaks with a fading light
      trail behind them, the way a real meteor looks — not slow drifting
      dots. These spawn every couple of seconds, one or occasionally two
      at a time, then are gone.
*/

(function () {
  function initStars(canvasId = 'sakura-canvas') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w, h;
    let staticStars = [];

    function generateStaticStars() {
      const density = 9000; // px^2 per star — tune for how packed the sky feels
      const count = Math.floor((w * h) / density);
      staticStars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.6 + Math.random() * 1.3,
        baseOpacity: 0.35 + Math.random() * 0.5,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.006 + Math.random() * 0.014,
      }));
    }

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      generateStaticStars();
    }
    resize();
    window.addEventListener('resize', resize);

    function drawStaticSky() {
      for (const s of staticStars) {
        s.twinklePhase += s.twinkleSpeed;
        const twinkle = 0.55 + 0.45 * Math.sin(s.twinklePhase);
        ctx.globalAlpha = s.baseOpacity * twinkle;
        ctx.fillStyle = '#f5f1ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Draw the sky once, statically, and stop — no meteors, no animation loop.
      drawStaticSky();
      return;
    }

    let shootingStars = [];
    let spawnTimer = null;

    function makeShootingStar() {
      const startX = w * (0.1 + Math.random() * 0.6);
      const startY = h * Math.random() * 0.3;
      const angle = Math.PI / 4 + (Math.random() * 0.3 - 0.15); // ~45°, slight variance
      const speed = 11 + Math.random() * 7; // fast — this is the whole point
      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 35 + Math.random() * 15,
        trail: [],
      });
    }

    function spawnBatch() {
      makeShootingStar();
      if (Math.random() < 0.2) makeShootingStar(); // occasionally two at once
      spawnTimer = setTimeout(spawnBatch, 2000 + Math.random() * 1500); // every ~2-3.5s
    }
    spawnBatch();

    function drawShootingStars() {
      shootingStars.forEach((s) => {
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 16) s.trail.shift();
        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        for (let i = 0; i < s.trail.length - 1; i++) {
          const t = i / s.trail.length;
          ctx.globalAlpha = t * 0.75;
          ctx.strokeStyle = '#f9f6ff';
          ctx.lineWidth = 1.6 * t + 0.3;
          ctx.beginPath();
          ctx.moveTo(s.trail[i].x, s.trail[i].y);
          ctx.lineTo(s.trail[i + 1].x, s.trail[i + 1].y);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      });
      shootingStars = shootingStars.filter(
        (s) => s.life < s.maxLife && s.x < w + 60 && s.y < h + 60
      );
      ctx.globalAlpha = 1;
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      drawStaticSky();
      drawShootingStars();
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
