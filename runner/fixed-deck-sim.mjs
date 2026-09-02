import { mulberry32, simulateExploration } from './sim-core.mjs';

export const FIXED_DECK = Object.freeze({
  upper: Object.freeze([14, 14, 16, 16, 20, 20, 20, 24, 24, 24, 28, 28, 30, 30]),
  middle: Object.freeze([6, 6, 8, 8, 10, 10, 12, 12, 12, 14, 14, 16, 16]),
  lower: Object.freeze([2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 8]),
});

export const FIXED_SIZE_MODEL = Object.freeze({
  treasureValue: 50,
  treasureRadius: 1.8,
  visibleRatio: 0.10,
  knownRatio: 0.10,
  sizeBands: Object.freeze([
    Object.freeze({ max: 3, radius: 5.0 }),
    Object.freeze({ max: 6, radius: 4.3 }),
    Object.freeze({ max: 10, radius: 3.7 }),
    Object.freeze({ max: 16, radius: 3.1 }),
    Object.freeze({ max: Infinity, radius: 2.6 }),
  ]),
});

export const FIXED_RUN = Object.freeze({
  cols: 240,
  rows: 420,
  splashes: 8,
  strategy: 'wide',
  seed: 12345,
  brushBudget: 480,
  brushRadius: 2,
  startY: 0.78,
});

const BAND_NAMES = ['upper', 'middle', 'lower'];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
}

function percentile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function rand(rng, min, max) {
  return min + rng() * (max - min);
}

function randInt(rng, min, max) {
  return Math.floor(rand(rng, min, max + 1));
}

function shuffled(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function radiusForValue(value, treasure = false) {
  if (treasure) return FIXED_SIZE_MODEL.treasureRadius;
  return FIXED_SIZE_MODEL.sizeBands.find(b => value <= b.max)?.radius ?? 2.6;
}

function pointToSegment(px, py, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-9) return { x: a.x, y: a.y, distance: Math.hypot(px - a.x, py - a.y) };
  const t = clamp(((px - a.x) * vx + (py - a.y) * vy) / len2, 0, 1);
  const x = a.x + vx * t;
  const y = a.y + vy * t;
  return { x, y, distance: Math.hypot(px - x, py - y) };
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
      if (ink[y * cols + x]) return true;
    }
  }
  return false;
}

function placeResource(resources, rng, cols, rows, band, value, id, treasure = false) {
  const radius = radiusForValue(value, treasure);
  const margin = radius + 3;
  const bandLo = band / 3 * rows;
  const bandHi = (band + 1) / 3 * rows;
  let x = cols / 2;
  let y = (bandLo + bandHi) / 2;

  for (let tries = 0; tries < 240; tries++) {
    const tx = rand(rng, margin, Math.max(margin, cols - margin));
    const ty = rand(rng, bandLo + margin, Math.max(bandLo + margin, bandHi - margin));
    x = tx;
    y = ty;
    const overlaps = resources.some(r => Math.hypot(x - r.x, y - r.y) < radius + r.radius + 3);
    if (!overlaps) break;
  }

  return {
    id,
    x,
    y,
    yNorm: y / rows,
    band,
    value,
    radius,
    visibility: 'hidden',
    isGoal: false,
    isTreasure: treasure,
    splashHit: false,
    positionKnown: false,
    valueKnown: false,
    activated: false,
    discoveredBySplash: false,
    discoveredByBrush: false,
  };
}

