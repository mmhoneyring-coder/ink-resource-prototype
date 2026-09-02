export const DEFAULT_SPLASH = Object.freeze({
  coreCount: [2, 4],
  dropletCount: [8, 12],
  speckCount: [5, 9],
  coreRadius: [8, 12],
  dropletRadius: [2.8, 5.6],
  speckRadius: [2.0, 3.4],
  spread: 60,
  farSpread: 84,
  aimDrift: [8, 20],
  minIslandArea: 24,
});

export const DEFAULT_RESOURCE = Object.freeze({
  count: 30,
  baseRadius: 3,
  radiusJitter: 0.25,
  minGap: 3,
  countMode: 'fixed',
  scaleMode: 'auto',
});

export const DEFAULT_CASE = Object.freeze({
  cols: 180,
  rows: 280,
  splashes: 8,
  strategy: 'wide',
  seed: 12345,
});

export const BOARD_PRESETS = Object.freeze([
  [180, 280],
  [220, 360],
  [240, 420],
  [260, 450],
]);

const BASE_BOARD_AREA = DEFAULT_CASE.cols * DEFAULT_CASE.rows;
const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rand(rng, min, max) {
  return min + rng() * (max - min);
}

function randInt(rng, min, max) {
  return Math.floor(rand(rng, min, max + 1));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function makeGrid(cols, rows) {
  return new Uint8Array(cols * rows);
}

function indexOf(x, y, cols) {
  return y * cols + x;
}

function addDisk(state, cx, cy, radius) {
  const { cols, rows, rng, target, touched } = state;
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
    if (y < 0 || y >= rows) continue;
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
      if (x < 0 || x >= cols) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2 + rand(rng, -1.6, 1.6)) continue;
      const idx = indexOf(x, y, cols);
      if (target[idx]) continue;
      target[idx] = 1;
      touched.push(idx);
    }
  }
}

function addBlob(state, cx, cy, baseRadius, lobes = [2, 5]) {
  const { rng } = state;
  addDisk(state, cx, cy, baseRadius * rand(rng, .72, .98));
  const count = randInt(rng, lobes[0], lobes[1]);
  for (let i = 0; i < count; i++) {
    const angle = rand(rng, 0, TAU);
    const dist = rand(rng, baseRadius * .25, baseRadius * .85);
    addDisk(
      state,
      cx + Math.cos(angle) * dist,
      cy + Math.sin(angle) * dist,
      baseRadius * rand(rng, .32, .68),
    );
  }
}

function splashPoint(rng, cx, cy, minDistance, maxDistance) {
  const angle = rand(rng, 0, TAU);
  const distance = rand(rng, minDistance, maxDistance);
  return {
    x: cx + Math.cos(angle) * distance,
    y: cy + Math.sin(angle) * distance,
  };
}

function pruneSmallIslands({ cols, rows, target, touched, ink, minArea }) {
  const visited = makeGrid(cols, rows);
  const queue = [];
  const component = [];

  for (const start of touched) {
    if (!target[start] || visited[start]) continue;
    queue.length = 0;
    component.length = 0;
    queue.push(start);
    visited[start] = 1;
    let touchesExisting = false;

    for (let q = 0; q < queue.length; q++) {
      const idx = queue[q];
      component.push(idx);
      if (ink[idx]) touchesExisting = true;
      const x = idx % cols;
      const y = Math.floor(idx / cols);

      if (x > 0) inspect(idx - 1);
      if (x + 1 < cols) inspect(idx + 1);
      if (y > 0) inspect(idx - cols);
      if (y + 1 < rows) inspect(idx + cols);
    }

    if (component.length < minArea && !touchesExisting) {
      for (const idx of component) target[idx] = 0;
    }

    function inspect(next) {
      if (ink[next]) touchesExisting = true;
      if (!target[next] || visited[next]) return;
      visited[next] = 1;
      queue.push(next);
    }
  }
}

function splashAt(ink, cols, rows, rng, cx, cy, splash) {
  const target = makeGrid(cols, rows);
  const touched = [];
  const state = { cols, rows, rng, target, touched };
  const core = randInt(rng, splash.coreCount[0], splash.coreCount[1]);
  const droplets = randInt(rng, splash.dropletCount[0], splash.dropletCount[1]);
  const specks = randInt(rng, splash.speckCount[0], splash.speckCount[1]);
  const impact = splashPoint(rng, cx, cy, splash.aimDrift[0], splash.aimDrift[1]);

  for (let i = 0; i < core; i++) {
    const p = splashPoint(
      rng,
      impact.x,
      impact.y,
      i === 0 ? 3 : 8,
      i === 0 ? 14 : splash.spread * .55,
    );
    addBlob(state, p.x, p.y, rand(rng, splash.coreRadius[0], splash.coreRadius[1]), [2, 5]);
  }

  for (let i = 0; i < droplets; i++) {
    const p = splashPoint(rng, impact.x, impact.y, 12, splash.spread);
    addBlob(state, p.x, p.y, rand(rng, splash.dropletRadius[0], splash.dropletRadius[1]), [1, 3]);
  }

  for (let i = 0; i < specks; i++) {
    const p = splashPoint(rng, impact.x, impact.y, 20, splash.farSpread);
    addDisk(state, p.x, p.y, rand(rng, splash.speckRadius[0], splash.speckRadius[1]));
  }

  pruneSmallIslands({
    cols,
    rows,
    target,
    touched,
    ink,
    minArea: splash.minIslandArea,
  });

  let newCells = 0;
  for (const idx of touched) {
    if (!target[idx] || ink[idx]) continue;
    ink[idx] = 1;
    newCells++;
  }
  return newCells;
}

