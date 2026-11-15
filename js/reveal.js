// reveal.js — the release ceremony.
// A full-screen overlay: embers rise on canvas while the letter
// appears line by line. With prefers-reduced-motion the ceremony is
// instant. The letter's status is flipped to "released" BEFORE this
// runs, so a refresh mid-ceremony never loses the release.

function prefersReducedMotion() {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function startEmbers(canvas) {
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let particles = [];
  let running = true;

  function resize() {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
  }
  resize();
  window.addEventListener('resize', resize);

  function spawn() {
    return {
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      r: (Math.random() * 1.8 + 0.6) * devicePixelRatio,
      vy: -(Math.random() * 0.55 + 0.25) * devicePixelRatio,
      vx: (Math.random() - 0.5) * 0.3 * devicePixelRatio,
      life: 1,
      decay: Math.random() * 0.0016 + 0.0006,
      hue: 32 + Math.random() * 18,
    };
  }
  for (let i = 0; i < 70; i++) {
    const p = spawn();
    p.y = Math.random() * canvas.height;
    particles.push(p);
  }

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx + Math.sin(p.y * 0.004) * 0.2 * devicePixelRatio;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0 || p.y < -12) Object.assign(p, spawn());
      const alpha = Math.max(0, Math.min(1, p.life)) * 0.85;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, ${alpha})`;
      ctx.shadowColor = `hsla(${p.hue}, 90%, 55%, 0.9)`;
      ctx.shadowBlur = 8 * devicePixelRatio;
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  }
  tick();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}

export function playReveal({ title, body, recipientName, onDone }) {
  const overlay = document.createElement('div');
  overlay.className = 'ceremony';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Letter release ceremony');
  overlay.innerHTML = `
    <canvas class="ceremony-canvas" aria-hidden="true"></canvas>
    <div class="ceremony-inner">
      <p class="ceremony-kicker">A letter, released</p>
      <h2 class="ceremony-title"></h2>
      <p class="ceremony-to"></p>
      <div class="ceremony-body"></div>
      <button class="btn btn-gold ceremony-close" type="button">Keep this letter</button>
    </div>`;

  overlay.querySelector('.ceremony-title').textContent = title;
  overlay.querySelector('.ceremony-to').textContent = recipientName
    ? `For ${recipientName}`
    : 'For someone loved';
  const bodyEl = overlay.querySelector('.ceremony-body');

  const reduced = prefersReducedMotion();
  const lines = String(body || '').split('\n');

  if (reduced) {
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line === '' ? '\u00a0' : line;
      bodyEl.appendChild(p);
    }
  } else {
    lines.forEach((line, i) => {
      const p = document.createElement('p');
      p.className = 'ceremony-line';
      p.textContent = line === '' ? '\u00a0' : line;
      p.style.animationDelay = `${0.9 + i * 0.45}s`;
      bodyEl.appendChild(p);
    });
  }

  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  // Remember what had focus before the overlay opened so we can restore it.
  const previouslyFocused = document.activeElement;

  const stopEmbers = reduced ? () => {} : startEmbers(overlay.querySelector('.ceremony-canvas'));

  const closeBtn = overlay.querySelector('.ceremony-close');

  // Move focus into the overlay.
  closeBtn.focus();

  // Focus trap: keep Tab and Shift+Tab inside the overlay.
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(
      overlay.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (focusable.length === 0) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  overlay.addEventListener('keydown', trapFocus);

  const close = () => {
    overlay.removeEventListener('keydown', trapFocus);
    stopEmbers();
    overlay.remove();
    document.body.classList.remove('no-scroll');
    // Return focus to whatever triggered the ceremony.
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
    if (typeof onDone === 'function') onDone();
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener(
    'keydown',
    function onKey(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close();
      }
    }
  );
}
