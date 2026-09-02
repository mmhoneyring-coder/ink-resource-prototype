import { BOARD_PRESETS, simulateExploration } from './sim-core.mjs';

export const DEFAULT_BRUSH = Object.freeze({
  budget: 240,
  radius: 2,
  startY: 0.78,
});

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

function closestPointOnSegment(px, py, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-9) return { x: a.x, y: a.y, distance: Math.hypot(px - a.x, py - a.y) };
  const t = clamp(((px - a.x) * vx + (py - a.y) * vy) / len2, 0, 1);
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

function touchResourcesAlongSegment(resources, segment, brushRadius) {
  let newDiscoveries = 0;
  let newActivations = 0;

  for (const resource of resources) {
    if (resource.activated) continue;
    const threshold = resource.radius + brushRadius;
    if (distancePointToSegment(resource.x, resource.y, segment.a, segment.b) > threshold) continue;

    const wasRevealed = resource.revealed;
    resource.revealed = true;
    resource.activated = true;
    resource.discoveredByBrush = !wasRevealed;
    if (!wasRevealed) newDiscoveries++;
    newActivations++;
  }

  return { newDiscoveries, newActivations };
}

function chooseNearestRevealed(resources, home, segments) {
  let best = null;
  for (const resource of resources) {
    if (!resource.revealed || resource.activated) continue;
    const start = closestNetworkPoint(resource, home, segments);
    if (!best || start.distance < best.distance) {
      best = { resource, start, distance: start.distance };
    }
  }
  return best;
}

export function simulateBrushRun(options = {}) {
  const brush = { ...DEFAULT_BRUSH, ...(options.brush ?? {}) };
  const budget = Math.max(0, Number(brush.budget ?? DEFAULT_BRUSH.budget));
  const brushRadius = Math.max(.25, Number(brush.radius ?? DEFAULT_BRUSH.radius));
  const startY = clamp(Number(brush.startY ?? DEFAULT_BRUSH.startY), .5, .98);

  const exploration = simulateExploration({
    ...options,
    returnInk: true,
    returnResources: true,
  });

  const resources = exploration.resources.map((resource, index) => ({
    ...resource,
    id: index,
    splashHit: Boolean(resource.hit),
    revealed: Boolean(resource.hit),
    activated: false,
    discoveredByBrush: false,
  }));

  const home = {
    x: exploration.cols / 2,
    y: exploration.rows * startY,
  };
  const segments = [];
  let used = 0;
  let brushDiscoveries = 0;
  let activations = 0;

  while (used + 1e-6 < budget) {
    const choice = chooseNearestRevealed(resources, home, segments);
    if (!choice) break;

    // If a revealed resource already touches the connected brush network,
    // it is effectively activatable without spending meaningful extra length.
    if (choice.distance <= choice.resource.radius + brushRadius) {
      choice.resource.activated = true;
      activations++;
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
    brushDiscoveries += touched.newDiscoveries;
    activations += touched.newActivations;

    if (travel + 1e-6 < fullDistance) break;

    // Numerical fallback: reaching the chosen center must activate it.
    if (!choice.resource.activated) {
      choice.resource.activated = true;
      activations++;
    }
  }

  const splashFound = resources.filter(r => r.splashHit).length;
  const finalFound = resources.filter(r => r.revealed).length;
  const activatedCount = resources.filter(r => r.activated).length;
  const splashFoundActivated = resources.filter(r => r.splashHit && r.activated).length;

  return {
    ...exploration,
    resources,
    brushSegments: segments,
    brushBudget: budget,
    brushUsed: used,
    brushRadius,
    startY,
    home,
    splashFound,
    brushDiscoveries,
    finalFound,
    activatedCount,
    splashFoundActivated,
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
  return {
    cols: first.cols,
    rows: first.rows,
    trials,
    resourceCount: first.resourceCount,
    resourceScale: first.resourceScale,
    meanResourceRadius: mean(runs.map(r => r.meanResourceRadius)),
    meanCoverage: mean(runs.map(r => r.coverage)),
    meanSplashFound: mean(runs.map(r => r.splashFound)),
    meanBrushDiscoveries: mean(runs.map(r => r.brushDiscoveries)),
    meanFinalFound: mean(runs.map(r => r.finalFound)),
    meanActivated: mean(activated),
    p10Activated: percentile(activated, .10),
    p50Activated: percentile(activated, .50),
    p90Activated: percentile(activated, .90),
    meanBrushUsed: mean(runs.map(r => r.brushUsed)),
    meanBrushSegments: mean(runs.map(r => r.brushSegmentCount)),
    brushBudget: first.brushBudget,
    brushRadius: first.brushRadius,
    startY: first.startY,
  };
}

export function compareBrushBoards(options = {}, presets = BOARD_PRESETS) {
  return presets.map(([cols, rows]) => runBrushBatch({ ...options, cols, rows }));
}