function createDeckResources(cols, rows, seed, ink) {
  const rng = mulberry32((seed ^ 0x71F17ED5) >>> 0);
  const resources = [];
  let id = 0;

  for (let band = 0; band < 3; band++) {
    const values = shuffled(FIXED_DECK[BAND_NAMES[band]], rng);
    for (const value of values) {
      const resource = placeResource(resources, rng, cols, rows, band, value, id++);
      resources.push(resource);
    }
  }

  // Visible 12pt soft goal: choose the middle 12pt nearest the layer center.
  const goal = resources
    .filter(r => r.band === 1 && r.value === 12)
    .sort((a, b) => Math.abs(a.yNorm - .5) - Math.abs(b.yNorm - .5))[0] ?? null;
  if (goal) {
    goal.isGoal = true;
    goal.visibility = 'visible';
  }

  const normal = resources;
  const visibleTarget = Math.round(normal.length * FIXED_SIZE_MODEL.visibleRatio);
  const knownTarget = Math.round(normal.length * FIXED_SIZE_MODEL.knownRatio);
  const pool = shuffled(normal.filter(r => !r.isGoal), rng);
  let cursor = 0;
  let visibleAssigned = goal ? 1 : 0;
  while (visibleAssigned < visibleTarget && cursor < pool.length) {
    pool[cursor++].visibility = 'visible';
    visibleAssigned++;
  }
  let knownAssigned = 0;
  while (knownAssigned < knownTarget && cursor < pool.length) {
    pool[cursor++].visibility = 'known';
    knownAssigned++;
  }

  // Extra 41st treasure, 50/50 middle or lower.
  const treasureBand = rng() < .5 ? 1 : 2;
  const treasure = placeResource(resources, rng, cols, rows, treasureBand, 50, id++, true);
  resources.push(treasure);

  for (const resource of resources) {
    resource.splashHit = resourceTouchesInk(resource, ink, cols, rows);
    resource.positionKnown = resource.visibility !== 'hidden' || resource.splashHit;
    resource.valueKnown = resource.visibility === 'visible' || resource.splashHit;
    resource.discoveredBySplash = resource.visibility === 'hidden' && resource.splashHit;
  }

  return { resources, goalId: goal?.id ?? null, treasureId: treasure.id, treasureBand };
}

function closestNetworkPoint(resource, home, segments) {
  let best = { x: home.x, y: home.y, distance: Math.hypot(resource.x - home.x, resource.y - home.y) };
  for (const segment of segments) {
    const p = pointToSegment(resource.x, resource.y, segment.a, segment.b);
    if (p.distance < best.distance) best = p;
  }
  return best;
}

function bandExpectation(band) {
  return mean(FIXED_DECK[BAND_NAMES[band]]);
}

function chooseResource(resources, home, segments, strategy) {
  let best = null;
  for (const resource of resources) {
    if (!resource.positionKnown || resource.activated) continue;
    const start = closestNetworkPoint(resource, home, segments);
    const distance = Math.max(.5, start.distance);
    const estimated = resource.valueKnown ? resource.value : bandExpectation(resource.band);
    let utility;
    if (strategy === 'nearest') utility = -distance;
    else if (strategy === 'highValue') utility = estimated - distance * .025;
    else if (strategy === 'upper') utility = estimated / Math.sqrt(distance + 8) + (2 - resource.band) * 1.5;
    else if (strategy === 'goalFirst' && resource.isGoal) utility = 1e6;
    else utility = estimated / (distance + 12);
    if (!best || utility > best.utility) best = { resource, start, distance: start.distance, utility };
  }
  return best;
}

function touchAlongSegment(resources, segment, brushRadius) {
  let hiddenDiscoveries = 0;
  for (const resource of resources) {
    if (resource.activated) continue;
    if (pointToSegment(resource.x, resource.y, segment.a, segment.b).distance > resource.radius + brushRadius) continue;
    const wasKnown = resource.positionKnown;
    resource.positionKnown = true;
    resource.valueKnown = true;
    resource.activated = true;
    resource.discoveredByBrush = !wasKnown;
    if (!wasKnown) hiddenDiscoveries++;
  }
  return hiddenDiscoveries;
}

