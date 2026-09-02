import { BOARD_PRESETS, mulberry32, simulateExploration } from './sim-core.mjs';

export const DEFAULT_BRUSH = Object.freeze({
  budget: 480,
  radius: 2,
  startY: 0.78,
  strategy: 'valueRate',
});

export const DEFAULT_SCORE_MODEL = Object.freeze({
  visibleRatio: 0.20,
  knownRatio: 0.20,
  visibleGoalValue: 12,
  treasureValue: 50,
  treasureRadius: 1.8,
  sizeBands: Object.freeze([
    Object.freeze({ max: 3, radius: 5.0 }),
    Object.freeze({ max: 6, radius: 4.3 }),
    Object.freeze({ max: 10, radius: 3.7 }),
    Object.freeze({ max: 16, radius: 3.1 }),
    Object.freeze({ max: Infinity, radius: 2.6 }),
  ]),
  bandValues: Object.freeze({
    upper: Object.freeze([6, 8, 10, 12, 14, 16, 20]),
    middle: Object.freeze([3, 4, 5, 6, 7, 8, 10, 12]),
    lower: Object.freeze([1, 2, 3, 4, 5, 6, 8]),
  }),
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
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffled(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function closestPointOnSegment(px, py, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-9) return { x: a.x, y: a.y, distance: Math.hypot(px - a.x, py - a.y) };
  const t = clamp(((px - a.x) * vx + (py - a.x * 0 + py - py + py - a.y) * 0 + (py - a.y) * vy) / len2, 0, 1);
  const x = a.x + vx * t;
  const y = a.y + vy * t;
  return { x, y, distance: Math.hypot(px - x, py - y) };
}

function closestNetworkPoint(resource, home, segments) {
  let best = {
    x: home.x,
    y: home.y,
    distance: Math.hypot(resource.x - home.x, resource.y - home.y),
  };
  for (const segment of segments) {
    const point = closestPointOnSegment(resource.x, resource.y, segment.a, segment.b);
    if (point.distance < best.distance) best = point;
  }
  return best;
}

function distancePointToSegment(px, py, a, b) {
  return closestPointOnSegment(px, py, a, b).distance;
}

function scoreModelFrom(options = {}) {
  const supplied = options.scoreModel ?? {};
  return {
    ...DEFAULT_SCORE_MODEL,
    ...supplied,
    sizeBands: supplied.sizeBands ?? DEFAULT_SCORE_MODEL.sizeBands,
    bandValues: {
      ...DEFAULT_SCORE_MODEL.bandValues,
      ...(supplied.bandValues ?? {}),
    },
  };
}

function bandExpectedValues(scoreModel) {
  return BAND_NAMES.map(name => mean(scoreModel.bandValues[name]));
}

function radiusForValue(value, scoreModel, isTreasure = false) {
  if (isTreasure) return scoreModel.treasureRadius;
  const band = scoreModel.sizeBands.find(item => value <= item.max) ?? scoreModel.sizeBands.at(-1);
  return band?.radius ?? 3;
}

function resourceTouchesInk(resource, ink, cols, rows) {
  if (!ink) return false;
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

function pickGoal(resources) {
  const candidates = resources.filter(r => r.band === 1);
  const pool = candidates.length ? candidates : resources;
  if (!pool.length) return null;
  return pool.reduce((best, r) => {
    const d = Math.abs(r.yNorm - 0.50);
    return !best || d < best.d ? { resource: r, d } : best;
  }, null).resource;
}

function createTreasure(resources, rng, scoreModel, treasureBand, cols, rows) {
  const radius = radiusForValue(scoreModel.treasureValue, scoreModel, true);
  const margin = radius + 3;
  const bandLo = treasureBand / 3 * rows;
  const bandHi = (treasureBand + 1) / 3 * rows;
  let x = cols / 2;
  let y = (bandLo + bandHi) / 2;

  for (let tries = 0; tries < 240; tries++) {
    const candidateX = rand(rng, margin, Math.max(margin, cols - margin));
    const candidateY = rand(rng, bandLo + margin, Math.max(bandLo + margin, bandHi - margin));
    const overlaps = resources.some(r => Math.hypot(candidateX - r.x, candidateY - r.y) < radius + r.radius + 3);
    x = candidateX;
    y = candidateY;
    if (!overlaps) break;
  }

  return {
    x,
    y,
    radius,
    band: treasureBand,
    id: resources.length,
    yNorm: y / rows,
    value: scoreModel.treasureValue,
    visibility: 'hidden',
    isGoal: false,
    isTreasure: true,
    hit: false,
  };
}

function applyScoreAndVisibility(baseResources, seed, scoreModel, rows, cols, ink) {
  const rng = mulberry32((seed ^ 0xC0FFEE21) >>> 0);
  const normalResources = baseResources.map((resource, id) => ({
    ...resource,
    id,
    yNorm: resource.y / rows,
    value: 0,
    visibility: 'hidden',
    isGoal: false,
    isTreasure: false,
  }));

  for (const resource of normalResources) {
    const values = scoreModel.bandValues[BAND_NAMES[resource.band]];
    resource.value = values[randInt(rng, 0, values.length - 1)];
    resource.radius = radiusForValue(resource.value, scoreModel, false);
  }

  // One fully visible, moderate-value normal resource acts as a soft goal around the middle band.
  const goal = pickGoal(normalResources);
  if (goal) {
    goal.value = scoreModel.visibleGoalValue;
    goal.radius = radiusForValue(goal.value, scoreModel, false);
    goal.isGoal = true;
  }

  // The treasure is an extra 41st resource, not a replacement for one of the 40 normal resources.
  const treasureBand = rng() < 0.5 ? 1 : 2;
  const treasure = createTreasure(normalResources, rng, scoreModel, treasureBand, cols, rows);
  const resources = [...normalResources, treasure];

  // Visibility ratios apply to the 40 normal resources. Treasure is always fully hidden.
  const normalCount = normalResources.length;
  const visibleTarget = Math.min(normalCount, Math.max(1, Math.round(normalCount * scoreModel.visibleRatio)));
  const knownTarget = Math.min(normalCount - visibleTarget, Math.max(0, Math.round(normalCount * scoreModel.knownRatio)));
  const available = shuffled(normalResources.filter(r => !r.isGoal), rng);
  let cursor = 0;

  if (goal) goal.visibility = 'visible';
  treasure.visibility = 'hidden';

  let visibleAssigned = goal ? 1 : 0;
  while (visibleAssigned < visibleTarget && cursor < available.length) {
    available[cursor++].visibility = 'visible';
    visibleAssigned++;
  }

  let knownAssigned = 0;
  while (knownAssigned < knownTarget && cursor < available.length) {
    available[cursor++].visibility = 'known';
    knownAssigned++;
  }

  // Re-evaluate splash hits after score-dependent radii are assigned.
  for (const resource of resources) {
    resource.hit = resourceTouchesInk(resource, ink, cols, rows);
  }

  return {
    resources,
    treasureBand,
    goalId: goal?.id ?? null,
    treasureId: treasure.id,
  };
}

function initRuntimeState(resources) {
  return resources.map(resource => {
    const splashHit = Boolean(resource.hit);
    const initiallyPositionKnown = resource.visibility !== 'hidden';
    const positionKnown = initiallyPositionKnown || splashHit;
    const valueKnown = resource.visibility === 'visible' || splashHit;
    return {
      ...resource,
      splashHit,
      initiallyPositionKnown,
      positionKnown,
      valueKnown,
      activated: false,
      discoveredByBrush: false,
      discoveredBySplash: resource.visibility === 'hidden' && splashHit,
    };
  });
}

function touchResourcesAlongSegment(resources, segment, brushRadius) {
  let hiddenDiscoveries = 0;
  let newActivations = 0;

  for (const resource of resources) {
    if (resource.activated) continue;
    const threshold = resource.radius + brushRadius;
    if (distancePointToSegment(resource.x, resource.y, segment.a, segment.b) > threshold) continue;

    const wasPositionKnown = resource.positionKnown;
    resource.positionKnown = true;
    resource.valueKnown = true;
    resource.activated = true;
    resource.discoveredByBrush = !wasPositionKnown;
    if (!wasPositionKnown) hiddenDiscoveries++;
    newActivations++;
  }

  return { hiddenDiscoveries, newActivations };
}

function estimatedValue(resource, expectedByBand) {
  return resource.valueKnown ? resource.value : expectedByBand[resource.band];
}

function chooseResource(resources, home, segments, strategy, expectedByBand) {
  let best = null;

  for (const resource of resources) {
    if (!resource.positionKnown || resource.activated) continue;
    const start = closestNetworkPoint(resource, home, segments);
    const distance = Math.max(0.5, start.distance);
    const value = estimatedValue(resource, expectedByBand);
    let utility;

    if (strategy === 'nearest') {
      utility = -distance;
    } else if (strategy === 'highValue') {
      utility = value - distance * 0.025;
    } else if (strategy === 'upper') {
      utility = value / Math.sqrt(distance + 8) + (2 - resource.band) * 1.5;
    } else if (strategy === 'goalFirst' && resource.isGoal) {
      utility = 1e6;
    } else {
      utility = value / (distance + 12);
    }

    if (!best || utility > best.utility) {
      best = { resource, start, distance: start.distance, utility, estimatedValue: value };
    }
  }
  return best;
}

function summarizeDistribution(resources) {
  const bands = [new Map(), new Map(), new Map()];
  for (const resource of resources) {
    if (resource.isTreasure) continue;
    const map = bands[resource.band];
    map.set(resource.value, (map.get(resource.value) ?? 0) + 1);
  }
  return bands.map(map => [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => `${value}pt×${count}`)
    .join(' / '));
}

export function simulateBrushRun(options = {}) {
  const brush = { ...DEFAULT_BRUSH, ...(options.brush ?? {}) };
  const scoreModel = scoreModelFrom(options);
  const budget = Math.max(0, Number(brush.budget ?? DEFAULT_BRUSH.budget));
  const brushRadius = Math.max(.25, Number(brush.radius ?? DEFAULT_BRUSH.radius));
  const startY = clamp(Number(brush.startY ?? DEFAULT_BRUSH.startY), .5, .98);
  const brushStrategy = brush.strategy ?? DEFAULT_BRUSH.strategy;

  const exploration = simulateExploration({
    ...options,
    returnInk: true,
    returnResources: true,
  });

  const scored = applyScoreAndVisibility(
    exploration.resources,
    exploration.seed,
    scoreModel,
    exploration.rows,
    exploration.cols,
    exploration.ink,
  );
  const resources = initRuntimeState(scored.resources);
  const expectedByBand = bandExpectedValues(scoreModel);

  const home = {
    x: exploration.cols / 2,
    y: exploration.rows * startY,
  };
  const segments = [];
  let used = 0;
  let brushDiscoveries = 0;

  while (used + 1e-6 < budget) {
    const choice = chooseResource(resources, home, segments, brushStrategy, expectedByBand);
    if (!choice) break;

    if (choice.distance <= choice.resource.radius + brushRadius) {
      choice.resource.positionKnown = true;
      choice.resource.valueKnown = true;
      choice.resource.activated = true;
      continue;
    }

    const remaining = budget - used;
    const fullDistance = choice.distance;
    const travel = Math.min(fullDistance, remaining);
    const ux = (choice.resource.x - choice.start.x) / fullDistance;
    const uy = (choice.resource.y - choice.start.y) / fullDistance;
    const end = {
      x: choice.start.x + ux * travel,
      y: choice.start.y + uy * travel,
    };
    const segment = {
      a: { x: choice.start.x, y: choice.start.y },
      b: end,
      length: travel,
    };
    segments.push(segment);
    used += travel;

    const touched = touchResourcesAlongSegment(resources, segment, brushRadius);
    brushDiscoveries += touched.hiddenDiscoveries;

    if (travel + 1e-6 < fullDistance) break;

    if (!choice.resource.activated) {
      choice.resource.positionKnown = true;
      choice.resource.valueKnown = true;
      choice.resource.activated = true;
    }
  }

  const splashFound = resources.filter(r => r.splashHit).length;
  const splashHiddenDiscoveries = resources.filter(r => r.discoveredBySplash).length;
  const finalFound = resources.filter(r => r.positionKnown).length;
  const activatedResources = resources.filter(r => r.activated);
  const activatedCount = activatedResources.length;
  const score = activatedResources.reduce((sum, r) => sum + r.value, 0);
  const visibleCount = resources.filter(r => r.visibility === 'visible').length;
  const knownCount = resources.filter(r => r.visibility === 'known').length;
  const hiddenCount = resources.filter(r => r.visibility === 'hidden').length;
  const goalActivated = resources.some(r => r.isGoal && r.activated);
  const treasureResource = resources.find(r => r.isTreasure);
  const treasureActivated = Boolean(treasureResource?.activated);

  return {
    ...exploration,
    resources,
    totalResourceCount: resources.length,
    brushSegments: segments,
    brushBudget: budget,
    brushUsed: used,
    brushRadius,
    brushStrategy,
    startY,
    home,
    splashFound,
    splashHiddenDiscoveries,
    brushDiscoveries,
    finalFound,
    activatedCount,
    score,
    visibleCount,
    knownCount,
    hiddenCount,
    goalActivated,
    treasureActivated,
    treasureSplashHit: Boolean(treasureResource?.splashHit),
    treasureBrushHit: Boolean(treasureResource?.discoveredByBrush),
    goalId: scored.goalId,
    treasureId: scored.treasureId,
    treasureBand: scored.treasureBand,
    distribution: summarizeDistribution(resources),
    brushSegmentCount: segments.length,
    ink: options.returnInk ? exploration.ink : undefined,
  };
}

export function runBrushBatch(options = {}) {
  const trials = Math.max(1, Number(options.trials ?? 200));
  const seed = Number(options.seed ?? 12345) >>> 0;
  const runs = [];

  for (let i = 0; i < trials; i++) {
    runs.push(simulateBrushRun({
      ...options,
      seed: (seed + Math.imul(i + 1, 0x9E3779B1)) >>> 0,
      returnInk: false,
    }));
  }

  const first = runs[0];
  const activated = runs.map(r => r.activatedCount);
  const scores = runs.map(r => r.score);
  return {
    cols: first.cols,
    rows: first.rows,
    trials,
    resourceCount: first.resourceCount,
    totalResourceCount: first.totalResourceCount,
    resourceScale: first.resourceScale,
    meanResourceRadius: mean(runs.map(r => r.meanResourceRadius)),
    meanCoverage: mean(runs.map(r => r.coverage)),
    meanSplashFound: mean(runs.map(r => r.splashFound)),
    meanSplashHiddenDiscoveries: mean(runs.map(r => r.splashHiddenDiscoveries)),
    meanBrushDiscoveries: mean(runs.map(r => r.brushDiscoveries)),
    meanFinalFound: mean(runs.map(r => r.finalFound)),
    meanActivated: mean(activated),
    p10Activated: percentile(activated, .10),
    p50Activated: percentile(activated, .50),
    p90Activated: percentile(activated, .90),
    meanScore: mean(scores),
    p10Score: percentile(scores, .10),
    p50Score: percentile(scores, .50),
    p90Score: percentile(scores, .90),
    goalRate: mean(runs.map(r => r.goalActivated ? 1 : 0)),
    treasureRate: mean(runs.map(r => r.treasureActivated ? 1 : 0)),
    treasureSplashRate: mean(runs.map(r => r.treasureSplashHit ? 1 : 0)),
    treasureBrushRate: mean(runs.map(r => r.treasureBrushHit ? 1 : 0)),
    meanBrushUsed: mean(runs.map(r => r.brushUsed)),
    meanBrushSegments: mean(runs.map(r => r.brushSegmentCount)),
    brushBudget: first.brushBudget,
    brushRadius: first.brushRadius,
    brushStrategy: first.brushStrategy,
    startY: first.startY,
    visibleCount: first.visibleCount,
    knownCount: first.knownCount,
    hiddenCount: first.hiddenCount,
  };
}

export function compareBrushBoards(options = {}, presets = BOARD_PRESETS) {
  return presets.map(([cols, rows]) => runBrushBatch({ ...options, cols, rows }));
}

export function compareBrushStrategies(options = {}) {
  const strategies = ['nearest', 'valueRate', 'highValue', 'upper', 'goalFirst'];
  return strategies.map(strategy => runBrushBatch({
    ...options,
    brush: { ...(options.brush ?? {}), strategy },
  }));
}
