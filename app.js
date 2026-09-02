(() => {
  'use strict';

  // Provisional play-test: sparse coins, three large splashes, horizontal world.
  const CONFIG = {
    cols: 720,
    rows: 450,
    totalInk: 100,
    maxSplashes: 3,
    splashInkCost: 15,
    brushInkPerCell: 0.115, // 3 splashes leave ~55 ink ≒ 478 cells of brush.
    homeRadius: 10,
    homeY: 0.80,
    brushRadius: 3,
    brushMaxLength: 90,
    brushStartPadding: 7,
    scoreRevealCoverage: 0.30,
    acquireCoverage: 0.70,
    zoom: {
      min: 0.82,
      default: 1,
      max: 1.35,
      step: 0.10,
    },
    panStep: 0.18,
    panHoldStep: 0.035,
    panHoldDelay: 260,
    panHoldEvery: 55,
    splash: {
      coreCount: [3, 5],
      dropletCount: [10, 16],
      speckCount: [6, 10],
      coreRadius: [20, 30],
      dropletRadius: [6, 12],
      speckRadius: [3, 6],
      spread: 120,
      farSpread: 165,
      aimDrift: [12, 30],
      minIslandArea: 42,
    },
    resources: {
      minHomeDistance: 34,
      minGap: 10,
      positionKnownPerBand: 1,
      treasureValue: 50,
      decks: {
        upper: [16, 24, 30],
        middle: [8, 12, 16],
        lower: [3, 5, 8],
      },
      sizes: [
        { name: 'small', radius: 13 },
        { name: 'medium', radius: 19 },
        { name: 'large', radius: 27 },
      ],
    },
  };

  const BAND_NAMES = ['upper', 'middle', 'lower'];
  const BAND_LABELS = ['上層', '中層', '下層'];
  const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
  const TAU = Math.PI * 2;
  const TAP_MOVE_PX = 5;
  const MIN_ACTION_INK = .05;
  const COLORS = {
    position: '#527783',
    positionSoft: 'rgba(82,119,131,.72)',
    partial: '#d8bd74',
    partialTreasure: '#e8bd4f',
    revealed: '#c77912',
    revealedDark: '#714609',
    acquired: '#2f7d57',
    acquiredDark: '#18573a',
    coin: '#f3dfa0',
    treasure: '#ffd968',
  };

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const boardWrap = document.getElementById('boardWrap');
  const scoreEl = document.getElementById('score');
  const inkEl = document.getElementById('inkRemaining');
  const ownedEl = document.getElementById('ownedCount');
  const hintEl = document.getElementById('hint');
  const splashBtn = document.getElementById('splashBtn');
  const splashLeftEl = document.getElementById('splashLeft');
  const brushBtn = document.getElementById('brushBtn');
  const newBtn = document.getElementById('newBtn');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');
  const viewLeftBtn = document.getElementById('viewLeft');
  const viewRightBtn = document.getElementById('viewRight');
  const distributionBtn = document.getElementById('distributionBtn');
  const distributionPanel = document.getElementById('distributionPanel');
  const distributionContent = document.getElementById('distributionContent');
  const distributionClose = document.getElementById('distributionClose');
  const result = document.getElementById('result');
  const finalScore = document.getElementById('finalScore');
  const finalOwned = document.getElementById('finalOwned');
  const retryBtn = document.getElementById('retryBtn');
  const nextBtn = document.getElementById('nextBtn');

  let mode = 'splash';
  let seed = randomSeed();
  let rng = mulberry32(seed);
  let ink = new Set();
  let connected = new Set();
  let resources = [];
  let score = 0;
  let inkRemaining = CONFIG.totalInk;
  let splashesUsed = 0;
  let drawing = null;
  let gameOver = false;
  let pendingSplash = null;
  let gesture = null;
  let feedback = null;
  let feedbackTimer = null;
  let panDelayTimer = null;
  let panRepeatTimer = null;

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

  function shuffled(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function home() {
    return {
      x: Math.floor(CONFIG.cols / 2),
      y: Math.floor(CONFIG.rows * CONFIG.homeY),
    };
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

  function addBlob(cx, cy, baseRadius, lobes = [2, 5], target = ink) {
    addDisk(cx, cy, baseRadius * rand(.72, .98), target);
    const count = randInt(...lobes);
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const dist = rand(baseRadius * .25, baseRadius * .85);
      addDisk(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        baseRadius * rand(.32, .68),
        target
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

  function pruneSmallIslands(target, minArea) {
    const visited = new Set();
    for (const start of target) {
      if (visited.has(start)) continue;
      const queue = [start];
      const component = [];
      let touchesExistingInk = false;
      visited.add(start);
      for (let i = 0; i < queue.length; i++) {
        const current = queue[i];
        component.push(current);
        if (ink.has(current)) touchesExistingInk = true;
        const p = parseKey(current);
        for (const [dx, dy] of neighbors) {
          const next = key(p.x + dx, p.y + dy);
          if (ink.has(next)) touchesExistingInk = true;
          if (!target.has(next) || visited.has(next)) continue;
          visited.add(next);
          queue.push(next);
        }
      }
      if (component.length < minArea && !touchesExistingInk) {
        for (const k of component) target.delete(k);
      }
    }
  }

  function splashAt(cx, cy) {
    if (gameOver) return;
    if (splashesUsed >= CONFIG.maxSplashes) {
      hintEl.textContent = 'スプラッシュは3回使い切った。筆で仕上げる';
      setMode('brush');
      return;
    }
    if (inkRemaining + 1e-9 < CONFIG.splashInkCost) {
      hintEl.textContent = 'スプラッシュ分のインクがないので、筆で使い切る';
      setMode('brush');
      return;
    }

    const splashInk = new Set();
    const core = randInt(...CONFIG.splash.coreCount);
    const droplets = randInt(...CONFIG.splash.dropletCount);
    const specks = randInt(...CONFIG.splash.speckCount);
    const impact = splashPoint(cx, cy, ...CONFIG.splash.aimDrift);

    for (let i = 0; i < core; i++) {
      const p = splashPoint(
        impact.x,
        impact.y,
        i === 0 ? 4 : 12,
        i === 0 ? 24 : CONFIG.splash.spread * .55
      );
      addBlob(p.x, p.y, rand(...CONFIG.splash.coreRadius), [2, 5], splashInk);
    }
    for (let i = 0; i < droplets; i++) {
      const p = splashPoint(impact.x, impact.y, 20, CONFIG.splash.spread);
      addBlob(p.x, p.y, rand(...CONFIG.splash.dropletRadius), [1, 3], splashInk);
    }
    for (let i = 0; i < specks; i++) {
      const p = splashPoint(impact.x, impact.y, 30, CONFIG.splash.farSpread);
      addDisk(p.x, p.y, rand(...CONFIG.splash.speckRadius), splashInk);
    }

    pruneSmallIslands(splashInk, CONFIG.splash.minIslandArea);
    for (const k of splashInk) ink.add(k);

    splashesUsed++;
    refreshConnected();
    updateResources();
    spendInk(CONFIG.splashInkCost);

    if (splashesUsed >= CONFIG.maxSplashes && !gameOver) setMode('brush');
  }

  function placeResource(list, band, value, size, id, isTreasure = false) {
    const radius = size.radius;
    const bandLo = band / 3 * CONFIG.rows;
    const bandHi = (band + 1) / 3 * CONFIG.rows;
    const margin = Math.ceil(radius + 8);
    const h = home();
    let x = CONFIG.cols / 2;
    let y = (bandLo + bandHi) / 2;

    for (let tries = 0; tries < 360; tries++) {
      x = rand(margin, CONFIG.cols - margin);
      y = rand(bandLo + margin, bandHi - margin);
      const tooCloseHome = Math.hypot(x - h.x, y - h.y) < CONFIG.resources.minHomeDistance + radius;
      const overlaps = list.some(r =>
        Math.hypot(x - r.x, y - r.y) < radius + r.radius + CONFIG.resources.minGap
      );
      if (!tooCloseHome && !overlaps) break;
    }

    return {
      id,
      x,
      y,
      band,
      value,
      radius,
      sizeName: size.name,
      initiallyKnown: false,
      positionKnown: false,
      scoreKnown: false,
      coverage: 0,
      connectedCoverage: 0,
      owned: false,
      isTreasure,
    };
  }

  function createResources() {
    const list = [];
    let id = 0;

    for (let band = 0; band < 3; band++) {
      const name = BAND_NAMES[band];
      const values = shuffled(CONFIG.resources.decks[name]);
      const sizes = shuffled(CONFIG.resources.sizes);
      const bandResources = [];

      for (let i = 0; i < values.length; i++) {
        const resource = placeResource(list, band, values[i], sizes[i], id++);
        list.push(resource);
        bandResources.push(resource);
      }

      const known = bandResources[randInt(0, bandResources.length - 1)];
      known.initiallyKnown = true;
      known.positionKnown = true;
    }

    const treasureBand = rng() < .5 ? 1 : 2;
    const treasureSize = CONFIG.resources.sizes[randInt(0, CONFIG.resources.sizes.length - 1)];
    const treasure = placeResource(
      list,
      treasureBand,
      CONFIG.resources.treasureValue,
      treasureSize,
      id++,
      true
    );
    list.push(treasure);
    return list;
  }

  function coverageStats(resource) {
    const r2 = resource.radius * resource.radius;
    const minX = Math.max(0, Math.floor(resource.x - resource.radius));
    const maxX = Math.min(CONFIG.cols - 1, Math.ceil(resource.x + resource.radius));
    const minY = Math.max(0, Math.floor(resource.y - resource.radius));
    const maxY = Math.min(CONFIG.rows - 1, Math.ceil(resource.y + resource.radius));
    let total = 0;
    let covered = 0;
    let connectedCovered = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - resource.x;
        const dy = y - resource.y;
        if (dx * dx + dy * dy > r2) continue;
        total++;
        const k = key(x,y);
        if (!ink.has(k)) continue;
        covered++;
        if (connected.has(k)) connectedCovered++;
      }
    }

    return {
      coverage: total ? covered / total : 0,
      connectedCoverage: total ? connectedCovered / total : 0,
    };
  }

  function showFeedback(type, items) {
    if (!items.length) return;
    if (feedbackTimer) clearTimeout(feedbackTimer);

    if (type === 'acquired') {
      const total = items.reduce((sum, item) => sum + item.value, 0);
      feedback = {
        type,
        title: items.length === 1 ? '取得' : `${items.length}個取得`,
        detail: `+${total}`,
      };
    } else {
      feedback = {
        type,
        title: '点数判明',
        detail: items.length === 1 ? String(items[0].value) : `${items.length}個`,
      };
    }

    feedbackTimer = setTimeout(() => {
      feedback = null;
      feedbackTimer = null;
      render();
    }, 1350);
  }

  function updateResources() {
    const revealedNow = [];
    const acquiredNow = [];

    for (const resource of resources) {
      const wasScoreKnown = resource.scoreKnown;
      const wasOwned = resource.owned;
      const stats = coverageStats(resource);
      resource.coverage = stats.coverage;
      resource.connectedCoverage = stats.connectedCoverage;

      if (resource.coverage > 0) resource.positionKnown = true;
      if (resource.coverage >= CONFIG.scoreRevealCoverage) resource.scoreKnown = true;

      if (
        !resource.owned &&
        resource.coverage >= CONFIG.acquireCoverage &&
        resource.connectedCoverage > 0
      ) {
        resource.owned = true;
        resource.positionKnown = true;
        resource.scoreKnown = true;
        score += resource.value;
      }

      if (!wasOwned && resource.owned) acquiredNow.push(resource);
      else if (!wasScoreKnown && resource.scoreKnown) revealedNow.push(resource);
    }

    if (acquiredNow.length) showFeedback('acquired', acquiredNow);
    else if (revealedNow.length) showFeedback('revealed', revealedNow);
  }

  function refreshConnected() {
    const h = home();
    const start = [];
    const active = new Set();
    for (const k of ink) {
      const p = parseKey(k);
      if (Math.hypot(p.x - h.x, p.y - h.y) <= CONFIG.homeRadius + 3) {
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
    if (Math.hypot(p.x - h.x, p.y - h.y) <= CONFIG.homeRadius + CONFIG.brushRadius + CONFIG.brushStartPadding) {
      return true;
    }
    for (let yy = p.y - CONFIG.brushStartPadding; yy <= p.y + CONFIG.brushStartPadding; yy++) {
      for (let xx = p.x - CONFIG.brushStartPadding; xx <= p.x + CONFIG.brushStartPadding; xx++) {
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

    const maxByInk = inkRemaining / CONFIG.brushInkPerCell;
    const allowed = Math.min(CONFIG.brushMaxLength, maxByInk) - drawing.length;
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
    updateHud();
  }

  function finishBrush() {
    if (!drawing) return;
    if (drawing.length >= .5) {
      const cost = Math.min(inkRemaining, drawing.length * CONFIG.brushInkPerCell);
      for (const k of drawing.cells) ink.add(k);
      drawing = null;
      refreshConnected();
      updateResources();
      spendInk(cost);
      return;
    }
    drawing = null;
    updateHud();
    render();
  }

  function projectedInk() {
    const previewCost = drawing ? drawing.length * CONFIG.brushInkPerCell : 0;
    return Math.max(0, inkRemaining - previewCost);
  }

  function spendInk(amount) {
    if (gameOver) return;
    inkRemaining = Math.max(0, inkRemaining - amount);
    if (inkRemaining < MIN_ACTION_INK) inkRemaining = 0;

    if (inkRemaining <= 0) {
      gameOver = true;
      updateHud();
      render();
      setTimeout(showResult, 220);
      return;
    }

    updateHud();
    updateActionAvailability();
    render();
  }

  function showResult() {
    finalScore.textContent = score;
    finalOwned.textContent = resources.filter(r => r.owned).length;
    result.hidden = false;
  }

  function setMode(next) {
    if (gameOver) return;
    const splashUnavailable = splashesUsed >= CONFIG.maxSplashes || inkRemaining + 1e-9 < CONFIG.splashInkCost;
    if (next === 'splash' && splashUnavailable) {
      mode = 'brush';
    } else {
      mode = next;
    }

    hintEl.textContent = mode === 'splash'
      ? `大きいスプラッシュ 残り${CONFIG.maxSplashes - splashesUsed}回・1回${CONFIG.splashInkCost}インク`
      : `筆はSTART/接続インクから・橙=点数判明、緑=取得`;

    splashBtn.classList.toggle('active', mode === 'splash');
    brushBtn.classList.toggle('active', mode === 'brush');
    updateActionAvailability();
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
    const worldH = rect.height;
    const scale = worldH / CONFIG.rows;
    const worldW = CONFIG.cols * scale;
    return {
      w: rect.width,
      h: rect.height,
      worldW,
      worldH,
      sx: scale,
      sy: scale,
    };
  }

  function clampCamera() {
    const m = boardMetrics();
    const scaledW = m.worldW * camera.zoom;
    const scaledH = m.worldH * camera.zoom;
    camera.tx = scaledW <= m.w ? (m.w - scaledW) / 2 : clamp(camera.tx, m.w - scaledW, 0);
    camera.ty = scaledH <= m.h ? (m.h - scaledH) / 2 : clamp(camera.ty, m.h - scaledH, 0);
    updatePanButtons();
  }

  function centerCamera() {
    const m = boardMetrics();
    const h = home();
    camera.tx = m.w / 2 - (h.x + .5) * m.sx * camera.zoom;
    camera.ty = (m.h - m.worldH * camera.zoom) / 2;
    clampCamera();
  }

  function updateZoomLabel() {
    zoomResetBtn.textContent = `${Math.round(camera.zoom * 100)}%`;
    zoomOutBtn.disabled = camera.zoom <= CONFIG.zoom.min + .001;
    zoomInBtn.disabled = camera.zoom >= CONFIG.zoom.max - .001;
    updatePanButtons();
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

  function panCamera(direction, fraction = CONFIG.panStep) {
    const m = boardMetrics();
    camera.tx -= direction * m.w * fraction;
    clampCamera();
    render();
  }

  function stopPanHold() {
    if (panDelayTimer) clearTimeout(panDelayTimer);
    if (panRepeatTimer) clearInterval(panRepeatTimer);
    panDelayTimer = null;
    panRepeatTimer = null;
  }

  function startPanHold(direction, event) {
    if (event) event.preventDefault();
    stopPanHold();
    panCamera(direction);
    panDelayTimer = setTimeout(() => {
      panDelayTimer = null;
      panRepeatTimer = setInterval(() => {
        panCamera(direction, CONFIG.panHoldStep);
      }, CONFIG.panHoldEvery);
    }, CONFIG.panHoldDelay);
  }

  function updatePanButtons() {
    if (!viewLeftBtn || !viewRightBtn) return;
    const m = boardMetrics();
    const minTx = m.w - m.worldW * camera.zoom;
    viewLeftBtn.disabled = camera.tx >= -1;
    viewRightBtn.disabled = camera.tx <= minTx + 1;
  }

  function pointerToCell(event) {
    const rect = canvas.getBoundingClientRect();
    const m = boardMetrics();
    const localX = (event.clientX - rect.left - camera.tx) / camera.zoom;
    const localY = (event.clientY - rect.top - camera.ty) / camera.zoom;
    return {
      x: clamp(Math.floor(localX / m.sx), 0, CONFIG.cols - 1),
      y: clamp(Math.floor(localY / m.sy), 0, CONFIG.rows - 1),
    };
  }

  function renderBands(m) {
    const bandHeight = m.worldH / 3;
    const fills = ['#eee6d5', '#f5eddc', '#fbf4e6'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = fills[i];
      ctx.fillRect(0, i * bandHeight, m.worldW, bandHeight);
    }

    ctx.strokeStyle = 'rgba(78,68,51,.20)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * bandHeight);
      ctx.lineTo(m.worldW, i * bandHeight);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawStatusPill(text, y, background, foreground) {
    const fontSize = 9 / camera.zoom;
    ctx.font = `800 ${fontSize}px system-ui`;
    const width = ctx.measureText(text).width + 12 / camera.zoom;
    const height = 15 / camera.zoom;
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(-width / 2, y, width, height, 7 / camera.zoom);
    ctx.fill();
    ctx.fillStyle = foreground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, y + height / 2 + .2 / camera.zoom);
  }

  function renderPositionMarker(resource, m) {
    if (!resource.initiallyKnown || resource.coverage > 0 || resource.owned) return;
    const x = (resource.x + .5) * m.sx;
    const y = (resource.y + .5) * m.sy;
    const r = 9 / camera.zoom;
    ctx.save();
    ctx.translate(x,y);
    ctx.strokeStyle = COLORS.positionSoft;
    ctx.lineWidth = 2 / camera.zoom;
    ctx.setLineDash([3 / camera.zoom, 3 / camera.zoom]);
    ctx.beginPath();
    ctx.arc(0,0,r,0,TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.position;
    ctx.font = `800 ${10 / camera.zoom}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?',0,.5 / camera.zoom);
    ctx.restore();
  }

  function renderCoin(resource, m) {
    const x = (resource.x + .5) * m.sx;
    const y = (resource.y + .5) * m.sy;
    const radius = resource.radius * m.sx;

    if (resource.owned) {
      ctx.save();
      ctx.translate(x,y);
      ctx.fillStyle = resource.isTreasure ? COLORS.treasure : COLORS.coin;
      ctx.strokeStyle = COLORS.acquired;
      ctx.lineWidth = 4 / camera.zoom;
      ctx.beginPath();
      ctx.arc(0,0,radius,0,TAU);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = resource.isTreasure ? '#624a00' : '#493b10';
      ctx.font = `850 ${clamp(radius * .65, 11 / camera.zoom, 22 / camera.zoom)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(resource.value),0,.5 / camera.zoom);

      const markR = 8 / camera.zoom;
      ctx.fillStyle = COLORS.acquired;
      ctx.beginPath();
      ctx.arc(radius * .72, -radius * .72, markR, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${11 / camera.zoom}px system-ui`;
      ctx.fillText('✓', radius * .72, -radius * .72 + .3 / camera.zoom);
      drawStatusPill('取得', radius + 5 / camera.zoom, COLORS.acquired, '#fff');
      ctx.restore();
      return;
    }

    if (resource.coverage <= 0) {
      renderPositionMarker(resource, m);
      return;
    }

    // Coin surface is visible only where ink has touched it.
    const r2 = resource.radius * resource.radius;
    const minX = Math.max(0, Math.floor(resource.x - resource.radius));
    const maxX = Math.min(CONFIG.cols - 1, Math.ceil(resource.x + resource.radius));
    const minY = Math.max(0, Math.floor(resource.y - resource.radius));
    const maxY = Math.min(CONFIG.rows - 1, Math.ceil(resource.y + resource.radius));

    ctx.fillStyle = resource.isTreasure ? COLORS.partialTreasure : COLORS.partial;
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const dx = xx - resource.x;
        const dy = yy - resource.y;
        if (dx * dx + dy * dy > r2) continue;
        if (!ink.has(key(xx,yy))) continue;
        ctx.fillRect(xx * m.sx, yy * m.sy, Math.ceil(m.sx + .5), Math.ceil(m.sy + .5));
      }
    }

    if (resource.scoreKnown) {
      ctx.save();
      ctx.translate(x,y);
      ctx.strokeStyle = COLORS.revealed;
      ctx.lineWidth = 2.5 / camera.zoom;
      ctx.beginPath();
      ctx.arc(0,0,radius + 2 / camera.zoom,0,TAU);
      ctx.stroke();

      ctx.fillStyle = COLORS.revealedDark;
      ctx.strokeStyle = 'rgba(255,250,229,.92)';
      ctx.lineWidth = 3 / camera.zoom;
      ctx.font = `850 ${clamp(radius * .56, 11 / camera.zoom, 20 / camera.zoom)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(String(resource.value),0,.5 / camera.zoom);
      ctx.fillText(String(resource.value),0,.5 / camera.zoom);
      drawStatusPill('判明', radius + 5 / camera.zoom, '#f4c86f', COLORS.revealedDark);
      ctx.restore();
    }
  }

  function renderFeedback(m) {
    if (!feedback) return;
    const acquired = feedback.type === 'acquired';
    const bg = acquired ? COLORS.acquired : COLORS.revealed;
    const title = feedback.title;
    const detail = feedback.detail;
    const centerX = m.w / 2;
    const top = 54;
    const width = Math.min(180, m.w - 40);
    const height = 44;

    ctx.save();
    ctx.fillStyle = bg;
    ctx.shadowColor = 'rgba(0,0,0,.20)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(centerX - width / 2, top, width, height, 13);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 12px system-ui';
    ctx.fillText(title, centerX - 18, top + height / 2);
    ctx.font = '900 20px system-ui';
    ctx.fillText(detail, centerX + 42, top + height / 2);
    ctx.restore();
  }

  function render() {
    const m = boardMetrics();
    ctx.clearRect(0,0,m.w,m.h);
    ctx.fillStyle = '#ded4bd';
    ctx.fillRect(0,0,m.w,m.h);

    ctx.save();
    ctx.translate(camera.tx, camera.ty);
    ctx.scale(camera.zoom, camera.zoom);

    renderBands(m);

    for (const k of ink) {
      const p = parseKey(k);
      ctx.fillStyle = connected.has(k) ? '#1f2927' : '#565b59';
      ctx.fillRect(
        Math.floor(p.x * m.sx),
        Math.floor(p.y * m.sy),
        Math.ceil(m.sx + .5),
        Math.ceil(m.sy + .5)
      );
    }

    if (drawing) {
      ctx.fillStyle = 'rgba(24,35,32,.86)';
      for (const k of drawing.cells) {
        const p = parseKey(k);
        ctx.fillRect(
          Math.floor(p.x * m.sx),
          Math.floor(p.y * m.sy),
          Math.ceil(m.sx + .5),
          Math.ceil(m.sy + .5)
        );
      }
    }

    const h = home();
    ctx.save();
    ctx.translate((h.x+.5)*m.sx, (h.y+.5)*m.sy);
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = '#263d37';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.beginPath();
    ctx.arc(0,0, Math.max(14 / camera.zoom, CONFIG.homeRadius*m.sx), 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#263d37';
    ctx.font = `700 ${11 / camera.zoom}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START',0,0);
    ctx.restore();

    for (const resource of resources) renderCoin(resource, m);

    ctx.restore();
    renderFeedback(m);
  }

  function formatInk(value) {
    const rounded = Math.max(0, value);
    return rounded >= 10 ? rounded.toFixed(1).replace(/\.0$/, '') : rounded.toFixed(1);
  }

  function updateActionAvailability() {
    const noSplash = splashesUsed >= CONFIG.maxSplashes || inkRemaining + 1e-9 < CONFIG.splashInkCost;
    splashBtn.disabled = gameOver || noSplash;
    brushBtn.disabled = gameOver || inkRemaining <= 0;
    splashLeftEl.textContent = `${Math.max(0, CONFIG.maxSplashes - splashesUsed)}回`;

    if (splashBtn.disabled && mode === 'splash' && !gameOver) {
      mode = 'brush';
      splashBtn.classList.remove('active');
      brushBtn.classList.add('active');
    }
  }

  function updateHud() {
    scoreEl.textContent = score;
    inkEl.textContent = formatInk(projectedInk());
    ownedEl.textContent = resources.filter(r => r.owned).length;
    updateActionAvailability();
  }

  function deckSummary(values) {
    return values.slice().sort((a,b) => a-b).join(' / ');
  }

  function renderDistributionPanel() {
    distributionContent.innerHTML = BAND_NAMES.map((name, i) => {
      const deck = CONFIG.resources.decks[name];
      const avg = deck.reduce((sum, value) => sum + value, 0) / deck.length;
      return `<div class="distribution-row">
        <strong>${BAND_LABELS[i]} <small>3個 / 平均${avg.toFixed(1)}</small></strong>
        <span>${deckSummary(deck)}</span>
      </div>`;
    }).join('') + `
      <div class="distribution-row treasure-row">
        <strong>特別埋蔵</strong>
        <span>50×1（中層か下層・完全非公開）</span>
      </div>
      <p class="distribution-note">通常9個＋お宝1個。各層は位置だけ分かるコイン1個、完全非公開2個。サイズは大・中・小を各層に1つずつ置き、点数とは独立。橙は点数判明、緑は取得済み。</p>`;
  }

  function reset(useSameSeed) {
    if (!useSameSeed) seed = randomSeed();
    rng = mulberry32(seed);
    ink = new Set();
    connected = new Set();
    resources = createResources();
    score = 0;
    inkRemaining = CONFIG.totalInk;
    splashesUsed = 0;
    drawing = null;
    pendingSplash = null;
    gesture = null;
    pointers.clear();
    gameOver = false;
    feedback = null;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = null;
    stopPanHold();
    result.hidden = true;
    distributionPanel.hidden = true;

    const h = home();
    addDisk(h.x, h.y, CONFIG.homeRadius);
    refreshConnected();
    updateResources();
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
    updateHud();
    render();
  }

  canvas.addEventListener('pointerdown', event => {
    if (gameOver || !distributionPanel.hidden) return;
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
      hintEl.textContent = '筆はSTARTか、つながっているインクから開始';
      return;
    }
    drawing = { pointerId: event.pointerId, last: p, length: 0, cells: new Set() };
    stampBrush(p, drawing.cells);
    updateHud();
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
    updateHud();
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

  viewLeftBtn.addEventListener('pointerdown', event => startPanHold(-1, event));
  viewRightBtn.addEventListener('pointerdown', event => startPanHold(1, event));
  for (const button of [viewLeftBtn, viewRightBtn]) {
    button.addEventListener('pointerup', stopPanHold);
    button.addEventListener('pointercancel', stopPanHold);
    button.addEventListener('pointerleave', stopPanHold);
  }
  window.addEventListener('pointerup', stopPanHold);

  distributionBtn.addEventListener('click', () => {
    distributionPanel.hidden = !distributionPanel.hidden;
  });
  distributionClose.addEventListener('click', () => {
    distributionPanel.hidden = true;
  });
  window.addEventListener('resize', resizeCanvas);

  renderDistributionPanel();
  requestAnimationFrame(() => {
    resizeCanvas();
    reset(true);
  });
})();
