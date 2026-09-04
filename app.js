(() => {
  'use strict';

  const CONFIG = {
    cols: 208,
    rows: 450,
    rounds: 4,
    brushAreaPerTurn: 650,
    starterPuddle: { radius: 30 },
    brushRadii: { thin: 3, wide: 6 },
    scoreRevealCoverage: 0.30,
    acquireCoverage: 0.70,
    zoom: { min: 1, default: 1, max: 1.35, step: 0.10 },
    splash: {
      coreCount: [2, 4],
      dropletCount: [2, 4],
      speckCount: [3, 6],
      coreRadius: [7.2, 10.2],
      dropletRadius: [2.8, 4.4],
      speckRadius: [1.0, 1.8],
      coreSpread: 25,
      spread: 40,
      farSpread: 58,
      aimDrift: [10, 24],
      radialDirections: [2, 3],
      radialJitter: 0.72,
      radialBias: { core: 0.55, droplet: 0.60, speck: 0.62 },
    },
    resources: {
      minHomeDistance: 48,
      minGap: 10,
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
    },
  };

  const BAND_NAMES = ['upper', 'middle', 'lower'];
  const BAND_LABELS = ['上層', '中層', '下層'];
  const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
  const TAU = Math.PI * 2;
  const TAP_MOVE_PX = 5;
  const EPS = 0.01;

  // One connected brush-splat silhouette. Detached starter droplets are intentionally omitted.
  const STARTER_SHAPE = [
    [1.000,0.867],[0.957,0.908],[0.947,0.900],[0.941,0.933],[0.920,0.925],
    [0.888,0.958],[0.877,0.942],[0.882,0.908],[0.920,0.850],[0.930,0.800],
    [0.904,0.825],[0.904,0.792],[0.824,0.933],[0.759,0.967],[0.754,0.950],
    [0.775,0.900],[0.722,0.983],[0.701,0.967],[0.701,0.933],[0.674,0.975],
    [0.642,0.917],[0.663,0.900],[0.615,0.900],[0.615,0.875],[0.594,0.875],
    [0.599,0.842],[0.588,0.825],[0.631,0.808],[0.679,0.733],[0.642,0.775],
    [0.626,0.758],[0.695,0.667],[0.636,0.717],[0.599,0.725],[0.583,0.692],
    [0.631,0.592],[0.561,0.625],[0.551,0.575],[0.508,0.633],[0.492,0.583],
    [0.497,0.550],[0.529,0.517],[0.529,0.458],[0.556,0.375],[0.647,0.308],
    [0.679,0.233],[0.679,0.158],[0.668,0.175],[0.626,0.142],[0.626,0.050],
    [0.642,0.000],[0.631,0.033],[0.583,0.025],[0.529,0.075],[0.513,0.125],
    [0.513,0.175],[0.529,0.217],[0.513,0.300],[0.529,0.250],[0.561,0.217],
    [0.572,0.350],[0.513,0.467],[0.503,0.458],[0.481,0.483],[0.465,0.533],
    [0.471,0.433],[0.444,0.558],[0.428,0.583],[0.406,0.575],[0.412,0.542],
    [0.396,0.508],[0.412,0.500],[0.396,0.483],[0.396,0.442],[0.385,0.517],
    [0.364,0.542],[0.364,0.575],[0.385,0.608],[0.369,0.633],[0.337,0.608],
    [0.353,0.492],[0.337,0.575],[0.326,0.592],[0.310,0.575],[0.305,0.508],
    [0.337,0.317],[0.316,0.367],[0.316,0.458],[0.294,0.500],[0.289,0.550],
    [0.257,0.608],[0.230,0.625],[0.198,0.550],[0.193,0.392],[0.187,0.683],
    [0.150,0.733],[0.139,0.717],[0.139,0.650],[0.139,0.725],[0.118,0.842],
    [0.102,0.842],[0.086,0.758],[0.064,0.858],[0.005,0.917],[0.011,0.992],
    [0.000,1.000],[0.567,1.000],[0.572,0.967],[0.604,0.933],[0.658,0.958],
    [0.674,0.983],[0.668,1.000],[0.930,1.000],[0.979,0.942],
  ];

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
  let splashShapes = [];
  let splashVisualInk = new Set();

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

  function starterAnchor() {
    const radius = CONFIG.starterPuddle.radius;
    return {
      x: Math.floor(CONFIG.cols / 2),
      y: CONFIG.rows - 1 - Math.round(radius * .20),
    };
  }

  function starterShapeBounds() {
    const radius = CONFIG.starterPuddle.radius;
    const width = radius * 1.93;
    const height = radius * 1.23;
    return {
      left: starterAnchor().x - width / 2,
      top: CONFIG.rows - height,
      width,
      height,
    };
  }

  function starterShapePoints() {
    const bounds = starterShapeBounds();
    return STARTER_SHAPE.map(([u, v]) => ({
      x: bounds.left + u * bounds.width,
      y: bounds.top + v * bounds.height,
    }));
  }

  function inBounds(x, y) {
    return x >= 0 && x < CONFIG.cols && y >= 0 && y < CONFIG.rows;
  }

  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      const crosses = ((a.y > y) !== (b.y > y)) &&
        (x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || EPS) + a.x);
      if (crosses) inside = !inside;
    }
    return inside;
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

  function angleDiff(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  function createSplashIslandPoints(cx, cy, baseRadius, kind, flowDirection) {
    // STARTと同じshape-first方式。円を変形するのではなく、
    // 角・切れ込み・尖りを含む輪郭点列そのものを先に作る。
    const profile = kind === 'core'
      ? {
          vertices: [13, 17],
          radiusJitter: [.78, 1.12],
          jaggedClusters: [2, 4],
          clusterTeeth: [1, 2],
          toothTip: [1.16, 1.35],
          toothRoot: [.72, .90],
          notches: [1, 3],
          notchRadius: [.58, .80],
          longSpikeChance: .45,
          longSpikeTip: [1.35, 1.65],
        }
      : kind === 'droplet'
        ? {
            vertices: [10, 13],
            radiusJitter: [.82, 1.10],
            jaggedClusters: [1, 2],
            clusterTeeth: [1, 2],
            toothTip: [1.12, 1.28],
            toothRoot: [.76, .92],
            notches: [0, 2],
            notchRadius: [.65, .84],
            longSpikeChance: .20,
            longSpikeTip: [1.25, 1.45],
          }
        : {
            vertices: [7, 9],
            radiusJitter: [.88, 1.08],
            jaggedClusters: [0, 1],
            clusterTeeth: [1, 1],
            toothTip: [1.08, 1.18],
            toothRoot: [.82, .95],
            notches: [0, 0],
            notchRadius: [.82, .92],
            longSpikeChance: 0,
            longSpikeTip: [1, 1],
          };

    const baseCount = randInt(...profile.vertices);
    const step = TAU / baseCount;
    const contour = [];

    for (let i = 0; i < baseCount; i++) {
      contour.push({
        angle: (i * step + rand(-.18, .18) * step + TAU) % TAU,
        radius: rand(...profile.radiusJitter),
      });
    }
    contour.sort((a, b) => a.angle - b.angle);

    // 一部を広く膨らませ、丸い正多角形に見えない重量差を作る。
    if (kind !== 'speck') {
      const lobeCount = randInt(1, 2);
      for (let i = 0; i < lobeCount; i++) {
        const index = randInt(0, contour.length - 1);
        const amp = rand(.05, kind === 'core' ? .12 : .09);
        contour[index].radius += amp;
        contour[(index + contour.length - 1) % contour.length].radius += amp * .30;
        contour[(index + 1) % contour.length].radius += amp * .30;
      }
    }

    for (let i = 0; i < randInt(...profile.notches); i++) {
      const index = randInt(0, contour.length - 1);
      contour[index].radius = rand(...profile.notchRadius);
    }

    const extra = [];
    const clusterCount = randInt(...profile.jaggedClusters);
    for (let i = 0; i < clusterCount; i++) {
      const center = rng() < .60
        ? flowDirection + rand(-1.0, 1.0)
        : rand(0, TAU);
      const teeth = randInt(...profile.clusterTeeth);
      for (let tooth = 0; tooth < teeth; tooth++) {
        const angle = (center + rand(-.20, .20) + TAU) % TAU;
        const width = step * rand(.08, .16);
        const root = rand(...profile.toothRoot);
        extra.push(
          { angle: (angle - width + TAU) % TAU, radius: root },
          { angle, radius: rand(...profile.toothTip) },
          { angle: (angle + width) % TAU, radius: root * rand(.96, 1.05) },
        );

        // 尖りの隣に切れ込みを置き、STARTのような急な輪郭変化を作る。
        if (rng() < .55) {
          extra.push({
            angle: (angle + (rng() < .5 ? -1 : 1) * step * rand(.22, .42) + TAU) % TAU,
            radius: rand(.62, .82),
          });
        }
      }
    }

    if (rng() < profile.longSpikeChance) {
      const angle = rng() < .75
        ? (flowDirection + rand(-.50, .50) + TAU) % TAU
        : rand(0, TAU);
      const width = step * rand(.04, .08);
      const root = rand(.70, .86);
      extra.push(
        { angle: (angle - width + TAU) % TAU, radius: root },
        { angle, radius: rand(...profile.longSpikeTip) },
        { angle: (angle + width) % TAU, radius: root * rand(.96, 1.04) },
      );
    }

    const ovalAngle = rand(0, TAU);
    const ovalAmount = kind === 'core' ? rand(-.08, .08) : rand(-.06, .06);
    return [...contour, ...extra]
      .sort((a, b) => a.angle - b.angle)
      .map(point => {
        const oval = 1 + ovalAmount * Math.cos(2 * (point.angle - ovalAngle));
        const radius = baseRadius * point.radius * oval;
        return {
          x: cx + Math.cos(point.angle) * radius,
          y: cy + Math.sin(point.angle) * radius,
        };
      });
  }

  function rasterizeSplashPolygon(points) {
    const cells = new Set();
    if (!points.length) return cells;
    const samples = [[.5,.5], [.2,.2], [.8,.2], [.2,.8], [.8,.8]];
    const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))) - 1);
    const maxX = Math.min(CONFIG.cols - 1, Math.ceil(Math.max(...points.map(p => p.x))) + 1);
    const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))) - 1);
    const maxY = Math.min(CONFIG.rows - 1, Math.ceil(Math.max(...points.map(p => p.y))) + 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (samples.some(([sx, sy]) => pointInPolygon(x + sx, y + sy, points))) {
          cells.add(key(x, y));
        }
      }
    }
    return cells;
  }

  function largestCellComponent(cells) {
    if (!cells.size) return cells;
    const visited = new Set();
    let largest = new Set();

    for (const start of cells) {
      if (visited.has(start)) continue;
      const component = new Set([start]);
      const queue = [start];
      visited.add(start);
      for (let i = 0; i < queue.length; i++) {
        const p = parseKey(queue[i]);
        for (const [dx, dy] of neighbors) {
          const next = key(p.x + dx, p.y + dy);
          if (!cells.has(next) || visited.has(next)) continue;
          visited.add(next);
          component.add(next);
          queue.push(next);
        }
      }
      if (component.size > largest.size) largest = component;
    }
    return largest;
  }

  function addSplashIsland(cx, cy, baseRadius, kind, flowDirection, target) {
    const points = createSplashIslandPoints(cx, cy, baseRadius, kind, flowDirection);
    const cells = largestCellComponent(rasterizeSplashPolygon(points));
    if (!cells.size) return null;
    for (const k of cells) {
      target.add(k);
      splashVisualInk.add(k);
    }
    const shape = { points, cells };
    splashShapes.push(shape);
    return shape;
  }

  function chooseSplashCenter(impact, radius, kind, index, directions, placed) {
    const range = kind === 'core'
      ? (index === 0 ? [3, 14] : [10, CONFIG.splash.coreSpread])
      : kind === 'droplet'
        ? [15, CONFIG.splash.spread]
        : [22, CONFIG.splash.farSpread];
    const bias = CONFIG.splash.radialBias[kind];
    let candidate = { x: impact.x, y: impact.y };

    for (let tries = 0; tries < 48; tries++) {
      const useBias = directions.length > 0 && rng() < bias;
      const angle = useBias
        ? directions[randInt(0, directions.length - 1)] + rand(-CONFIG.splash.radialJitter, CONFIG.splash.radialJitter)
        : rand(0, TAU);
      const distance = rand(...range);
      const x = impact.x + Math.cos(angle) * distance;
      const y = impact.y + Math.sin(angle) * distance;
      candidate = {
        x: clamp(x, radius * .35, CONFIG.cols - 1 - radius * .35),
        y: clamp(y, radius * .35, CONFIG.rows - 1 - radius * .35),
      };

      const spaced = placed.every(other => {
        const factor = kind === 'core' && other.kind === 'core'
          ? 1.0
          : kind !== 'speck' && other.kind !== 'speck'
            ? .68
            : .12;
        return Math.hypot(candidate.x - other.x, candidate.y - other.y)
          >= factor * (radius + other.radius);
      });
      if (spaced) break;
    }
    return candidate;
  }

  function createStarterPuddle() {
    const polygon = starterShapePoints();
    const bounds = starterShapeBounds();
    const target = new Set();
    const samples = [
      [.50,.50], [.18,.18], [.82,.18], [.18,.82], [.82,.82],
      [.50,.18], [.50,.82], [.18,.50], [.82,.50],
    ];

    const minX = Math.max(0, Math.floor(bounds.left) - 1);
    const maxX = Math.min(CONFIG.cols - 1, Math.ceil(bounds.left + bounds.width) + 1);
    const minY = Math.max(0, Math.floor(bounds.top) - 1);

    for (let y = minY; y < CONFIG.rows; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (samples.some(([sx, sy]) => pointInPolygon(x + sx, y + sy, polygon))) {
          target.add(key(x, y));
        }
      }
    }

    // Only the component actually connected to the bottom edge is a gameplay anchor.
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
    const coreCount = randInt(...CONFIG.splash.coreCount);
    const dropletCount = randInt(...CONFIG.splash.dropletCount);
    const speckCount = randInt(...CONFIG.splash.speckCount);
    const impact = splashPoint(cx, cy, ...CONFIG.splash.aimDrift);
    const directions = createSplashDirections();
    const placed = [];

    const addPlacedIsland = (kind, radius, index) => {
      const center = chooseSplashCenter(impact, radius, kind, index, directions, placed);
      const outward = Math.atan2(center.y - impact.y, center.x - impact.x);
      const flowDirection = Number.isFinite(outward)
        ? outward + rand(-.35, .35)
        : directions[randInt(0, directions.length - 1)] || rand(0, TAU);
      const shape = addSplashIsland(center.x, center.y, radius, kind, flowDirection, splashInk);
      if (shape) placed.push({ x: center.x, y: center.y, radius, kind });
    };

    for (let i = 0; i < coreCount; i++) {
      addPlacedIsland('core', rand(...CONFIG.splash.coreRadius), i);
    }
    for (let i = 0; i < dropletCount; i++) {
      addPlacedIsland('droplet', rand(...CONFIG.splash.dropletRadius), i);
    }
    for (let i = 0; i < speckCount; i++) {
      addPlacedIsland('speck', rand(...CONFIG.splash.speckRadius), i);
    }

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

  function renderStarterPuddle(m) {
    const polygon = starterShapePoints();
    if (!polygon.length) return;
    ctx.save();
    ctx.fillStyle = '#1f2927';
    ctx.beginPath();
    polygon.forEach((p, i) => {
      const x = p.x * m.sx;
      const y = p.y * m.sy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function renderSplashShapes(m) {
    for (const shape of splashShapes) {
      let isConnected = false;
      for (const k of shape.cells) {
        if (connected.has(k)) {
          isConnected = true;
          break;
        }
      }

      ctx.save();
      ctx.fillStyle = isConnected ? '#1f2927' : '#525755';
      ctx.beginPath();
      shape.points.forEach((p, i) => {
        const x = p.x * m.sx;
        const y = p.y * m.sy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
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
    renderStarterPuddle(m);
    renderSplashShapes(m);

    for (const k of ink) {
      if (starterInk.has(k) || splashVisualInk.has(k)) continue;
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
      <p class="distribution-note">通常14個。点数は10点刻みで全14個重複なし。通常・単発当たり・全体当たりがあり、当たりは毎回保証されず複数層で起こることもある。全体当たりは下限だけ上がり、単発当たりは1個だけ上限が広がる。サイズは上層=小2/中3/大1、中層=小2/中1/大2、下層=小1/中1/大1。30%で点数判明、70%以上を塗って起点のインク溜まりへ接続すると取得。</p>`;
  }

  function reset(useSameSeed) {
    if (!useSameSeed) seed = randomSeed();
    rng = mulberry32(seed);
    syncBoardWidthToViewport();
    ink = new Set();
    starterInk = new Set();
    splashShapes = [];
    splashVisualInk = new Set();
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