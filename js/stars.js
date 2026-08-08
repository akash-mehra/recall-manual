/* stars.js — dark-theme ambient background.
   Two layers:
   1. A static field of twinkling sparkle-shaped stars — the actual "sky",
      always present, doesn't move, varies in size/color for depth.
   2. Occasional shooting stars: fast diagonal streaks with a fading light
      trail, spawning every couple of seconds.

   Canvas is sized at devicePixelRatio resolution and scaled via a single
   setTransform() call (absolute, not cumulative — avoids the double-scale
   blur bug the drawing canvas hit earlier). Without this, everything here
   renders at CSS-pixel resolution and gets upscaled by the browser, which
   is why it looked soft before.
*/

(function () {
  function initStars(canvasId = 'sakura-canvas') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w, h;
    let staticStars = [];

    function generateStaticStars() {
      const density = 8500; // css-px^2 per star
      const count = Math.floor((w * h) / density);
      const palette = ['#ffffff', '#ffffff', '#e7defa', '#dbe8fb']; // mostly white, a little variety
      staticStars = Array.from({ length: count }, () => {
        const isBright = Math.random() < 0.12;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          size: isBright ? 1.8 + Math.random() * 1.1 : 0.7 + Math.random() * 0.9,
          color: palette[Math.floor(Math.random() * palette.length)],
          baseOpacity: isBright ? 0.75 + Math.random() * 0.25 : 0.35 + Math.random() * 0.4,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.015 + Math.random() * 0.025,
          sparkle: isBright, // only brighter stars get the +-shaped sparkle rays
        };
      });
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // absolute — never compounds across resizes
      generateStaticStars();
    }
    resize();
    window.addEventListener('resize', resize);

    function drawSparkleStar(s, twinkle) {
      const alpha = s.baseOpacity * twinkle;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;

      // core
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 0.42, 0, Math.PI * 2);
      ctx.fill();

      if (s.sparkle) {
        const rayLen = s.size * 2.6;
        ctx.strokeStyle = s.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.5, s.size * 0.16);
        ctx.globalAlpha = alpha * 0.85;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - rayLen);
        ctx.lineTo(s.x, s.y + rayLen);
        ctx.moveTo(s.x - rayLen, s.y);
        ctx.lineTo(s.x + rayLen, s.y);
        ctx.stroke();
      }
    }

    function drawStaticSky() {
      for (const s of staticStars) {
        s.twinklePhase += s.twinkleSpeed;
        const twinkle = 0.4 + 0.6 * Math.max(0, Math.sin(s.twinklePhase));
        drawSparkleStar(s, twinkle);
      }
      ctx.globalAlpha = 1;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      drawStaticSky();
      return;
    }

    let shootingStars = [];
    let spawnTimer = null;

    function makeShootingStar() {
      const startX = w * (0.1 + Math.random() * 0.6);
      const startY = h * Math.random() * 0.3;
      const angle = Math.PI / 4 + (Math.random() * 0.3 - 0.15);
      const speed = 11 + Math.random() * 7;
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
      if (Math.random() < 0.2) makeShootingStar();
      spawnTimer = setTimeout(spawnBatch, 2000 + Math.random() * 1500);
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
