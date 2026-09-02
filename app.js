(() => {
  'use strict';

  // Prototype tuning values: intentionally centralized for quick iteration.
  const CONFIG = {
    turns: 24,
    cols: 90,
    rows: 140,
    homeRadius: 5,
    brushRadius: 2,
    brushMaxLength: 28,
    splash: {
      mediumCount: [3, 5],
      smallCount: [1, 5],
      mediumRadius: [4, 7],
      smallRadius: [1, 3],
      spread: 18,
    },
    resources: {
      visible: 7,
      hidden: 15,
      minHomeDistance: 18,
    },
  };

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const boardWrap = document.getElementById('boardWrap');
  const scoreEl = document.getElementById('score');
  const turnsEl = document.getElementById('turns');
  const foundEl = document.getElementById('found');
  const hintEl = document.getElementById('hint');
  const splashBtn = document.getElementById('splashBtn');
  const brushBtn = document.getElementById('brushBtn');
  const newBtn = document.getElementById('newBtn');
  const result = document.getElementById('result');
  const finalScore = document.getElementById('finalScore');
  const retryBtn = document.getElementById('retryBtn');
  const nextBtn = document.getElementById('nextBtn');

  const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
  const TAU = Math.PI * 2;

  let mode = 'splash';
  let seed = randomSeed();
  let rng = mulberry32(seed);
  let ink = new Set();
  let connected = new Set();
  let resources = [];
  let score = 0;
  let turns = CONFIG.turns;
  let drawing = null;
  let gameOver = false;

  function randomSeed() {
    return (Math.random() * 0xffffffff) >>> 0;
  }

  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function rand(min, max) { return min + rng() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function key(x, y) { return `${x},${y}`; }
  function parseKey(k) { const [x,y] = k.split(',').map(Number); return {x,y}; }

  function home() {
    return { x: Math.floor(CONFIG.cols / 2), y: CONFIG.rows - 10 };
  }

  function inBounds(x, y) {
    return x >= 0 && x < CONFIG.cols && y >= 0 && y < CONFIG.rows;
  }

  function addDisk(cx, cy, radius, target = ink) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
      for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
        if (!inBounds(x,y)) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx*dx + dy*dy <= r2 + rand(-1.6, 1.6)) target.add(key(x,y));
      }
    }
  }

  function addBlob(cx, cy, baseRadius) {
    // Several overlapping disks form one irregular island. Same radius can yield visibly different shapes.
    addDisk(cx, cy, baseRadius * rand(.72, .98));
    const lobes = randInt(2, 5);
    for (let i = 0; i < lobes; i++) {
      const angle = rand(0, TAU);
      const dist = rand(baseRadius * .25, baseRadius * .8);
      addDisk(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        baseRadius * rand(.35, .72)
      );
    }
  }

  function splashAt(cx, cy) {
    const medium = randInt(...CONFIG.splash.mediumCount);
    const small = randInt(...CONFIG.splash.smallCount);

    for (let i = 0; i < medium; i++) {
      const angle = rand(0, TAU);
      const distance = i === 0 ? rand(0, 4) : rand(3, CONFIG.splash.spread);
      const r = rand(...CONFIG.splash.mediumRadius);
      addBlob(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance, r);
    }
    for (let i = 0; i < small; i++) {
      const angle = rand(0, TAU);
      const distance = rand(8, CONFIG.splash.spread * 1.45);
      const r = rand(...CONFIG.splash.smallRadius);
      addBlob(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance, r);
    }

    revealResources();
    refreshConnected();
    spendTurn();
  }

  function valueRoll(hidden) {
    const r = rng();
    if (hidden && r < .035) return 50;
    if (hidden && r < .12) return 25;
    if (r < .28) return 12;
    if (r < .58) return 7;
    return randInt(1, 5);
  }

  function createResources() {
    const list = [];
    const h = home();
    const total = CONFIG.resources.visible + CONFIG.resources.hidden;
    for (let i = 0; i < total; i++) {
      let x, y, tries = 0;
      do {
        x = randInt(5, CONFIG.cols - 6);
        y = randInt(6, CONFIG.rows - 18);
        tries++;
      } while (tries < 200 && (
        Math.hypot(x - h.x, y - h.y) < CONFIG.resources.minHomeDistance ||
        list.some(r => Math.hypot(x - r.x, y - r.y) < 7)
      ));
      const hidden = i >= CONFIG.resources.visible;
      list.push({
        id: i,
        x, y,
        hidden,
        revealed: !hidden,
        owned: false,
        value: valueRoll(hidden),
      });
    }
    return list;
  }

  function revealResources() {
    for (const resource of resources) {
      if (!resource.revealed && ink.has(key(resource.x, resource.y))) resource.revealed = true;
    }
  }

  function refreshConnected() {
    const h = home();
    const start = [];
    const active = new Set();
    for (const k of ink) {
      const p = parseKey(k);
      if (Math.hypot(p.x - h.x, p.y - h.y) <= CONFIG.homeRadius + 1.5) {
        active.add(k);
        start.push(k);
      }
    }
    for (let i = 0; i < start.length; i++) {
      const p = parseKey(start[i]);
      for (const [dx,dy] of neighbors) {
        const nk = key(p.x + dx, p.y + dy);
        if (active.has(nk) || !ink.has(nk)) continue;
        active.add(nk);
        start.push(nk);
      }
    }
    connected = active;
  }

  function canStartBrush(p) {
    const h = home();
    if (Math.hypot(p.x - h.x, p.y - h.y) <= CONFIG.homeRadius + CONFIG.brushRadius + 2) return true;
    for (let yy = p.y - 3; yy <= p.y + 3; yy++) {
      for (let xx = p.x - 3; xx <= p.x + 3; xx++) {
        if (connected.has(key(xx,yy))) return true;
      }
    }
    return false;
  }

  function stampBrush(p, target) {
    const r = CONFIG.brushRadius;
    for (let y = p.y - r; y <= p.y + r; y++) {
      for (let x = p.x - r; x <= p.x + r; x++) {
        if (!inBounds(x,y)) continue;
        if ((x-p.x)**2 + (y-p.y)**2 <= r*r + 1) target.add(key(x,y));
      }
    }
  }

  function extendBrush(to) {
    if (!drawing) return;
    const from = drawing.last;
    const stepDist = Math.hypot(to.x - from.x, to.y - from.y);
    if (stepDist < .5) return;

    const allowed = CONFIG.brushMaxLength - drawing.length;
    if (allowed <= 0) return;
    const use = Math.min(stepDist, allowed);
    const ux = (to.x - from.x) / stepDist;
    const uy = (to.y - from.y) / stepDist;
    const end = { x: from.x + ux * use, y: from.y + uy * use };
    const steps = Math.max(1, Math.ceil(use / .65));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      stampBrush({
        x: Math.round(from.x + (end.x - from.x) * t),
        y: Math.round(from.y + (end.y - from.y) * t),
      }, drawing.cells);
    }
    drawing.length += use;
    drawing.last = end;
  }

  function finishBrush() {
    if (!drawing) return;
    if (drawing.length >= 1) {
      for (const k of drawing.cells) ink.add(k);
      revealResources();
      refreshConnected();
      acquireByBrush();
      spendTurn();
    }
    drawing = null;
    render();
  }

  function acquireByBrush() {
    // Ownership is confirmed only as the result of a brush action.
    for (const resource of resources) {
      if (resource.owned || !resource.revealed) continue;
      const rk = key(resource.x, resource.y);
      if (!ink.has(rk) || !connected.has(rk)) continue;
      resource.owned = true;
      score += resource.value;
    }
  }

  function spendTurn() {
    if (gameOver) return;
    turns--;
    if (turns <= 0) {
      turns = 0;
      gameOver = true;
      setTimeout(showResult, 260);
    }
    updateHud();
    render();
  }

  function showResult() {
    finalScore.textContent = score;
    result.hidden = false;
  }

  function setMode(next) {
    if (gameOver) return;
    mode = next;
    splashBtn.classList.toggle('active', mode === 'splash');
    brushBtn.classList.toggle('active', mode === 'brush');
    hintEl.textContent = mode === 'splash'
      ? 'スプラッシュする場所をタップ'
      : `本拠地か接続済みインクから線を引く（最大 ${CONFIG.brushMaxLength}）`;
  }

  function resizeCanvas() {
    const rect = boardWrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    render();
  }

  function boardMetrics() {
    const rect = boardWrap.getBoundingClientRect();
    return { w: rect.width, h: rect.height, sx: rect.width / CONFIG.cols, sy: rect.height / CONFIG.rows };
  }

  function pointerToCell(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(Math.floor((event.clientX - rect.left) / rect.width * CONFIG.cols), 0, CONFIG.cols - 1),
      y: clamp(Math.floor((event.clientY - rect.top) / rect.height * CONFIG.rows), 0, CONFIG.rows - 1),
    };
  }

  function render() {
    const m = boardMetrics();
    ctx.clearRect(0,0,m.w,m.h);

    // Subtle paper noise without external assets.
    ctx.fillStyle = '#f5efdf';
    ctx.fillRect(0,0,m.w,m.h);

    // Ink cells. Connected ink is slightly darker so the usable network is readable.
    for (const k of ink) {
      const p = parseKey(k);
      ctx.fillStyle = connected.has(k) ? '#22211f' : '#4e4b46';
      const x = p.x * m.sx;
      const y = p.y * m.sy;
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(m.sx + .5), Math.ceil(m.sy + .5));
    }

    if (drawing) {
      ctx.fillStyle = 'rgba(28,27,25,.82)';
      for (const k of drawing.cells) {
        const p = parseKey(k);
        ctx.fillRect(Math.floor(p.x*m.sx), Math.floor(p.y*m.sy), Math.ceil(m.sx+.5), Math.ceil(m.sy+.5));
      }
    }

    // Home/start area.
    const h = home();
    ctx.save();
    ctx.translate((h.x+.5)*m.sx, (h.y+.5)*m.sy);
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = '#232220';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0,0, Math.max(14, CONFIG.homeRadius*m.sx), 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#232220';
    ctx.font = '700 11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START',0,0);
    ctx.restore();

    // Resources are drawn as clean objects, not pixel art.
    for (const resource of resources) {
      if (!resource.revealed) continue;
      const x = (resource.x + .5) * m.sx;
      const y = (resource.y + .5) * m.sy;
      const owned = resource.owned;
      ctx.save();
      ctx.translate(x,y);
      ctx.fillStyle = owned ? '#fff7cf' : '#fffdf7';
      ctx.strokeStyle = owned ? '#846d12' : '#4b463d';
      ctx.lineWidth = owned ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(0,0, owned ? 12 : 10, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = owned ? '#66520d' : '#282622';
      ctx.font = `700 ${owned ? 11 : 10}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(resource.value),0,.5);
      ctx.restore();
    }
  }

  function updateHud() {
    scoreEl.textContent = score;
    turnsEl.textContent = turns;
    const revealed = resources.filter(r => r.revealed).length;
    foundEl.textContent = `${revealed}/${resources.length}`;
  }

  function reset(useSameSeed) {
    if (!useSameSeed) seed = randomSeed();
    rng = mulberry32(seed);
    ink = new Set();
    connected = new Set();
    resources = createResources();
    score = 0;
    turns = CONFIG.turns;
    drawing = null;
    gameOver = false;
    result.hidden = true;

    const h = home();
    addDisk(h.x, h.y, CONFIG.homeRadius);
    refreshConnected();
    updateHud();
    setMode('splash');
    render();
  }

  canvas.addEventListener('pointerdown', event => {
    if (gameOver) return;
    const p = pointerToCell(event);
    if (mode === 'splash') {
      splashAt(p.x,p.y);
      return;
    }
    if (!canStartBrush(p)) {
      hintEl.textContent = '筆は本拠地か、つながっているインクから開始';
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    drawing = { pointerId: event.pointerId, last: p, length: 0, cells: new Set() };
    stampBrush(p, drawing.cells);
    render();
  });

  canvas.addEventListener('pointermove', event => {
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    extendBrush(pointerToCell(event));
    render();
  });

  function endBrushPointer(event) {
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    finishBrush();
  }
  canvas.addEventListener('pointerup', endBrushPointer);
  canvas.addEventListener('pointercancel', () => { drawing = null; render(); });

  splashBtn.addEventListener('click', () => setMode('splash'));
  brushBtn.addEventListener('click', () => setMode('brush'));
  newBtn.addEventListener('click', () => reset(false));
  retryBtn.addEventListener('click', () => reset(true));
  nextBtn.addEventListener('click', () => reset(false));
  window.addEventListener('resize', resizeCanvas);

  requestAnimationFrame(() => {
    resizeCanvas();
    reset(true);
  });
})();
