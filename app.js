(() => {
  'use strict';

  const CONFIG = {
    cols: 208,
    rows: 450,
    rounds: 4,
    brushAreaPerTurn: 650,
    homeRadius: 10,
    homeY: 0.80,
    brushRadii: { thin: 3, wide: 6 },
    scoreRevealCoverage: 0.30,
    acquireCoverage: 0.70,
    zoom: { min: 1, default: 1, max: 1.35, step: 0.10 },
    splash: {
      coreCount: [4, 6],
      dropletCount: [10, 15],
      speckCount: [8, 12],
      coreRadius: [14, 20],
      dropletRadius: [6, 11],
      speckRadius: [3, 5],
      spread: 115,
      farSpread: 155,
      aimDrift: [10, 28],
      minIslandArea: 30,
      radialDirections: [2, 3],
      radialJitter: 1.0,
      radialBias: { core: 0.40, droplet: 0.50, speck: 0.58 },
    },
    resources: {
      minHomeDistance: 34,
      minGap: 10,
      treasureValue: 500,
      scoreStep: 10,
      counts: {
        upper: 6,
        middle: 5,
        lower: 3,
      },
      scoreBands: {
        upper: {
          normalMin: 130,
          hitMin: 190,
          normalMax: 320,
          singleMax: 420,
          singleChance: 0.15,
          fullChance: 0.12,
        },
        middle: {
          normalMin: 70,
          hitMin: 110,
          normalMax: 190,
          singleMax: 280,
          singleChance: 0.15,
          fullChance: 0.12,
        },
        lower: {
          normalMin: 30,
          hitMin: 60,
          normalMax: 100,
          singleMax: 150,
          singleChance: 0.15,
          fullChance: 0.12,
        },
      },
      sizeDecks: {
        upper: [
          { name: 'small', radius: 8 },
          { name: 'small', radius: 8 },
          { name: 'medium', radius: 12 },
          { name: 'medium', radius: 12 },
          { name: 'medium', radius: 12 },
          { name: 'large', radius: 16 },
        ],
        middle: [
          { name: 'small', radius: 8 },
          { name: 'small', radius: 8 },
          { name: 'medium', radius: 12 },
          { name: 'large', radius: 16 },
          { name: 'large', radius: 16 },
        ],
        lower: [
          { name: 'small', radius: 8 },
          { name: 'medium', radius: 12 },
          { name: 'large', radius: 16 },
        ],
      },
      treasureSize: { name: 'small', radius: 8 },
    },
  };

  const BAND_NAMES = ['upper', 'middle', 'lower'];
  const BAND_LABELS = ['上層', '中層', '下層'];
  const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
  const TAU = Math.PI * 2;
  const TAP_MOVE_PX = 5;
  const EPS = 0.01;
  const COLORS = {
    position: '#60777c',
    positionSoft: 'rgba(96,119,124,.30)',
    partial: '#60777c',
    partialTreasure: '#60777c',
    revealedText: '#e8eceb',
    acquired: '#f0c64f',
    acquiredDark: '#303638',
    coin: '#f0c64f',
    treasure: '#f2bf3f',
  };

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const boardWrap = document.getElementById('boardWrap');
  const scoreBoardEl = document.getElementById('scoreBoard');
  const scoreEl = document.getElementById('score');
  const roundEl = document.getElementById('roundCount');
  const ownedEl = document.getElementById('ownedCount');
  const hintEl = document.getElementById('hint');
  const splashBtn = document.getElementById('splashBtn');
  const splashLeftEl = document.getElementById('splashLeft');
  const thinBtn = document.getElementById('brushBtn');
  const wideBtn = document.getElementById('moveBtn');
  const newBtn = document.getElementById('newBtn');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');
  const distributionBtn = document.getElementById('distributionBtn');
  const distributionPanel = document.getElementById('distributionPanel');
  const distributionContent = document.getElementById('distributionContent');
  const distributionClose = document.getElementById('distributionClose');
  const penLoadEl = document.getElementById('penLoad');
  const inkFillEl = document.getElementById('inkFill');
  const brushRemainingEl = document.getElementById('brushRemaining');
  const result = document.getElementById('result');
  const finalScore = document.getElementById('finalScore');
  const finalOwned = document.getElementById('finalOwned');
  const retryBtn = document.getElementById('retryBtn');
  const nextBtn = document.getElementById('nextBtn');

  let seed = randomSeed();
  let rng = mulberry32(seed);
  let ink = new Set();
  let connected = new Set();
  let resources = [];
  let score = 0;
  let round = 1;
  let phase = 'splash';
  let penSize = 'thin';
  let brushRemaining = CONFIG.brushAreaPerTurn;
  let drawing = null;
  let gameOver = false;
  let pendingSplash = null;
  let gesture = null;
  let feedback = null;
  let feedbackTimer = null;

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

  function syncBoardWidthToViewport() {
    CONFIG.cols = Math.round(CONFIG.rows * 9 / 19.5);
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
    return { x: cx + Math.cos(angle) * distance, y: cy + Math.sin(angle) * distance };
  }

  function createSplashDirections() {
    const count = randInt(...CONFIG.splash.radialDirections);
    const directions = [];
    for (let i = 0; i < count; i++) {
      let angle = rand(0, TAU);
      for (let tries = 0; tries < 6; tries++) {
        const tooClose = directions.some(existing => {
          const diff = Math.atan2(Math.sin(angle - existing), Math.cos(angle - existing));
          return Math.abs(diff) < .70;
        });
        if (!tooClose) break;
        angle = rand(0, TAU);
      }
      directions.push(angle);
    }
    return directions;
  }

  function splashPointBiased(cx, cy, minDistance, maxDistance, directions, bias) {
    const useBias = directions.length > 0 && rng() < bias;
    const angle = useBias
      ? directions[randInt(0, directions.length - 1)] + rand(-CONFIG.splash.radialJitter, CONFIG.splash.radialJitter)
      : rand(0, TAU);
    const distance = rand(minDistance, maxDistance);
    return { x: cx + Math.cos(angle) * distance, y: cy + Math.sin(angle) * distance };
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
    if (gameOver || phase !== 'splash') return;

    const splashInk = new Set();
    const core = randInt(...CONFIG.splash.coreCount);
    const droplets = randInt(...CONFIG.splash.dropletCount);
    const specks = randInt(...CONFIG.splash.speckCount);
    const impact = splashPoint(cx, cy, ...CONFIG.splash.aimDrift);
    const directions = createSplashDirections();

    for (let i = 0; i < core; i++) {
      const p = splashPointBiased(
        impact.x, impact.y,
        i === 0 ? 4 : 12,
        i === 0 ? 25 : CONFIG.splash.spread * .58,
        directions,
        CONFIG.splash.radialBias.core
      );
      addBlob(p.x, p.y, rand(...CONFIG.splash.coreRadius), [2, 5], splashInk);
    }
    for (let i = 0; i < droplets; i++) {
      const p = splashPointBiased(
        impact.x, impact.y, 18, CONFIG.splash.spread,
        directions, CONFIG.splash.radialBias.droplet
      );
      addBlob(p.x, p.y, rand(...CONFIG.splash.dropletRadius), [1, 3], splashInk);
    }
    for (let i = 0; i < specks; i++) {
      const p = splashPointBiased(
        impact.x, impact.y, 27, CONFIG.splash.farSpread,
        directions, CONFIG.splash.radialBias.speck
      );
      addDisk(p.x, p.y, rand(...CONFIG.splash.speckRadius), splashInk);
    }

    pruneSmallIslands(splashInk, CONFIG.splash.minIslandArea);
    for (const k of splashInk) ink.add(k);

    refreshConnected();
    updateResources();
    phase = 'brush';
    brushRemaining = CONFIG.brushAreaPerTurn;
    updateHud();
    updateActionAvailability();
    render();
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
      x = rand(margin, Math.max(margin + 1, CONFIG.cols - margin));
      y = rand(bandLo + margin, bandHi - margin);
      const tooCloseHome = Math.hypot(x - h.x, y - h.y) < CONFIG.resources.minHomeDistance + radius;
      const overlaps = list.some(r =>
        Math.hypot(x - r.x, y - r.y) < radius + r.radius + CONFIG.resources.minGap
      );
      if (!tooCloseHome && !overlaps) break;
    }

    return {
      id, x, y, band, value, radius, sizeName: size.name,
      initiallyKnown: false,
      positionKnown: false,
      scoreKnown: false,
      coverage: 0,
      connectedCoverage: 0,
      owned: false,
      isTreasure,
    };
  }

  function scoreCandidates(min, max, used) {
    const step = CONFIG.resources.scoreStep;
    const start = Math.ceil(min / step) * step;
    const out = [];
    for (let value = start; value <= max; value += step) {
      if (!used.has(value)) out.push(value);
    }
    return out;
  }

  function takeUniqueScore(min, max, used) {
    const candidates = scoreCandidates(min, max, used);
    if (!candidates.length) throw new Error(`No unique score available in ${min}-${max}`);
    const value = candidates[randInt(0, candidates.length - 1)];
    used.add(value);
    return value;
  }

  function chooseScoreMode(rule) {
    const roll = rng();
    if (roll < rule.fullChance) return 'full';
    if (roll < rule.fullChance + rule.singleChance) return 'single';
    return 'normal';
  }

  function createBandScorePlan(name, count, used) {
    const rule = CONFIG.resources.scoreBands[name];
    const mode = chooseScoreMode(rule);
    const singleIndex = mode === 'single' ? randInt(0, count - 1) : -1;
    const values = [];

    for (let i = 0; i < count; i++) {
      if (mode === 'full') {
        values.push(takeUniqueScore(rule.hitMin, rule.normalMax, used));
      } else if (i === singleIndex) {
        values.push(takeUniqueScore(rule.hitMin, rule.singleMax, used));
      } else {
        values.push(takeUniqueScore(rule.normalMin, rule.normalMax, used));
      }
    }

    return { mode, values };
  }

  function createResources() {
    const list = [];
    const usedScores = new Set();
    const scorePlans = {};
    let id = 0;

    // Narrow score ranges are generated first so cross-band uniqueness never starves them.
    for (const band of [2, 1, 0]) {
      const name = BAND_NAMES[band];
      scorePlans[name] = createBandScorePlan(name, CONFIG.resources.counts[name], usedScores);
    }

    for (let band = 0; band < 3; band++) {
      const name = BAND_NAMES[band];
      const values = shuffled(scorePlans[name].values);
      const sizes = shuffled(CONFIG.resources.sizeDecks[name]);

      for (let i = 0; i < values.length; i++) {
        list.push(placeResource(list, band, values[i], sizes[i], id++));
      }
    }

    const treasureBand = randInt(0, 2);
    const treasure = placeResource(
      list,
      treasureBand,
      CONFIG.resources.treasureValue,
      CONFIG.resources.treasureSize,
      id++,
      true
    );
    list.push(treasure);

    for (let band = 0; band < 3; band++) {
      const knownCandidates = list.filter(resource => resource.band === band && !resource.isTreasure);
      const known = knownCandidates[randInt(0, knownCandidates.length - 1)];
      known.initiallyKnown = true;
      known.positionKnown = true;
    }

    return list;
  }

  function scoreToken(resource) {
    const stateClass = resource.owned ? ' owned' : resource.scoreKnown ? ' known' : '';
    const stateLabel = resource.owned ? '取得済み' : resource.scoreKnown ? '点数判明' : '未判明';
    return `<span class="score-token${stateClass}" aria-label="${resource.value}点 ${stateLabel}">${resource.value}</span>`;
  }

  function renderScoreBoard() {
    if (!scoreBoardEl) return;

    const rows = BAND_NAMES.map((name, band) => {
      const items = resources
        .filter(resource => !resource.isTreasure && resource.band === band)
        .sort((a, b) => a.value - b.value)
        .map(scoreToken)
        .join('');
      return `<div class="score-board-row">
        <span class="score-board-label">${BAND_LABELS[band]}</span>
        <div class="score-board-values">${items}</div>
      </div>`;
    }).join('');

    const treasure = resources.find(resource => resource.isTreasure);
    const special = treasure ? scoreToken(treasure) : '';
    scoreBoardEl.innerHTML = `${rows}
      <div class="score-board-row special">
        <span class="score-board-label">特別</span>
        <div class="score-board-values">${special}</div>
      </div>`;
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

  function showAcquiredFeedback(items) {
    if (!items.length) return;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    feedback = {
      title: items.length === 1 ? '取得' : `${items.length}個取得`,
      detail: `+${total}`,
    };
    feedbackTimer = setTimeout(() => {
      feedback = null;
      feedbackTimer = null;
      render();
    }, 1350);
  }

  function updateResources() {
    const acquiredNow = [];

    for (const resource of resources) {
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
    }

    renderScoreBoard();
    if (acquiredNow.length) showAcquiredFeedback(acquiredNow);
  }

  function refreshConnected() {
    const h = home();
    const queue = [];
    const active = new Set();

    for (const k of ink) {
      const p = parseKey(k);
      if (Math.hypot(p.x - h.x, p.y - h.y) <= CONFIG.homeRadius + 3) {
        active.add(k);
        queue.push(k);
      }
    }

    for (let i = 0; i < queue.length; i++) {
      const p = parseKey(queue[i]);
      for (const [dx,dy] of neighbors) {
        const nk = key(p.x + dx, p.y + dy);
        if (active.has(nk) || !ink.has(nk)) continue;
        active.add(nk);
        queue.push(nk);
      }
    }
    connected = active;
  }

  function activeBrushRadius() {
    return CONFIG.brushRadii[penSize];
  }

  function stampBrush(p, radius = activeBrushRadius()) {
    let spent = 0;
    const maxSpend = Math.floor(brushRemaining + EPS);
    if (maxSpend <= 0) return 0;

    for (let y = p.y - radius; y <= p.y + radius; y++) {
      for (let x = p.x - radius; x <= p.x + radius; x++) {
        if (!inBounds(x,y)) continue;
        if ((x-p.x)**2 + (y-p.y)**2 > radius*radius + 1) continue;
        const k = key(x,y);
        if (ink.has(k)) continue;
        if (spent >= maxSpend) return spent;
        ink.add(k);
        spent++;
      }
    }
    return spent;
  }

  function extendBrush(to) {
    if (!drawing || phase !== 'brush' || brushRemaining <= EPS) return;
    const from = drawing.last;
    const stepDist = Math.hypot(to.x - from.x, to.y - from.y);
    if (stepDist < .35) return;

    const ux = (to.x - from.x) / stepDist;
    const uy = (to.y - from.y) / stepDist;
    const steps = Math.max(1, Math.ceil(stepDist / .55));
    let last = from;
    let moved = false;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = {
        x: Math.round(from.x + ux * stepDist * t),
        y: Math.round(from.y + uy * stepDist * t),
      };
      const spent = stampBrush(p);
      brushRemaining = Math.max(0, brushRemaining - spent);
      last = p;
      moved = true;
      if (brushRemaining <= EPS) break;
    }

    drawing.last = last;
    drawing.moved = drawing.moved || moved;
    updateHud();
    render();

    if (brushRemaining <= EPS) {
      drawing = null;
      finishBrushPhase();
    }
  }

  function finishStroke() {
    if (!drawing) return;
    const moved = drawing.moved;
    drawing = null;
    if (!moved) {
      render();
      return;
    }
    refreshConnected();
    updateResources();
    updateHud();
    render();
  }

  function finishBrushPhase() {
    refreshConnected();
    updateResources();

    if (round >= CONFIG.rounds) {
      gameOver = true;
      updateHud();
      updateActionAvailability();
      render();
      setTimeout(showResult, 220);
      return;
    }

    round++;
    phase = 'splash';
    brushRemaining = CONFIG.brushAreaPerTurn;
    updateHud();
    updateActionAvailability();
    render();
  }

  function showResult() {
    finalScore.textContent = score;
    finalOwned.textContent = resources.filter(r => r.owned).length;
    result.hidden = false;
  }

  function selectPen(next) {
    if (gameOver || phase !== 'brush') return;
    penSize = next;
    updateActionAvailability();
    updateHud();
    render();
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
    const scale = Math.min(rect.width / CONFIG.cols, rect.height / CONFIG.rows);
    return {
      w: rect.width,
      h: rect.height,
      worldW: CONFIG.cols * scale,
      worldH: CONFIG.rows * scale,
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

  function renderCoinHalo(resource, m) {
    const x = (resource.x + .5) * m.sx;
    const y = (resource.y + .5) * m.sy;
    const radius = resource.radius * m.sx;
    const spread = 8 / camera.zoom;
    const outer = radius + spread;

    ctx.save();
    ctx.translate(x, y);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
    glow.addColorStop(0, 'rgba(255,255,255,.18)');
    glow.addColorStop(.56, 'rgba(255,255,255,.14)');
    glow.addColorStop(.78, 'rgba(255,255,255,.08)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, outer, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function renderPositionMarker(resource, m) {
    if (!resource.initiallyKnown || resource.coverage > 0 || resource.owned) return;
    const x = (resource.x + .5) * m.sx;
    const y = (resource.y + .5) * m.sy;
    const drift = 5 / camera.zoom;
    const dx = Math.sin((resource.id + 1) * 2.17) * drift;
    const dy = Math.cos((resource.id + 1) * 1.63) * drift * .65;
    const haloR = 19 / camera.zoom;

    ctx.save();
    ctx.translate(x + dx, y + dy);
    ctx.scale(1.25, .82);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
    halo.addColorStop(0, COLORS.positionSoft);
    halo.addColorStop(.48, 'rgba(96,119,124,.16)');
    halo.addColorStop(1, 'rgba(96,119,124,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x + dx, y + dy);
    ctx.globalAlpha = .62;
    ctx.fillStyle = COLORS.position;
    ctx.font = `800 ${9 / camera.zoom}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, .5 / camera.zoom);
    ctx.restore();
  }

  function renderCoin(resource, m) {
    const x = (resource.x + .5) * m.sx;
    const y = (resource.y + .5) * m.sy;
    const radius = resource.radius * m.sx;

    if (resource.owned) {
      renderCoinHalo(resource, m);
      ctx.save();
      ctx.translate(x,y);
      ctx.fillStyle = resource.isTreasure ? COLORS.treasure : COLORS.coin;
      ctx.beginPath();
      ctx.arc(0,0,radius,0,TAU);
      ctx.fill();
      ctx.fillStyle = COLORS.acquiredDark;
      ctx.font = `850 ${clamp(radius * .65, 11 / camera.zoom, 22 / camera.zoom)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(resource.value),0,.5 / camera.zoom);
      ctx.restore();
      return;
    }

    if (resource.coverage <= 0) {
      renderPositionMarker(resource, m);
      return;
    }

    renderCoinHalo(resource, m);

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
      const text = String(resource.value);
      const textY = .5 / camera.zoom;
      const lift = .8 / camera.zoom;
      ctx.save();
      ctx.translate(x,y);
      ctx.font = `850 ${clamp(radius * .56, 11 / camera.zoom, 20 / camera.zoom)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = .34;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 0, textY - lift);
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'rgba(18,31,34,.55)';
      ctx.shadowBlur = 2.2 / camera.zoom;
      ctx.shadowOffsetY = 2 / camera.zoom;
      ctx.fillStyle = COLORS.revealedText;
      ctx.fillText(text, 0, textY);
      ctx.restore();
    }
  }

  function renderFeedback(m) {
    if (!feedback) return;
    const centerX = m.w / 2;
    const top = 54;
    const width = Math.min(180, m.w - 40);
    const height = 44;

    ctx.save();
    ctx.fillStyle = COLORS.acquired;
    ctx.shadowColor = 'rgba(0,0,0,.20)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(centerX - width / 2, top, width, height, 13);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = COLORS.acquiredDark;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 12px system-ui';
    ctx.fillText(feedback.title, centerX - 18, top + height / 2);
    ctx.font = '900 20px system-ui';
    ctx.fillText(feedback.detail, centerX + 42, top + height / 2);
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
      ctx.fillStyle = connected.has(k) ? '#1f2927' : '#525755';
      ctx.fillRect(
        Math.floor(p.x * m.sx),
        Math.floor(p.y * m.sy),
        Math.ceil(m.sx + .5),
        Math.ceil(m.sy + .5)
      );
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

  function updateActionAvailability() {
    splashBtn.disabled = gameOver || phase !== 'splash';
    thinBtn.disabled = gameOver || phase !== 'brush';
    wideBtn.disabled = gameOver || phase !== 'brush';

    splashBtn.classList.toggle('active', phase === 'splash');
    thinBtn.classList.toggle('active', phase === 'brush' && penSize === 'thin');
    wideBtn.classList.toggle('active', phase === 'brush' && penSize === 'wide');

    splashLeftEl.textContent = `${round}/${CONFIG.rounds}`;
    penLoadEl.classList.toggle('inactive', phase !== 'brush' || gameOver);
  }

  function updateHud() {
    scoreEl.textContent = score;
    roundEl.textContent = `${round}/${CONFIG.rounds}`;
    ownedEl.textContent = resources.filter(r => r.owned).length;

    const ratio = clamp(brushRemaining / CONFIG.brushAreaPerTurn, 0, 1);
    inkFillEl.style.height = `${ratio * 100}%`;
    brushRemainingEl.textContent = String(Math.ceil(brushRemaining));
    penLoadEl.setAttribute('aria-valuenow', String(Math.ceil(brushRemaining)));
    penLoadEl.setAttribute('aria-valuemax', String(CONFIG.brushAreaPerTurn));

    if (gameOver) {
      hintEl.textContent = '終了';
    } else if (phase === 'splash') {
      hintEl.textContent = `ラウンド${round}：スプラッシュを1回`;
    } else {
      const penLabel = penSize === 'thin' ? '細筆' : '太筆';
      hintEl.textContent = `ラウンド${round}：${penLabel}　残りインク ${Math.ceil(brushRemaining)}`;
    }
  }

  function renderDistributionPanel() {
    distributionContent.innerHTML = BAND_NAMES.map((name, i) => {
      const rule = CONFIG.resources.scoreBands[name];
      const count = CONFIG.resources.counts[name];
      return `<div class="distribution-row">
        <strong>${BAND_LABELS[i]} <small>${count}個</small></strong>
        <span>通常 ${rule.normalMin}〜${rule.normalMax} / 当たり下限 ${rule.hitMin} / 単発上限 ${rule.singleMax}</span>
      </div>`;
    }).join('') + `
      <div class="distribution-row treasure-row">
        <strong>特別埋蔵</strong>
        <span>500×1（全層のどこか・小8固定）</span>
      </div>
      <p class="distribution-note">通常14個＋特別500の合計15個。通常点は10点刻みで全14個重複なし。通常・単発当たり・全体当たりがあり、当たりは毎回保証されず複数層で起こることもある。全体当たりは下限だけ上がり、単発当たりは1個だけ上限が広がる。サイズは上層=小2/中3/大1、中層=小2/中1/大2、下層=小1/中1/大1。30%で点数判明、70%以上を塗ってSTARTへ接続すると取得。</p>`;
  }

  function reset(useSameSeed) {
    if (!useSameSeed) seed = randomSeed();
    rng = mulberry32(seed);
    syncBoardWidthToViewport();
    ink = new Set();
    connected = new Set();
    resources = createResources();
    score = 0;
    round = 1;
    phase = 'splash';
    penSize = 'thin';
    brushRemaining = CONFIG.brushAreaPerTurn;
    drawing = null;
    pendingSplash = null;
    gesture = null;
    pointers.clear();
    gameOver = false;
    feedback = null;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = null;
    result.hidden = true;
    distributionPanel.hidden = true;

    const h = home();
    addDisk(h.x, h.y, CONFIG.homeRadius);
    refreshConnected();
    updateResources();
    updateHud();
    updateActionAvailability();
    resetCamera();
    renderDistributionPanel();
    render();
  }

  function beginTwoFingerGesture() {
    const points = [...pointers.values()];
    if (points.length !== 2) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (points[0].x + points[1].x) / 2 - rect.left;
    const my = (points[0].y + points[1].y) / 2 - rect.top;
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1;

    if (drawing) finishStroke();
    pendingSplash = null;
    gesture = {
      distance,
      zoom: camera.zoom,
      wx: (mx - camera.tx) / camera.zoom,
      wy: (my - camera.ty) / camera.zoom,
    };
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
    if (phase === 'splash') {
      pendingSplash = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }

    if (brushRemaining <= EPS) return;
    drawing = { pointerId: event.pointerId, last: p, moved: false };
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
    }
  });

  function endPointer(event) {
    const wasPendingSplash = pendingSplash && pendingSplash.pointerId === event.pointerId;
    const shouldFinishStroke = drawing && drawing.pointerId === event.pointerId;
    pointers.delete(event.pointerId);

    if (wasPendingSplash && !gesture && pointers.size === 0) {
      const p = pointerToCell(event);
      pendingSplash = null;
      splashAt(p.x, p.y);
    } else if (wasPendingSplash) {
      pendingSplash = null;
    }

    if (shouldFinishStroke && !gesture) finishStroke();
    if (pointers.size < 2) gesture = null;
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', event => {
    pointers.delete(event.pointerId);
    pendingSplash = null;
    if (drawing && drawing.pointerId === event.pointerId) finishStroke();
    if (pointers.size < 2) gesture = null;
  });

  splashBtn.addEventListener('click', () => {
    if (!gameOver && phase === 'splash') {
      hintEl.textContent = `ラウンド${round}：盤面をタップしてスプラッシュ`;
    }
  });
  thinBtn.addEventListener('click', () => selectPen('thin'));
  wideBtn.addEventListener('click', () => selectPen('wide'));
  newBtn.addEventListener('click', () => reset(false));
  retryBtn.addEventListener('click', () => reset(true));
  nextBtn.addEventListener('click', () => reset(false));
  zoomInBtn.addEventListener('click', () => zoomTo(camera.zoom + CONFIG.zoom.step));
  zoomOutBtn.addEventListener('click', () => zoomTo(camera.zoom - CONFIG.zoom.step));
  zoomResetBtn.addEventListener('click', resetCamera);

  distributionBtn.addEventListener('click', () => {
    distributionPanel.hidden = !distributionPanel.hidden;
  });
  distributionClose.addEventListener('click', () => {
    distributionPanel.hidden = true;
  });
  window.addEventListener('resize', resizeCanvas);

  requestAnimationFrame(() => {
    resizeCanvas();
    reset(true);
  });
})();
