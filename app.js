(() => {
  'use strict';

  const GRID_SCALE = 2;
  const BOARD_WIDTH = 420;
  const BOARD_HEIGHT = 870;

  const CONFIG = {
    cols: BOARD_WIDTH,
    rows: BOARD_HEIGHT,
    rounds: 4,
    brushAreaPerTurn: 650 * GRID_SCALE * GRID_SCALE,
    starterPuddle: { radius: 84 * GRID_SCALE },
    brushRadii: { thin: 3 * GRID_SCALE, wide: 6 * GRID_SCALE },
    scoreRevealCoverage: 0.30,
    acquireCoverage: 0.70,
    zoom: { min: 1, default: 1, max: 1.35, step: 0.10 },
    splash: {
      // Three-tier splash: a few large and medium islands, then small ones fill the area budget.
      coreCount: [2, 4],
      mediumCount: [2, 4],
      dropletCount: [2, 12],
      speckCount: [0, 0],
      coreRadius: [10 * GRID_SCALE, 15 * GRID_SCALE],
      mediumRadius: [6 * GRID_SCALE, 10 * GRID_SCALE],
      dropletRadius: [3 * GRID_SCALE, 6 * GRID_SCALE],
      speckRadius: [3 * GRID_SCALE, 5 * GRID_SCALE],
      spread: 60 * GRID_SCALE,
      farSpread: 84 * GRID_SCALE,
      aimDrift: [0, 0],
      minIslandArea: 12 * GRID_SCALE * GRID_SCALE,
      targetArea: [2200 * GRID_SCALE * GRID_SCALE, 2400 * GRID_SCALE * GRID_SCALE],
      radialDirections: [2, 3],
      radialJitter: 1.0,
      radialBias: { core: 0.40, medium: 0.45, droplet: 0.50, speck: 0.58 },
    },
    resources: {
      minHomeDistance: 84 * GRID_SCALE,
      minGap: 10 * GRID_SCALE,
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
          { name: 'small', radius: 8 * GRID_SCALE },
          { name: 'small', radius: 8 * GRID_SCALE },
          { name: 'medium', radius: 12 * GRID_SCALE },
          { name: 'medium', radius: 12 * GRID_SCALE },
          { name: 'medium', radius: 12 * GRID_SCALE },
          { name: 'large', radius: 16 * GRID_SCALE },
        ],
        middle: [
          { name: 'small', radius: 8 * GRID_SCALE },
          { name: 'small', radius: 8 * GRID_SCALE },
          { name: 'medium', radius: 12 * GRID_SCALE },
          { name: 'large', radius: 16 * GRID_SCALE },
          { name: 'large', radius: 16 * GRID_SCALE },
        ],
        lower: [
          { name: 'small', radius: 8 * GRID_SCALE },
          { name: 'medium', radius: 12 * GRID_SCALE },
          { name: 'large', radius: 16 * GRID_SCALE },
        ],
      },
    },
  };

  const BAND_NAMES = ['upper', 'middle', 'lower'];
  const BAND_LABELS = ['上層', '中層', '下層'];
  const BAND_BASELINES = [225, 130, 65];
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
  const appShell = document.querySelector('.app-shell');
  const actionsEl = document.querySelector('.actions');
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
  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');
  const highScoreList = document.getElementById('highScoreList');
  const turnOverlay = document.getElementById('turnOverlay');
  const turnOverlayText = document.getElementById('turnOverlayText');
  const HIGH_SCORE_KEY = 'inkResource.bestRuns.v1';
  const HIGH_SCORE_LIMIT = 3;

  let seed = randomSeed();
  let rng = mulberry32(seed);
  let ink = new Set();
  let starterInk = new Set();
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
  let actionDrag = null;
  let actionsMoved = false;
  let turnOverlayTimer = null;
  let turnOverlayToken = 0;

  const pointers = new Map();
  const camera = { zoom: CONFIG.zoom.default, tx: 0, ty: 0 };

  function randomSeed() {
    return (Math.random() * 0xffffffff) >>> 0;
  }

  function readHighScores() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter(entry => entry && Number.isFinite(Number(entry.score))).slice(0, HIGH_SCORE_LIMIT)
        : [];
    } catch (_) {
      return [];
    }
  }

  function writeHighScores(list) {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(list.slice(0, HIGH_SCORE_LIMIT)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function formatHighScoreDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function renderHighScores() {
    if (!highScoreList) return;
    const list = readHighScores();
    if (!list.length) {
      highScoreList.innerHTML = '<li class="high-score-empty">まだ記録なし</li>';
      return;
    }
    highScoreList.innerHTML = list.map((entry, index) => `
      <li class="high-score-row">
        <span class="high-score-rank">${index + 1}</span>
        <strong class="high-score-score">${Number(entry.score).toLocaleString('ja-JP')}</strong>
        <span class="high-score-meta">取得 ${Number(entry.owned) || 0}個<br>${formatHighScoreDate(entry.date)}</span>
      </li>`).join('');
  }

  function recordHighScore() {
    const record = {
      score: Number(score) || 0,
      owned: resources.filter(resource => resource.owned).length,
      date: new Date().toISOString(),
    };
    const list = readHighScores();
    list.push(record);
    list.sort((a, b) =>
      Number(b.score) - Number(a.score) ||
      Number(b.owned || 0) - Number(a.owned || 0) ||
      String(a.date || '').localeCompare(String(b.date || ''))
    );
    writeHighScores(list.slice(0, HIGH_SCORE_LIMIT));
    renderHighScores();
  }

  function hideTurnOverlay() {
    turnOverlayToken += 1;
    if (turnOverlayTimer) clearTimeout(turnOverlayTimer);
    turnOverlayTimer = null;
    turnOverlay.classList.remove('leaving');
    turnOverlay.hidden = true;
  }

  function showTurnOverlay(text, duration = 1000, onDone = null) {
    const token = ++turnOverlayToken;
    if (turnOverlayTimer) clearTimeout(turnOverlayTimer);
    turnOverlayTimer = null;
    turnOverlayText.textContent = text;
    turnOverlay.classList.remove('leaving');
    turnOverlay.hidden = false;

    turnOverlayTimer = setTimeout(() => {
      if (token !== turnOverlayToken) return;
      turnOverlay.classList.add('leaving');
      turnOverlayTimer = setTimeout(() => {
        if (token !== turnOverlayToken) return;
        turnOverlay.hidden = true;
        turnOverlay.classList.remove('leaving');
        turnOverlayTimer = null;
        if (onDone) onDone();
      }, 420);
    }, duration);
  }

  function showRoundIntro() {
    const remaining = CONFIG.rounds - round + 1;
    showTurnOverlay(`残り ${remaining}巡`, 1250, () => {
      showTurnOverlay('スプラッシュ', 1000);
    });
  }

  function showMarkerIntro() {
    showTurnOverlay('マーカー', 1000);
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

  function starterAnchor() {
  const radius = CONFIG.starterPuddle.radius;
  return {
    x: Math.floor(CONFIG.cols / 2),
    y: CONFIG.rows - 1 - Math.round(radius * .20),
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

  function carveDisk(cx, cy, radius, target, maxY = CONFIG.rows - 1) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
      if (y > maxY || y < 0 || y >= CONFIG.rows) continue;
      for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
        if (!inBounds(x, y)) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2 + rand(-1.0, 1.0)) target.delete(key(x, y));
      }
    }
  }

  function addBlob(cx, cy, baseRadius, lobes = [2, 5], target = ink) {
    // Legacy overlapping-disk blob kept for non-splash experiments.
    addDisk(cx, cy, baseRadius * rand(.58, .76), target);
    const count = randInt(...lobes);
    const hero = randInt(0, Math.max(0, count - 1));
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const outer = i === hero;
      const dist = outer
        ? rand(baseRadius * .70, baseRadius * .96)
        : rand(baseRadius * .46, baseRadius * .90);
      const lobeRadius = baseRadius * rand(
        outer ? .42 : .34,
        outer ? .62 : .58
      );
      addDisk(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        lobeRadius,
        target
      );
    }
  }

  function splashAngleDiff(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  function splashPointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;
      const crosses = (yi > y) !== (yj > y);
      if (!crosses) continue;
      const edgeX = (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi;
      if (x < edgeX) inside = !inside;
    }
    return inside;
  }

  function addShapeFirstSplashIsland(cx, cy, baseRadius, flowDirection, kind, target = ink) {
    // Build one smooth irregular outline first, then rasterize that outline to
    // the same cell set used by rendering, connectivity and resource checks.
    const core = kind === 'core';
    const pointCount = core ? 34 : 28;
    const freqA = randInt(2, 3);
    let freqB = randInt(3, 5);
    if (freqB === freqA) freqB += 1;
    const phaseA = rand(0, TAU);
    const phaseB = rand(0, TAU);
    const ampA = rand(core ? .11 : .13, core ? .18 : .21);
    const ampB = rand(core ? .035 : .045, core ? .080 : .095);
    const forwardAmp = rand(core ? .035 : .025, core ? .085 : .070);
    const stretch = rand(.94, 1.06);
    const rotation = rand(-.20, .20);
    const cr = Math.cos(rotation);
    const sr = Math.sin(rotation);
    const points = [];

    for (let i = 0; i < pointCount; i++) {
      const angle = i / pointCount * TAU;
      const worldAngle = angle + rotation;
      const forward = Math.max(0, Math.cos(splashAngleDiff(worldAngle, flowDirection)));
      const radial = 1
        + ampA * Math.sin(freqA * angle + phaseA)
        + ampB * Math.sin(freqB * angle + phaseB)
        + forwardAmp * forward * forward;
      const px = Math.cos(angle) * baseRadius * radial * stretch;
      const py = Math.sin(angle) * baseRadius * radial / stretch;
      points.push({
        x: cx + px * cr - py * sr,
        y: cy + px * sr + py * cr,
      });
    }

    const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))) - 1);
    const maxX = Math.min(CONFIG.cols - 1, Math.ceil(Math.max(...points.map(p => p.x))) + 1);
    const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))) - 1);
    const maxY = Math.min(CONFIG.rows - 1, Math.ceil(Math.max(...points.map(p => p.y))) + 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (splashPointInPolygon(x + .5, y + .5, points)) target.add(key(x, y));
      }
    }
  }

  function addTaperedCellStroke(x0, y0, x1, y1, startRadius, endRadius, target) {
    const distance = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.ceil(distance / 1.1));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const radius = startRadius + (endRadius - startRadius) * t;
      const jitter = Math.sin(t * Math.PI) * .22;
      addDisk(
        x0 + (x1 - x0) * t + rand(-jitter, jitter),
        y0 + (y1 - y0) * t + rand(-jitter, jitter),
        Math.max(.72, radius),
        target
      );
    }
  }

  function addDirectionalInkBlob(cx, cy, baseRadius, flowDirection, kind, target = ink) {
    const ux = Math.cos(flowDirection);
    const uy = Math.sin(flowDirection);
    const vx = -uy;
    const vy = ux;
    const core = kind === 'core';

    addDisk(
      cx - ux * baseRadius * rand(.04, .12),
      cy - uy * baseRadius * rand(.04, .12),
      baseRadius * rand(core ? .76 : .74, core ? .92 : .88),
      target
    );
    addDisk(
      cx + ux * baseRadius * rand(.10, .24),
      cy + uy * baseRadius * rand(.10, .24),
      baseRadius * rand(core ? .48 : .42, core ? .68 : .60),
      target
    );

    const lobeCount = core ? randInt(2, 4) : randInt(1, 2);
    for (let i = 0; i < lobeCount; i++) {
      const side = rng() < .5 ? -1 : 1;
      const along = rand(-.28, .18) * baseRadius;
      const across = side * rand(.18, .58) * baseRadius;
      addDisk(
        cx + ux * along + vx * across,
        cy + uy * along + vy * across,
        baseRadius * rand(core ? .24 : .22, core ? .48 : .40),
        target
      );
    }

    const tipLength = baseRadius * rand(core ? .42 : .30, core ? .86 : .62);
    const rootX = cx + ux * baseRadius * rand(.30, .46);
    const rootY = cy + uy * baseRadius * rand(.30, .46);
    addTaperedCellStroke(
      rootX,
      rootY,
      rootX + ux * tipLength + vx * rand(-.10, .10) * baseRadius,
      rootY + uy * tipLength + vy * rand(-.10, .10) * baseRadius,
      baseRadius * rand(core ? .12 : .10, core ? .20 : .16),
      rand(.72, 1.02),
      target
    );

    if (rng() < (core ? .62 : .34)) {
      const side = rng() < .5 ? -1 : 1;
      const sx = cx + ux * baseRadius * rand(-.08, .16) + vx * side * baseRadius * rand(.22, .42);
      const sy = cy + uy * baseRadius * rand(-.08, .16) + vy * side * baseRadius * rand(.22, .42);
      const len = baseRadius * rand(.24, core ? .56 : .42);
      const angle = flowDirection + side * rand(.48, .92);
      addTaperedCellStroke(
        sx, sy,
        sx + Math.cos(angle) * len,
        sy + Math.sin(angle) * len,
        baseRadius * rand(.09, .15),
        rand(.68, .92),
        target
      );
    }
  }

  function createStarterPuddle() {
    const target = new Set();
    const radius = CONFIG.starterPuddle.radius;
    const edge = CONFIG.rows - 1;
    const cx = starterAnchor().x + rand(-2.5 * GRID_SCALE, 2.5 * GRID_SCALE);

    // Build a full 2D ink mass first. The visible top contour is only a result
    // of cropping that mass at the bottom of the board; it is not generated as
    // a height profile or a row of hills.
    const bodies = [
      {
        x: cx + radius * rand(-.26, -.10),
        radius: radius * rand(.44, .50),
        depth: rand(.45, .58),
      },
      {
        x: cx + radius * rand(-.02, .14),
        radius: radius * rand(.43, .49),
        depth: rand(.47, .60),
      },
      {
        x: cx + radius * rand(.20, .36),
        radius: radius * rand(.32, .42),
        depth: rand(.50, .65),
      },
    ];

    for (const body of bodies) {
      body.y = edge + body.radius * body.depth;
      addDisk(body.x, body.y, body.radius, target);
    }

    // Broad perimeter lobes belong to the mass itself rather than sitting on a
    // flat baseline. Their size and spacing vary independently.
    const lobeCount = randInt(4, 7);
    for (let i = 0; i < lobeCount; i++) {
      const body = bodies[randInt(0, bodies.length - 1)];
      const angle = rand(205, 335) * Math.PI / 180;
      const lobeRadius = radius * rand(.035, .085);
      const distance = body.radius + lobeRadius * rand(-.16, .22);
      addDisk(
        body.x + Math.cos(angle) * distance,
        body.y + Math.sin(angle) * distance,
        lobeRadius,
        target
      );
    }

    // A few short fluid projections add necks and rounded tips. They grow from
    // the 2D mass itself, not from a horizontal top edge.
    const armCount = randInt(3, 6);
    for (let i = 0; i < armCount; i++) {
      const body = bodies[randInt(0, bodies.length - 1)];
      const angle = rand(205, 335) * Math.PI / 180;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const rootDistance = body.radius * rand(.70, .86);
      const length = radius * rand(.06, .18);
      const startRadius = radius * rand(.015, .035);
      const endRadius = radius * rand(.035, .070);
      const x0 = body.x + ux * rootDistance;
      const y0 = body.y + uy * rootDistance;
      const x1 = x0 + ux * length;
      const y1 = y0 + uy * length;

      addTaperedCellStroke(x0, y0, x1, y1, startRadius, endRadius, target);
      addDisk(x1, y1, endRadius * rand(.95, 1.15), target);
    }

    // Find the real outside contour of the mass and cut only valleys that are
    // open to that exterior. This avoids internal holes and avoids inventing a
    // separate top-edge profile.
    function starterTopAt(sampleX, window = 2 * GRID_SCALE) {
      const left = Math.max(0, Math.floor(sampleX - window));
      const right = Math.min(CONFIG.cols - 1, Math.ceil(sampleX + window));
      for (let y = 0; y <= edge; y++) {
        for (let x = left; x <= right; x++) {
          if (target.has(key(x, y))) return y;
        }
      }
      return null;
    }

    const valleyCount = randInt(2, 4);
    for (let i = 0; i < valleyCount; i++) {
      let x = cx;
      let top = null;
      for (let tries = 0; tries < 30; tries++) {
        x = Math.round(cx + radius * rand(-.55, .55));
        top = starterTopAt(x);
        if (top !== null && top < edge - 5 * GRID_SCALE) break;
      }
      if (top === null) continue;

      const valleyRadius = radius * rand(.035, .070);
      carveDisk(
        x,
        top + valleyRadius * rand(.15, .35),
        valleyRadius,
        target
      );
    }

    // Only the mass connected to the board bottom is gameplay START. If a cut
    // detaches a small cap, it is discarded instead of becoming a loose droplet.
    const queue = [];
    const active = new Set();
    for (const k of target) {
      const p = parseKey(k);
      if (p.y < CONFIG.rows - 2) continue;
      active.add(k);
      queue.push(k);
    }
    for (let i = 0; i < queue.length; i++) {
      const p = parseKey(queue[i]);
      for (const [dx, dy] of neighbors) {
        const nk = key(p.x + dx, p.y + dy);
        if (active.has(nk) || !target.has(nk)) continue;
        active.add(nk);
        queue.push(nk);
      }
    }

    starterInk = active.size ? active : target;
    for (const k of starterInk) ink.add(k);
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
    const medium = randInt(...CONFIG.splash.mediumCount);
    const targetArea = rand(...CONFIG.splash.targetArea);
    const impact = { x: cx, y: cy };
    const directions = createSplashDirections();

    // Large and medium islands take predictable shares of the budget. Their
    // counts vary from 2-4, so the derived radii naturally shrink as count rises.
    const coreShare = .58;
    const mediumShare = .27;
    const idealCoreRadius = Math.sqrt((targetArea * coreShare / core) / Math.PI);
    const idealMediumRadius = Math.sqrt((targetArea * mediumShare / medium) / Math.PI);

    for (let i = 0; i < core; i++) {
      const p = splashPointBiased(
        impact.x,
        impact.y,
        i === 0 ? 0 : 10 * GRID_SCALE,
        i === 0 ? 12 * GRID_SCALE : CONFIG.splash.spread,
        directions,
        CONFIG.splash.radialBias.core
      );
      const flow = Math.atan2(p.y - impact.y, p.x - impact.x) || rand(0, TAU);
      const radius = clamp(
        idealCoreRadius * rand(.94, 1.06),
        ...CONFIG.splash.coreRadius
      );
      addShapeFirstSplashIsland(
        p.x,
        p.y,
        radius,
        flow,
        'core',
        splashInk
      );
    }

    for (let i = 0; i < medium; i++) {
      const p = splashPointBiased(
        impact.x,
        impact.y,
        16 * GRID_SCALE,
        CONFIG.splash.spread,
        directions,
        CONFIG.splash.radialBias.medium
      );
      const flow = Math.atan2(p.y - impact.y, p.x - impact.x) || rand(0, TAU);
      const radius = clamp(
        idealMediumRadius * rand(.92, 1.08),
        ...CONFIG.splash.mediumRadius
      );
      addShapeFirstSplashIsland(
        p.x,
        p.y,
        radius,
        flow,
        'medium',
        splashInk
      );
    }

    const [minDroplets, maxDroplets] = CONFIG.splash.dropletCount;
    let droplets = 0;
    while (droplets < maxDroplets && (droplets < minDroplets || splashInk.size < targetArea)) {
      const p = splashPointBiased(
        impact.x,
        impact.y,
        26 * GRID_SCALE,
        CONFIG.splash.farSpread,
        directions,
        CONFIG.splash.radialBias.droplet
      );
      const flow = Math.atan2(p.y - impact.y, p.x - impact.x) || rand(0, TAU);
      addShapeFirstSplashIsland(
        p.x,
        p.y,
        rand(...CONFIG.splash.dropletRadius),
        flow,
        'droplet',
        splashInk
      );
      droplets += 1;
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
    showMarkerIntro();
  }

  function placeResource(list, band, value, size, id, isTreasure = false) {
    const radius = size.radius;
    const bandLo = band / 3 * CONFIG.rows;
    const bandHi = (band + 1) / 3 * CONFIG.rows;
    const margin = Math.ceil(radius + 8 * GRID_SCALE);
    const anchor = starterAnchor();
    let x = CONFIG.cols / 2;
    let y = (bandLo + bandHi) / 2;

    for (let tries = 0; tries < 360; tries++) {
      x = rand(margin, Math.max(margin + 1, CONFIG.cols - margin));
      y = rand(bandLo + margin, bandHi - margin);
      const tooCloseStarter = Math.hypot(x - anchor.x, y - anchor.y) < CONFIG.resources.minHomeDistance + radius;
      const overlaps = list.some(r =>
        Math.hypot(x - r.x, y - r.y) < radius + r.radius + CONFIG.resources.minGap
      );
      if (!tooCloseStarter && !overlaps) break;
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
        <div class="score-board-baseline" aria-label="${BAND_LABELS[band]}の基準点 ${BAND_BASELINES[band]}点">
          <span>基準</span>
          <strong>${BAND_BASELINES[band]}</strong>
        </div>
        <span class="score-board-label">${BAND_LABELS[band]}</span>
        <div class="score-board-values">${items}</div>
      </div>`;
    }).join('');

    scoreBoardEl.innerHTML = rows;
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
    const queue = [];
    const active = new Set();

    // Connectivity originates from the starter puddle itself, not an invisible point.
    for (const k of starterInk) {
      if (!ink.has(k)) continue;
      active.add(k);
      queue.push(k);
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
    showRoundIntro();
  }

  function showResult() {
    finalScore.textContent = score;
    finalOwned.textContent = resources.filter(r => r.owned).length;
    recordHighScore();
    result.hidden = false;
  }

  function selectPen(next) {
    if (gameOver || phase !== 'brush') return;
    penSize = next;
    updateActionAvailability();
    updateHud();
    render();
  }

  function actionToolbarBounds() {
  const shellRect = appShell.getBoundingClientRect();
  const boardRect = boardWrap.getBoundingClientRect();
  const toolRect = actionsEl.getBoundingClientRect();
  const margin = 4;
  const minLeft = boardRect.left - shellRect.left + margin;
  const minTop = boardRect.top - shellRect.top + margin;
  const maxLeft = Math.max(minLeft, boardRect.right - shellRect.left - toolRect.width - margin);
  const maxTop = Math.max(minTop, boardRect.bottom - shellRect.top - toolRect.height - margin);
  return { minLeft, minTop, maxLeft, maxTop };
}

function positionActionToolbar(left, top) {
  const bounds = actionToolbarBounds();
  actionsEl.style.left = `${clamp(left, bounds.minLeft, bounds.maxLeft)}px`;
  actionsEl.style.top = `${clamp(top, bounds.minTop, bounds.maxTop)}px`;
  actionsEl.style.right = 'auto';
  actionsEl.style.bottom = 'auto';
  actionsMoved = true;
}

function keepActionToolbarInBounds() {
  if (!actionsMoved) return;
  const shellRect = appShell.getBoundingClientRect();
  const rect = actionsEl.getBoundingClientRect();
  positionActionToolbar(rect.left - shellRect.left, rect.top - shellRect.top);
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
      const penLabel = penSize === 'thin' ? '細ペン' : '太ペン';
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
      <p class="distribution-note">通常14個。点数は10点刻みで全14個重複なし。通常・単発当たり・全体当たりがあり、当たりは毎回保証されず複数層で起こることもある。全体当たりは下限だけ上がり、単発当たりは1個だけ上限が広がる。サイズは上層=小2/中3/大1、中層=小2/中1/大2、下層=小1/中1/大1。30%で点数判明、70%以上を塗って起点のインク溜まりへ接続すると取得。</p>`;
  }

  function reset(useSameSeed) {
    if (!useSameSeed) seed = randomSeed();
    rng = mulberry32(seed);
    ink = new Set();
    starterInk = new Set();
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
    hideTurnOverlay();

    createStarterPuddle();
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

  actionsEl.addEventListener('pointerdown', event => {
  if (event.target.closest('.action')) return;
  if (gameOver || phase !== 'brush') return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  const rect = actionsEl.getBoundingClientRect();
  const shellRect = appShell.getBoundingClientRect();
  actionDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };

  actionsEl.style.left = `${rect.left - shellRect.left}px`;
  actionsEl.style.top = `${rect.top - shellRect.top}px`;
  actionsEl.style.right = 'auto';
  actionsEl.style.bottom = 'auto';
  actionsEl.classList.add('dragging');
  actionsEl.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});

actionsEl.addEventListener('pointermove', event => {
  if (!actionDrag || actionDrag.pointerId !== event.pointerId) return;
  const shellRect = appShell.getBoundingClientRect();
  positionActionToolbar(
    event.clientX - shellRect.left - actionDrag.offsetX,
    event.clientY - shellRect.top - actionDrag.offsetY
  );
  event.preventDefault();
});

function endActionToolbarDrag(event) {
  if (!actionDrag || actionDrag.pointerId !== event.pointerId) return;
  actionDrag = null;
  actionsEl.classList.remove('dragging');
  try {
    if (actionsEl.hasPointerCapture?.(event.pointerId)) actionsEl.releasePointerCapture(event.pointerId);
  } catch (_) {}
}

actionsEl.addEventListener('pointerup', endActionToolbarDrag);
actionsEl.addEventListener('pointercancel', endActionToolbarDrag);
actionsEl.addEventListener('lostpointercapture', event => {
  if (actionDrag && actionDrag.pointerId === event.pointerId) {
    actionDrag = null;
    actionsEl.classList.remove('dragging');
  }
});

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
  startBtn.addEventListener('click', () => {
    startScreen.hidden = true;
    requestAnimationFrame(() => {
      resizeCanvas();
      render();
      showRoundIntro();
    });
  });
  newBtn.addEventListener('click', () => { reset(false); showRoundIntro(); });
  retryBtn.addEventListener('click', () => { reset(true); showRoundIntro(); });
  nextBtn.addEventListener('click', () => { reset(false); showRoundIntro(); });
  zoomInBtn.addEventListener('click', () => zoomTo(camera.zoom + CONFIG.zoom.step));
  zoomOutBtn.addEventListener('click', () => zoomTo(camera.zoom - CONFIG.zoom.step));
  zoomResetBtn.addEventListener('click', resetCamera);

  distributionBtn.addEventListener('click', () => {
    distributionPanel.hidden = !distributionPanel.hidden;
  });
  distributionClose.addEventListener('click', () => {
    distributionPanel.hidden = true;
  });
  window.addEventListener('resize', () => {
    resizeCanvas();
    if (actionsMoved) requestAnimationFrame(keepActionToolbarInBounds);
  });

  requestAnimationFrame(() => {
    renderHighScores();
    resizeCanvas();
    reset(true);
  });
})();
