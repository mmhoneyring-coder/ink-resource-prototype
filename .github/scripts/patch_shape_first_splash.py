from pathlib import Path
import re

path = Path('app.js')
src = path.read_text(encoding='utf-8')

old_config = """    splash: {
      coreCount: [4, 6],
      dropletCount: [10, 15],
      speckCount: [8, 12],
      coreRadius: [14 * GRID_SCALE, 20 * GRID_SCALE],
      dropletRadius: [6 * GRID_SCALE, 11 * GRID_SCALE],
      speckRadius: [3 * GRID_SCALE, 5 * GRID_SCALE],
      spread: 115 * GRID_SCALE,
      farSpread: 155 * GRID_SCALE,
      aimDrift: [10 * GRID_SCALE, 28 * GRID_SCALE],
      minIslandArea: 30 * GRID_SCALE * GRID_SCALE,
      radialDirections: [2, 3],
      radialJitter: 1.0,
      radialBias: { core: 0.40, droplet: 0.50, speck: 0.58 },
    },"""
new_config = """    splash: {
      // Back-to-basics splash: a few nearby islands, no wide speck field.
      coreCount: [3, 5],
      dropletCount: [1, 5],
      speckCount: [0, 0],
      coreRadius: [14 * GRID_SCALE, 20 * GRID_SCALE],
      dropletRadius: [5 * GRID_SCALE, 10 * GRID_SCALE],
      speckRadius: [3 * GRID_SCALE, 5 * GRID_SCALE],
      spread: 60 * GRID_SCALE,
      farSpread: 84 * GRID_SCALE,
      aimDrift: [0, 0],
      minIslandArea: 30 * GRID_SCALE * GRID_SCALE,
      radialDirections: [2, 3],
      radialJitter: 1.0,
      radialBias: { core: 0.40, droplet: 0.50, speck: 0.58 },
    },"""
if src.count(old_config) != 1:
    raise SystemExit(f'Expected one splash config block, found {src.count(old_config)}')
src = src.replace(old_config, new_config, 1)

blob_pat = re.compile(r"  function addBlob\(cx, cy, baseRadius, lobes = \[2, 5\], target = ink\) \{.*?\n  \}\n\n  function addTaperedCellStroke", re.S)
blob_match = blob_pat.search(src)
if not blob_match:
    raise SystemExit('Could not locate addBlob block')

replacement = """  function addBlob(cx, cy, baseRadius, lobes = [2, 5], target = ink) {
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

  function addTaperedCellStroke"""
src = src[:blob_match.start()] + replacement + src[blob_match.end():]

splash_pat = re.compile(r"  function splashAt\(cx, cy\) \{.*?\n  \}\n\n  function placeResource", re.S)
splash_match = splash_pat.search(src)
if not splash_match:
    raise SystemExit('Could not locate splashAt block')

new_splash = """  function splashAt(cx, cy) {
    if (gameOver || phase !== 'splash') return;

    const splashInk = new Set();
    const core = randInt(...CONFIG.splash.coreCount);
    const droplets = randInt(...CONFIG.splash.dropletCount);
    const impact = { x: cx, y: cy };

    // Original-scale composition: a few medium islands near the tap and only
    // a handful of smaller islands farther out. Placement is deliberately
    // simple again so shape can be judged independently from spread behavior.
    for (let i = 0; i < core; i++) {
      const p = splashPoint(
        impact.x,
        impact.y,
        i === 0 ? 0 : 10 * GRID_SCALE,
        i === 0 ? 12 * GRID_SCALE : CONFIG.splash.spread
      );
      const flow = Math.atan2(p.y - impact.y, p.x - impact.x) || rand(0, TAU);
      addShapeFirstSplashIsland(
        p.x,
        p.y,
        rand(...CONFIG.splash.coreRadius),
        flow,
        'core',
        splashInk
      );
    }

    for (let i = 0; i < droplets; i++) {
      const p = splashPoint(
        impact.x,
        impact.y,
        26 * GRID_SCALE,
        CONFIG.splash.farSpread
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

  function placeResource"""
src = src[:splash_match.start()] + new_splash + src[splash_match.end():]

path.write_text(src, encoding='utf-8')