function normalizedTarget(strategy, shot, count, rng) {
  const wide = [
    [.18, .18], [.50, .15], [.82, .20],
    [.28, .45], [.72, .45],
    [.18, .76], [.50, .82], [.82, .76],
  ];

  if (strategy === 'wide') {
    const base = wide[shot % wide.length];
    return [
      clamp(base[0] + rand(rng, -.035, .035), .04, .96),
      clamp(base[1] + rand(rng, -.035, .035), .04, .96),
    ];
  }

  if (strategy === 'upward') {
    const t = count <= 1 ? 0 : shot / (count - 1);
    const y = .82 - t * .67;
    const x = shot % 2 === 0 ? .32 : .68;
    return [
      clamp(x + rand(rng, -.08, .08), .05, .95),
      clamp(y + rand(rng, -.035, .035), .05, .95),
    ];
  }

  const bands = {
    lower: [.68, .94],
    middle: [.37, .63],
    upper: [.07, .33],
  };
  if (bands[strategy]) {
    const [lo, hi] = bands[strategy];
    return [rand(rng, .08, .92), rand(rng, lo, hi)];
  }

  return [rand(rng, .06, .94), rand(rng, .06, .94)];
}

function countCoverage(ink, cols, rows) {
  const bandCounts = [0, 0, 0];
  const bandTotals = [0, 0, 0];
  let total = 0;

  for (let y = 0; y < rows; y++) {
    const band = Math.min(2, Math.floor((y * 3) / rows));
    for (let x = 0; x < cols; x++) {
      const idx = indexOf(x, y, cols);
      bandTotals[band]++;
      if (!ink[idx]) continue;
      total++;
      bandCounts[band]++;
    }
  }

  return {
    inkCells: total,
    coverage: total / (cols * rows),
    upper: bandCounts[0] / bandTotals[0],
    middle: bandCounts[1] / bandTotals[1],
    lower: bandCounts[2] / bandTotals[2],
  };
}

export function autoResourceScale(cols, rows) {
  const areaRatio = Math.max(0.1, (cols * rows) / BASE_BOARD_AREA);
  return clamp(areaRatio ** 0.32, 0.8, 1.6);
}

export function resourceCountForBoard(baseCount, cols, rows, mode = 'fixed') {
  if (mode !== 'density') return Math.max(1, Math.round(baseCount));
  return Math.max(1, Math.round(baseCount * (cols * rows) / BASE_BOARD_AREA));
}

function resourceScaleForBoard(cols, rows, mode = 'auto') {
  return mode === 'fixed' ? 1 : autoResourceScale(cols, rows);
}

function createResources(cols, rows, seed, options) {
  const rng = mulberry32((seed ^ 0xA5A5A5A5) >>> 0);
  const count = resourceCountForBoard(options.count, cols, rows, options.countMode);
  const scale = resourceScaleForBoard(cols, rows, options.scaleMode);
  const jitter = clamp(Number(options.radiusJitter ?? DEFAULT_RESOURCE.radiusJitter), 0, .8);
  const baseRadius = Math.max(.5, Number(options.baseRadius ?? DEFAULT_RESOURCE.baseRadius));
  const minGap = Math.max(0, Number(options.minGap ?? DEFAULT_RESOURCE.minGap));
  const resources = [];

  for (let i = 0; i < count; i++) {
    const radius = baseRadius * scale * rand(rng, 1 - jitter, 1 + jitter);
    const margin = Math.ceil(radius + 2);
    let x = rand(rng, margin, Math.max(margin, cols - margin));
    let y = rand(rng, margin, Math.max(margin, rows - margin));

    for (let tries = 0; tries < 160; tries++) {
      const overlaps = resources.some(r => Math.hypot(x - r.x, y - r.y) < radius + r.radius + minGap);
      if (!overlaps) break;
      x = rand(rng, margin, Math.max(margin, cols - margin));
      y = rand(rng, margin, Math.max(margin, rows - margin));
    }

    resources.push({
      x,
      y,
      radius,
      band: Math.min(2, Math.floor((y * 3) / rows)),
      hit: false,
    });
  }

  return { resources, count, scale };
}

function resourceTouchesInk(resource, ink, cols, rows) {
  const r2 = resource.radius * resource.radius;
  const minX = Math.max(0, Math.floor(resource.x - resource.radius));
  const maxX = Math.min(cols - 1, Math.ceil(resource.x + resource.radius));
  const minY = Math.max(0, Math.floor(resource.y - resource.radius));
  const maxY = Math.min(rows - 1, Math.ceil(resource.y + resource.radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - resource.x;
      const dy = y - resource.y;
      if (dx * dx + dy * dy > r2) continue;
      if (ink[indexOf(x, y, cols)]) return true;
    }
  }
  return false;
}