export function simulateFixedDeckRun(options = {}) {
  const cols = Number(options.cols ?? FIXED_RUN.cols);
  const rows = Number(options.rows ?? FIXED_RUN.rows);
  const splashes = Number(options.splashes ?? FIXED_RUN.splashes);
  const splashStrategy = options.strategy ?? FIXED_RUN.strategy;
  const seed = Number(options.seed ?? FIXED_RUN.seed) >>> 0;
  const brushBudget = Number(options.brushBudget ?? FIXED_RUN.brushBudget);
  const brushRadius = Number(options.brushRadius ?? FIXED_RUN.brushRadius);
  const startY = Number(options.startY ?? FIXED_RUN.startY);
  const brushStrategy = options.brushStrategy ?? 'valueRate';

  const exploration = simulateExploration({
    cols,
    rows,
    splashes,
    strategy: splashStrategy,
    seed,
    resources: { count: 1 },
    returnInk: true,
    returnResources: false,
  });
  const generated = createDeckResources(cols, rows, seed, exploration.ink);
  const resources = generated.resources;
  const home = { x: cols / 2, y: rows * startY };
  const segments = [];
  let brushUsed = 0;
  let brushDiscoveries = 0;

  while (brushUsed + 1e-6 < brushBudget) {
    const choice = chooseResource(resources, home, segments, brushStrategy);
    if (!choice) break;
    if (choice.distance <= choice.resource.radius + brushRadius) {
      choice.resource.positionKnown = true;
      choice.resource.valueKnown = true;
      choice.resource.activated = true;
      continue;
    }

    const remaining = brushBudget - brushUsed;
    const fullDistance = choice.distance;
    const travel = Math.min(fullDistance, remaining);
    const ux = (choice.resource.x - choice.start.x) / fullDistance;
    const uy = (choice.resource.y - choice.start.y) / fullDistance;
    const segment = {
      a: { x: choice.start.x, y: choice.start.y },
      b: { x: choice.start.x + ux * travel, y: choice.start.y + uy * travel },
      length: travel,
    };
    segments.push(segment);
    brushUsed += travel;
    brushDiscoveries += touchAlongSegment(resources, segment, brushRadius);
    if (travel + 1e-6 < fullDistance) break;
    if (!choice.resource.activated) {
      choice.resource.positionKnown = true;
      choice.resource.valueKnown = true;
      choice.resource.activated = true;
    }
  }

  const activated = resources.filter(r => r.activated);
  const normalActivated = activated.filter(r => !r.isTreasure);
  const activatedByBand = BAND_NAMES.map((_, band) => normalActivated.filter(r => r.band === band).length);
  const scoreByBand = BAND_NAMES.map((_, band) => normalActivated.filter(r => r.band === band).reduce((s, r) => s + r.value, 0));
  const treasure = resources.find(r => r.isTreasure);

  return {
    cols,
    rows,
    seed,
    brushStrategy,
    coverage: exploration.coverage,
    splashHiddenDiscoveries: resources.filter(r => r.discoveredBySplash).length,
    brushDiscoveries,
    activatedCount: activated.length,
    normalActivatedCount: normalActivated.length,
    score: activated.reduce((s, r) => s + r.value, 0),
    normalScore: normalActivated.reduce((s, r) => s + r.value, 0),
    activatedByBand,
    scoreByBand,
    treasureActivated: Boolean(treasure?.activated),
    treasureBand: generated.treasureBand,
    goalActivated: resources.some(r => r.isGoal && r.activated),
    brushUsed,
    brushSegments: segments.length,
  };
}

export function runFixedDeckBatch(options = {}) {
  const trials = Math.max(1, Number(options.trials ?? 600));
  const baseSeed = Number(options.seed ?? FIXED_RUN.seed) >>> 0;
  const runs = [];
  for (let i = 0; i < trials; i++) {
    runs.push(simulateFixedDeckRun({
      ...options,
      seed: (baseSeed + Math.imul(i + 1, 0x9E3779B1)) >>> 0,
    }));
  }
  const activated = runs.map(r => r.activatedCount);
  const scores = runs.map(r => r.score);
  return {
    brushStrategy: runs[0].brushStrategy,
    trials,
    meanActivated: mean(activated),
    p10Activated: percentile(activated, .10),
    p50Activated: percentile(activated, .50),
    p90Activated: percentile(activated, .90),
    meanScore: mean(scores),
    p10Score: percentile(scores, .10),
    p50Score: percentile(scores, .50),
    p90Score: percentile(scores, .90),
    treasureRate: mean(runs.map(r => r.treasureActivated ? 1 : 0)),
    goalRate: mean(runs.map(r => r.goalActivated ? 1 : 0)),
    meanBrushUsed: mean(runs.map(r => r.brushUsed)),
    meanSplashHiddenDiscoveries: mean(runs.map(r => r.splashHiddenDiscoveries)),
    meanBrushDiscoveries: mean(runs.map(r => r.brushDiscoveries)),
    meanActivatedUpper: mean(runs.map(r => r.activatedByBand[0])),
    meanActivatedMiddle: mean(runs.map(r => r.activatedByBand[1])),
    meanActivatedLower: mean(runs.map(r => r.activatedByBand[2])),
    meanScoreUpper: mean(runs.map(r => r.scoreByBand[0])),
    meanScoreMiddle: mean(runs.map(r => r.scoreByBand[1])),
    meanScoreLower: mean(runs.map(r => r.scoreByBand[2])),
  };
}

export function compareFixedDeckStrategies(options = {}) {
  return ['nearest', 'valueRate', 'highValue', 'upper', 'goalFirst']
    .map(brushStrategy => runFixedDeckBatch({ ...options, brushStrategy }));
}
