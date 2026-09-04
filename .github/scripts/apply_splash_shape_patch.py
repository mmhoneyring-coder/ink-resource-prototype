from pathlib import Path
import re

path = Path('app.js')
text = path.read_text(encoding='utf-8')

old_config = """    splash: {
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
    },"""
new_config = """    splash: {
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
    },"""
if old_config not in text:
    raise SystemExit('splash config block not found')
text = text.replace(old_config, new_config, 1)

state_anchor = "  let feedbackTimer = null;\n"
state_insert = "  let feedbackTimer = null;\n  let splashShapes = [];\n  let splashVisualInk = new Set();\n"
if state_anchor not in text:
    raise SystemExit('state anchor not found')
text = text.replace(state_anchor, state_insert, 1)

new_shape_helpers = r'''  function angleDiff(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  function createSplashIslandPoints(cx, cy, baseRadius, kind, flowDirection) {
    const profile = kind === 'core'
      ? {
          points: 72,
          roughness: .025,
          stretch: [.90, 1.10],
          lobes: [3, 5],
          dents: [1, 3],
          spikes: [3, 6],
          lobeAmp: [.05, .12],
          dentAmp: [.04, .10],
          spikeAmp: [.12, .34],
          spikeWidth: [.035, .085],
        }
      : kind === 'droplet'
        ? {
            points: 56,
            roughness: .022,
            stretch: [.92, 1.10],
            lobes: [2, 4],
            dents: [1, 2],
            spikes: [1, 3],
            lobeAmp: [.04, .09],
            dentAmp: [.03, .07],
            spikeAmp: [.08, .22],
            spikeWidth: [.045, .10],
          }
        : {
            points: 36,
            roughness: .015,
            stretch: [.94, 1.06],
            lobes: [1, 2],
            dents: [0, 0],
            spikes: [0, 1],
            lobeAmp: [.02, .05],
            dentAmp: [0, 0],
            spikeAmp: [.04, .10],
            spikeWidth: [.06, .12],
          };

    const rotation = rand(0, TAU);
    const stretch = rand(...profile.stretch);
    const phase2 = rand(0, TAU);
    const phase5 = rand(0, TAU);
    const features = [];

    for (let i = 0; i < randInt(...profile.lobes); i++) {
      features.push({
        type: 'lobe',
        angle: rand(0, TAU),
        amp: rand(...profile.lobeAmp),
        width: rand(.18, .38),
      });
    }
    for (let i = 0; i < randInt(...profile.dents); i++) {
      features.push({
        type: 'dent',
        angle: rand(0, TAU),
        amp: rand(...profile.dentAmp),
        width: rand(.18, .32),
      });
    }
    for (let i = 0; i < randInt(...profile.spikes); i++) {
      features.push({
        type: 'spike',
        angle: rng() < .45 ? flowDirection + rand(-.65, .65) : rand(0, TAU),
        amp: rand(...profile.spikeAmp),
        width: rand(...profile.spikeWidth),
      });
    }

    const cr = Math.cos(rotation);
    const sr = Math.sin(rotation);
    const points = [];
    for (let i = 0; i < profile.points; i++) {
      const angle = i / profile.points * TAU;
      let radial = 1
        + .035 * Math.sin(2 * angle + phase2)
        + .018 * Math.sin(5 * angle + phase5)
        + rand(-profile.roughness, profile.roughness);

      for (const feature of features) {
        const diff = angleDiff(angle, feature.angle);
        const bump = Math.exp(-.5 * (diff / feature.width) ** 2);
        radial += feature.type === 'dent' ? -feature.amp * bump : feature.amp * bump;
      }

      const px = Math.cos(angle) * baseRadius * radial * stretch;
      const py = Math.sin(angle) * baseRadius * radial / stretch;
      points.push({
        x: cx + px * cr - py * sr,
        y: cy + px * sr + py * cr,
      });
    }
    return points;
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

  function addSplashIsland(cx, cy, baseRadius, kind, flowDirection, target) {
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

  function chooseSplashCenter(impact, radius, kind, index, directions, placed) {
    const range = kind === 'core'
      ? (index === 0 ? [5, 24] : [18, CONFIG.splash.coreSpread])
      : kind === 'droplet'
        ? [30, CONFIG.splash.spread]
        : [50, CONFIG.splash.farSpread];
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
            ? .72
            : .20;
        return Math.hypot(candidate.x - other.x, candidate.y - other.y)
          >= factor * (radius + other.radius);
      });
      if (spaced) break;
    }
    return candidate;
  }

'''
pattern = re.compile(r"  function addSplashTaperedStroke\(.*?\n  }\n\n  function addSplashBlob\(.*?\n  }\n\n(?=  function createStarterPuddle)", re.S)
text, count = pattern.subn(new_shape_helpers, text, count=1)
if count != 1:
    raise SystemExit(f'shape helper block replacement count={count}')

new_splash_at = r'''  function splashAt(cx, cy) {
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

'''
pattern = re.compile(r"  function splashAt\(cx, cy\) \{.*?\n  }\n\n(?=  function placeResource)", re.S)
text, count = pattern.subn(new_splash_at, text, count=1)
if count != 1:
    raise SystemExit(f'splashAt replacement count={count}')

render_marker = "  function renderCoinHalo(resource, m) {"
render_shapes = r'''  function renderSplashShapes(m) {
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

'''
if render_marker not in text:
    raise SystemExit('renderCoinHalo marker not found')
text = text.replace(render_marker, render_shapes + render_marker, 1)

old_render = """    renderBands(m);
    renderStarterPuddle(m);

    for (const k of ink) {
      if (starterInk.has(k)) continue;"""
new_render = """    renderBands(m);
    renderStarterPuddle(m);
    renderSplashShapes(m);

    for (const k of ink) {
      if (starterInk.has(k) || splashVisualInk.has(k)) continue;"""
if old_render not in text:
    raise SystemExit('render loop anchor not found')
text = text.replace(old_render, new_render, 1)

old_reset = """    ink = new Set();
    starterInk = new Set();
    connected = new Set();"""
new_reset = """    ink = new Set();
    starterInk = new Set();
    splashShapes = [];
    splashVisualInk = new Set();
    connected = new Set();"""
if old_reset not in text:
    raise SystemExit('reset state anchor not found')
text = text.replace(old_reset, new_reset, 1)

path.write_text(text, encoding='utf-8')
print('patched app.js')
