from pathlib import Path

path = Path('app.js')
src = path.read_text(encoding='utf-8')

replacements = [
    (
"""      // Back-to-basics splash: a few nearby islands, no wide speck field.
      coreCount: [3, 5],
      dropletCount: [3, 12],
      speckCount: [0, 0],
      coreRadius: [9 * GRID_SCALE, 14 * GRID_SCALE],
      dropletRadius: [3 * GRID_SCALE, 6 * GRID_SCALE],
      speckRadius: [3 * GRID_SCALE, 5 * GRID_SCALE],
      spread: 60 * GRID_SCALE,
      farSpread: 84 * GRID_SCALE,
      aimDrift: [0, 0],
      minIslandArea: 12 * GRID_SCALE * GRID_SCALE,
      targetArea: [2000 * GRID_SCALE * GRID_SCALE, 2200 * GRID_SCALE * GRID_SCALE],
      radialDirections: [2, 3],
      radialJitter: 1.0,
      radialBias: { core: 0.40, droplet: 0.50, speck: 0.58 },
""",
"""      // Three-tier splash: a few large and medium islands, then small ones fill the area budget.
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
"""
    ),
    (
"""    const splashInk = new Set();
    const core = randInt(...CONFIG.splash.coreCount);
    const targetArea = rand(...CONFIG.splash.targetArea);
    const impact = { x: cx, y: cy };
    const directions = createSplashDirections();

    // Keep each splash's total ink area roughly stable. More medium islands
    // consume a larger share of the area budget, leaving less for small ones.
    const coreShare = .64 + (core - CONFIG.splash.coreCount[0]) * .08;
    const idealCoreRadius = Math.sqrt((targetArea * coreShare / core) / Math.PI);

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
        idealCoreRadius * rand(.90, 1.10),
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

    const [minDroplets, maxDroplets] = CONFIG.splash.dropletCount;
""",
"""    const splashInk = new Set();
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
"""
    ),
]

for old, new in replacements:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, found {count}: {old[:140]!r}')
    src = src.replace(old, new, 1)

path.write_text(src, encoding='utf-8')
