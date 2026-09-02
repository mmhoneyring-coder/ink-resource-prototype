(() => {
  'use strict';

  const CONFIG = {
    turns: 24,
    cols: 90,
    rows: 140,
    homeRadius: 5,
    brushRadius: 2,
    brushMaxLength: 28,
    zoom: {
      fit: .65,
      min: .65,
      default: .75,
      max: 1,
      step: .1,
    },
    splash: {
      coreCount: [2, 4],
      dropletCount: [9, 15],
      speckCount: [12, 22],
      coreRadius: [4, 6],
      dropletRadius: [1.4, 2.8],
      speckRadius: [.65, 1.35],
      spread: 30,
      farSpread: 42,
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
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');
  const result = document.getElementById('result');
  const finalScore = document.getElementById('finalScore');
  const retryBtn = document.getElementById('retryBtn');
  const nextBtn = document.getElementById('nextBtn');

  const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
  const TAU = Math.PI * 2;
  const TAP_MOVE_PX = 5;

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
  let pendingSplash = null;
  let gesture = null;

  const pointers = new Map();
  const camera = { zoom: CONFIG.zoom.default, tx: 0, ty: 0 };

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

  function addBlob(cx, cy, baseRadius, lobes = [2, 5]) {
    addDisk(cx, cy, baseRadius * rand(.72, .98));
    const count = randInt(...lobes);
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const dist = rand(baseRadius * .25, baseRadius * .85);
      addDisk(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        baseRadius * rand(.32, .68)
      );
    }
  }

  function splashPoint(cx, cy, minDistance, maxDistance) {
    const angle = rand(0, TAU);
    const distance = rand(minDistance, maxDistance);
    return {
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
    };
  }

  function splashAt(cx, cy) {
    const core = randInt(...CONFIG.splash.coreCount);
    const droplets = randInt(...CONFIG.splash.dropletCount);
    const specks = randInt(...CONFIG.splash.speckCount);

    for (let i = 0; i < core; i++) {
      const p = splashPoint(cx, cy, i === 0 ? 0 : 3, i === 0 ? 5 : CONFIG.splash.spread * .55);
      addBlob(p.x, p.y, rand(...CONFIG.splash.coreRadius));
    }
    for (let i = 0; i < droplets; i++) {
      const p = splashPoint(cx, cy, 6, CONFIG.splash.spread);
      addBlob(p.x, p.y, rand(...CONFIG.splash.dropletRadius), [1, 3]);
    }
    for (let i = 0; i < specks; i++) {
      const p = splashPoint(cx, cy, 10, CONFIG.splash.farSpread);
      addDisk(p.x, p.y, rand(...CONFIG.splash.speckRadius));
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
      ? 'タップでスプラッシュ・2本指で縮小/移動'
      : `線を引く（最大 ${CONFIG.brushMaxLength}）・2本指で縮小/移動`;
  }

  function resizeCanvas() {
    const rect = boardWrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    clampCamera();
    render();
  }

  function boardMetrics() {
    const rect = boardWrap.getBoundingClientRect();
    const worldW = rect.width / CONFIG.zoom.fit;
    const worldH = rect.height / CONFIG.zoom.fit;
    return {
      w: rect.width,
      h: rect.height,
      worldW,
      worldH,
      sx: worldW / CONFIG.cols,
      sy: worldH / CONFIG.rows,
    };
  }

  function clampCamera() {
    const m = boardMetrics();
    const scaledW = m.worldW * camera.zoom;
    const scaledH = m.worldH * camera.zoom;
    camera.tx = scaledW <= m.w ? (m.w - scaledW) / 2 : clamp(camera.tx, m.w - scaledW, 0);
    camera.ty = scaledH <= m.h ? (m.h - scaledH) / 2 : clamp(camera.ty, m.h - scaledH, 0);
  }

  function centerCamera() {
    const m = boardMetrics();
    camera.tx = (m.w - m.worldW * camera.zoom) / 2;
    camera.ty = (m.h - m.worldH * camera.zoom) / 2;
    clampCamera();
  }

  function updateZoomLabel() {
    zoomResetBtn.textContent = `${Math.round(camera.zoom * 100)}%`;
    zoomOutBtn.disabled = camera.zoom <= CONFIG.zoom.min + .001;
    zoomInBtn.disabled = camera.zoom >= CONFIG.zoom.max - .001;
  }

  function zoomTo(nextZoom, cx = boardWrap.clientWidth / 2, cy = boardWrap.clientHeight / 2) {
    const zoom = clamp(nextZoom, CONFIG.zoom.min, CONFIG.zoom.max);
    const wx = (cx - camera.tx) / camera.zoom;
    const wy = (cy - camera.ty) / camera.zoom;
    camera.zoom = zoom;
    camera.tx = cx - wx * zoom;
    camera.ty = cy - wy * zoom;
    clampCamera();
    updateZoomLabel();
    render();
  }

  function resetCamera() {
    camera.zoom = CONFIG.zoom.default;
    centerCamera();
    updateZoomLabel();
    render();
  }

  function pointerToCell(event) {
    const rect = canvas.getBoundingClientRect();
    const m = boardMetrics();
    const localX = (event.clientX - rect.left - camera.tx) / camera.zoom;
    const localY = (event.clientY - rect.top - camera.ty) / camera.zoom;
    return {
      x: clamp(Math.floor(localX / m.worldW * CONFIG.cols), 0, CONFIG.cols - 1),
      y: clamp(Math.floor(localY / m.worldH * CONFIG.rows), 0, CONFIG.rows - 1),
    };
  }

  function render() {
    const m = boardMetrics();
    ctx.clearRect(0,0,m.w,m.h);

    ctx.fillStyle = '#e9dfc8';
    ctx.fillRect(0,0,m.w,m.h);

    ctx.save();
    ctx.translate(camera.tx, camera.ty);
    ctx.scale(camera.zoom, camera.zoom);

    ctx.fillStyle = '#f5efdf';
    ctx.fillRect(0,0,m.worldW,m.worldH);

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

    const h = home();
    ctx.save();
    ctx.translate((h.x+.5)*m.sx, (h.y+.5)*m.sy);
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = '#232220';
    ctx.lineWidth = 2 / camera.zoom;
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

    for (const resource of resources) {
      if (!resource.revealed) continue;
      const x = (resource.x + .5) * m.sx;
      const y = (resource.y + .5) * m.sy;
      const owned = resource.owned;
      ctx.save();
      ctx.translate(x,y);
      ctx.fillStyle = owned ? '#fff7cf' : '#fffdf7';
      ctx.strokeStyle = owned ? '#846d12' : '#4b463d';
      ctx.lineWidth = (owned ? 2.5 : 1.5) / camera.zoom;
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

    ctx.restore();
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
    pendingSplash = null;
    gesture = null;
    pointers.clear();
    gameOver = false;
    result.hidden = true;

    const h = home();
    addDisk(h.x, h.y, CONFIG.homeRadius);
    refreshConnected();
    updateHud();
    resetCamera();
    setMode('splash');
    render();
  }

  function beginTwoFingerGesture() {
    const points = [...pointers.values()];
    if (points.length !== 2) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (points[0].x + points[1].x) / 2 - rect.left;
    const my = (points[0].y + points[1].y) / 2 - rect.top;
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1;

    pendingSplash = null;
    drawing = null;
    gesture = {
      distance,
      zoom: camera.zoom,
      wx: (mx - camera.tx) / camera.zoom,
      wy: (my - camera.ty) / camera.zoom,
    };
    render();
  }

  canvas.addEventListener('pointerdown', event => {
    if (gameOver) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      beginTwoFingerGesture();
      return;
    }
    if (pointers.size !== 1) return;

    const p = pointerToCell(event);
    if (mode === 'splash') {
      pendingSplash = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }
    if (!canStartBrush(p)) {
      hintEl.textContent = '筆は本拠地か、つながっているインクから開始';
      return;
    }
    drawing = { pointerId: event.pointerId, last: p, length: 0, cells: new Set() };
    stampBrush(p, drawing.cells);
    render();
  });

  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2 && gesture) {
      const points = [...pointers.values()];
      const rect = canvas.getBoundingClientRect();
      const mx = (points[0].x + points[1].x) / 2 - rect.left;
      const my = (points[0].y + points[1].y) / 2 - rect.top;
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1;
      const zoom = clamp(gesture.zoom * distance / gesture.distance, CONFIG.zoom.min, CONFIG.zoom.max);

      camera.zoom = zoom;
      camera.tx = mx - gesture.wx * zoom;
      camera.ty = my - gesture.wy * zoom;
      clampCamera();
      updateZoomLabel();
      render();
      return;
    }

    if (pointers.size !== 1) return;

    if (pendingSplash && pendingSplash.pointerId === event.pointerId) {
      const moved = Math.hypot(event.clientX - pendingSplash.clientX, event.clientY - pendingSplash.clientY);
      if (moved > TAP_MOVE_PX) pendingSplash = null;
    }

    if (drawing && drawing.pointerId === event.pointerId) {
      extendBrush(pointerToCell(event));
      render();
    }
  });

  function endPointer(event) {
    const wasPendingSplash = pendingSplash && pendingSplash.pointerId === event.pointerId;
    const shouldFinishBrush = drawing && drawing.pointerId === event.pointerId;

    pointers.delete(event.pointerId);

    if (wasPendingSplash && !gesture && pointers.size === 0) {
      const p = pointerToCell(event);
      pendingSplash = null;
      splashAt(p.x, p.y);
    } else if (wasPendingSplash) {
      pendingSplash = null;
    }

    if (shouldFinishBrush && !gesture) finishBrush();
    if (pointers.size < 2) gesture = null;
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', event => {
    pointers.delete(event.pointerId);
    pendingSplash = null;
    if (drawing && drawing.pointerId === event.pointerId) drawing = null;
    if (pointers.size < 2) gesture = null;
    render();
  });

  splashBtn.addEventListener('click', () => setMode('splash'));
  brushBtn.addEventListener('click', () => setMode('brush'));
  newBtn.addEventListener('click', () => reset(false));
  retryBtn.addEventListener('click', () => reset(true));
  nextBtn.addEventListener('click', () => reset(false));
  zoomInBtn.addEventListener('click', () => zoomTo(camera.zoom + CONFIG.zoom.step));
  zoomOutBtn.addEventListener('click', () => zoomTo(camera.zoom - CONFIG.zoom.step));
  zoomResetBtn.addEventListener('click', resetCamera);
  window.addEventListener('resize', resizeCanvas);

  requestAnimationFrame(() => {
    resizeCanvas();
    reset(true);
  });
})();
