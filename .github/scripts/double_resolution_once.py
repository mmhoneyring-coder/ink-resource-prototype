from pathlib import Path

p = Path('app.js')
s = p.read_text(encoding='utf-8')

repls = [
    ("  const CONFIG = {", "  const GRID_SCALE = 2;\n\n  const CONFIG = {"),
    ("    cols: 208,", "    cols: Math.round(450 * GRID_SCALE * 9 / 19.5),"),
    ("    rows: 450,", "    rows: 450 * GRID_SCALE,"),
    ("    brushAreaPerTurn: 650,", "    brushAreaPerTurn: 650 * GRID_SCALE * GRID_SCALE,"),
    ("    starterPuddle: { radius: 48 },", "    starterPuddle: { radius: 56 * GRID_SCALE },"),
    ("    brushRadii: { thin: 3, wide: 6 },", "    brushRadii: { thin: 3 * GRID_SCALE, wide: 6 * GRID_SCALE },"),
    ("      coreRadius: [14, 20],", "      coreRadius: [14 * GRID_SCALE, 20 * GRID_SCALE],"),
    ("      dropletRadius: [6, 11],", "      dropletRadius: [6 * GRID_SCALE, 11 * GRID_SCALE],"),
    ("      speckRadius: [3, 5],", "      speckRadius: [3 * GRID_SCALE, 5 * GRID_SCALE],"),
    ("      spread: 115,", "      spread: 115 * GRID_SCALE,"),
    ("      farSpread: 155,", "      farSpread: 155 * GRID_SCALE,"),
    ("      aimDrift: [10, 28],", "      aimDrift: [10 * GRID_SCALE, 28 * GRID_SCALE],"),
    ("      minIslandArea: 30,", "      minIslandArea: 30 * GRID_SCALE * GRID_SCALE,"),
    ("      minHomeDistance: 48,", "      minHomeDistance: 56 * GRID_SCALE,"),
    ("      minGap: 10,", "      minGap: 10 * GRID_SCALE,"),
    ("{ name: 'small', radius: 8 }", "{ name: 'small', radius: 8 * GRID_SCALE }"),
    ("{ name: 'medium', radius: 12 }", "{ name: 'medium', radius: 12 * GRID_SCALE }"),
    ("{ name: 'large', radius: 16 }", "{ name: 'large', radius: 16 * GRID_SCALE }"),
    ("        edge - 17\n", "        edge - 17 * GRID_SCALE\n"),
    ("        i === 0 ? 4 : 12,", "        i === 0 ? 4 * GRID_SCALE : 12 * GRID_SCALE,"),
    ("        i === 0 ? 25 : CONFIG.splash.spread * .58,", "        i === 0 ? 25 * GRID_SCALE : CONFIG.splash.spread * .58,"),
    ("        impact.x, impact.y, 18, CONFIG.splash.spread,", "        impact.x, impact.y, 18 * GRID_SCALE, CONFIG.splash.spread,"),
    ("        impact.x, impact.y, 27, CONFIG.splash.farSpread,", "        impact.x, impact.y, 27 * GRID_SCALE, CONFIG.splash.farSpread,"),
    ("    const margin = Math.ceil(radius + 8);", "    const margin = Math.ceil(radius + 8 * GRID_SCALE);"),
]

for old, new in repls:
    if old not in s:
        raise SystemExit(f'missing expected text: {old!r}')
    s = s.replace(old, new)

# Guard against accidental repeated application.
if s.count('const GRID_SCALE = 2;') != 1:
    raise SystemExit('GRID_SCALE insertion count is not 1')

p.write_text(s, encoding='utf-8')
