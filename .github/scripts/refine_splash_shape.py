from pathlib import Path
import re

path = Path('app.js')
text = path.read_text(encoding='utf-8')

old_config = '''    splash: {
      coreCount: [3, 4],
      dropletCount: [5, 7],
      speckCount: [6, 9],
      coreRadius: [15, 21],
      dropletRadius: [6, 10],
      speckRadius: [2.2, 3.8],
      coreSpread: 68,
      spread: 120,
      farSpread: 158,
      aimDrift: [12, 30],
      radialDirections: [2, 3],
      radialJitter: 0.82,
      radialBias: { core: 0.52, droplet: 0.60, speck: 0.65 },
    },'''
new_config = '''    splash: {
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
    },'''
if old_config not in text:
    raise SystemExit('current splash config not found')
text = text.replace(old_config, new_config, 1)

shape_block = r'''  function createSplashIslandPoints\(cx, cy, baseRadius, kind, flowDirection\) \{.*?\n  \}\n\n  function rasterizeSplashPolygon'''
new_shape = r'''  function createSplashIslandPoints(cx, cy, baseRadius, kind, flowDirection) {
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

  function rasterizeSplashPolygon'''
text, count = re.subn(shape_block, new_shape, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'createSplashIslandPoints replace count={count}')

# Each visual island should have one connected gameplay footprint, just as START keeps its anchored component.
anchor = '''  function addSplashIsland(cx, cy, baseRadius, kind, flowDirection, target) {
    const points = createSplashIslandPoints(cx, cy, baseRadius, kind, flowDirection);
    const cells = rasterizeSplashPolygon(points);
    if (!cells.size) return null;
    for (const k of cells) {
      target.add(k);
      splashVisualInk.add(k);
    }
    const shape = { points, cells };
    splashShapes.push(shape);
    return shape;
  }
'''
replacement = '''  function largestCellComponent(cells) {
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
'''
if anchor not in text:
    raise SystemExit('addSplashIsland block not found')
text = text.replace(anchor, replacement, 1)

center_block = r'''  function chooseSplashCenter\(impact, radius, kind, index, directions, placed\) \{.*?\n  \}\n\n  function createStarterPuddle'''
new_center = r'''  function chooseSplashCenter(impact, radius, kind, index, directions, placed) {
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

  function createStarterPuddle'''
text, count = re.subn(center_block, new_center, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'chooseSplashCenter replace count={count}')

path.write_text(text, encoding='utf-8')