function evaluateResources(ink, cols, rows, seed, resourceOptions) {
  const generated = createResources(cols, rows, seed, resourceOptions);
  const totals = [0, 0, 0];
  const hits = [0, 0, 0];
  let hitCount = 0;

  for (const resource of generated.resources) {
    totals[resource.band]++;
    resource.hit = resourceTouchesInk(resource, ink, cols, rows);
    if (!resource.hit) continue;
    hitCount++;
    hits[resource.band]++;
  }

  const safeRate = (hit, total) => total ? hit / total : null;
  return {
    resources: generated.resources,
    resourceCount: generated.count,
    resourceScale: generated.scale,
    meanResourceRadius: generated.resources.reduce((sum, r) => sum + r.radius, 0) / Math.max(1, generated.resources.length),
    hitCount,
    hitRate: hitCount / Math.max(1, generated.count),
    resourceUpper: safeRate(hits[0], totals[0]),
    resourceMiddle: safeRate(hits[1], totals[1]),
    resourceLower: safeRate(hits[2], totals[2]),
    bandResourceTotals: totals,
    bandResourceHits: hits,
  };
}

export function simulateExploration(options = {}) {
  const cols = Number(options.cols ?? DEFAULT_CASE.cols);
  const rows = Number(options.rows ?? DEFAULT_CASE.rows);
  const splashes = Number(options.splashes ?? DEFAULT_CASE.splashes);
  const strategy = options.strategy ?? DEFAULT_CASE.strategy;
  const seed = Number(options.seed ?? DEFAULT_CASE.seed) >>> 0;
  const splash = { ...DEFAULT_SPLASH, ...(options.splash ?? {}) };
  const resourceOptions = { ...DEFAULT_RESOURCE, ...(options.resources ?? {}) };
  const rng = mulberry32(seed);
  const ink = makeGrid(cols, rows);
  let addedCells = 0;

  for (let shot = 0; shot < splashes; shot++) {
    const [nx, ny] = normalizedTarget(strategy, shot, splashes, rng);
    addedCells += splashAt(ink, cols, rows, rng, nx * cols, ny * rows, splash);
  }

  const coverage = countCoverage(ink, cols, rows);
  const resourceResult = evaluateResources(ink, cols, rows, seed, resourceOptions);
  return {
    cols,
    rows,
    splashes,
    strategy,
    seed,
    addedCells,
    ...coverage,
    ...resourceResult,
    ink: options.returnInk ? ink : undefined,
    resources: options.returnResources ? resourceResult.resources : undefined,
  };
}

function mean(values) {
  const valid = values.filter(v => Number.isFinite(v));
  return valid.reduce((sum, v) => sum + v, 0) / Math.max(1, valid.length);
}

function percentile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

export function runExplorationBatch(options = {}) {
  const trials = Math.max(1, Number(options.trials ?? 200));
  const baseSeed = Number(options.seed ?? DEFAULT_CASE.seed) >>> 0;
  const rows = [];

  for (let i = 0; i < trials; i++) {
    rows.push(simulateExploration({
      ...options,
      seed: (baseSeed + Math.imul(i + 1, 0x9E3779B1)) >>> 0,
      returnInk: false,
      returnResources: false,
    }));
  }

  const coverages = rows.map(r => r.coverage).sort((a, b) => a - b);
  const hitRates = rows.map(r => r.hitRate).sort((a, b) => a - b);
  return {
    cols: rows[0].cols,
    rows: rows[0].rows,
    splashes: rows[0].splashes,
    strategy: rows[0].strategy,
    trials,
    seed: baseSeed,
    resourceCount: rows[0].resourceCount,
    resourceScale: rows[0].resourceScale,
    meanResourceRadius: mean(rows.map(r => r.meanResourceRadius)),
    meanInkCells: mean(rows.map(r => r.inkCells)),
    meanCoverage: mean(rows.map(r => r.coverage)),
    meanUpper: mean(rows.map(r => r.upper)),
    meanMiddle: mean(rows.map(r => r.middle)),
    meanLower: mean(rows.map(r => r.lower)),
    p10Coverage: percentile(coverages, .10),
    p50Coverage: percentile(coverages, .50),
    p90Coverage: percentile(coverages, .90),
    meanHitCount: mean(rows.map(r => r.hitCount)),
    meanHitRate: mean(rows.map(r => r.hitRate)),
    p10HitRate: percentile(hitRates, .10),
    p50HitRate: percentile(hitRates, .50),
    p90HitRate: percentile(hitRates, .90),
    meanResourceUpper: mean(rows.map(r => r.resourceUpper)),
    meanResourceMiddle: mean(rows.map(r => r.resourceMiddle)),
    meanResourceLower: mean(rows.map(r => r.resourceLower)),
  };
}

export function compareBoards(options = {}, presets = BOARD_PRESETS) {
  return presets.map(([cols, rows]) => runExplorationBatch({ ...options, cols, rows }));
}
