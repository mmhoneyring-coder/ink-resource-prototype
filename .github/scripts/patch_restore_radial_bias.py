from pathlib import Path

path = Path('app.js')
src = path.read_text(encoding='utf-8')

old = """    const targetArea = rand(...CONFIG.splash.targetArea);\n    const impact = { x: cx, y: cy };\n\n    // Keep each splash's total ink area roughly stable. More medium islands\n"""
new = """    const targetArea = rand(...CONFIG.splash.targetArea);\n    const impact = { x: cx, y: cy };\n    const directions = createSplashDirections();\n\n    // Keep each splash's total ink area roughly stable. More medium islands\n"""
if src.count(old) != 1:
    raise SystemExit(f'Expected splash setup once, found {src.count(old)}')
src = src.replace(old, new, 1)

old_core = """      const p = splashPoint(\n        impact.x,\n        impact.y,\n        i === 0 ? 0 : 10 * GRID_SCALE,\n        i === 0 ? 12 * GRID_SCALE : CONFIG.splash.spread\n      );\n"""
new_core = """      const p = splashPointBiased(\n        impact.x,\n        impact.y,\n        i === 0 ? 0 : 10 * GRID_SCALE,\n        i === 0 ? 12 * GRID_SCALE : CONFIG.splash.spread,\n        directions,\n        CONFIG.splash.radialBias.core\n      );\n"""
if src.count(old_core) != 1:
    raise SystemExit(f'Expected one core placement block, found {src.count(old_core)}')
src = src.replace(old_core, new_core, 1)

old_small = """      const p = splashPoint(\n        impact.x,\n        impact.y,\n        26 * GRID_SCALE,\n        CONFIG.splash.farSpread\n      );\n"""
new_small = """      const p = splashPointBiased(\n        impact.x,\n        impact.y,\n        26 * GRID_SCALE,\n        CONFIG.splash.farSpread,\n        directions,\n        CONFIG.splash.radialBias.droplet\n      );\n"""
if src.count(old_small) != 1:
    raise SystemExit(f'Expected one droplet placement block, found {src.count(old_small)}')
src = src.replace(old_small, new_small, 1)

path.write_text(src, encoding='utf-8')
