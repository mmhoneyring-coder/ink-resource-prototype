from pathlib import Path

p = Path('app.js')
s = p.read_text(encoding='utf-8')

start = s.index('  function createStarterPuddle() {')
end = s.index('\nfunction splashPoint(', start)

replacement = r'''  function createStarterPuddle() {
    const target = new Set();
    const radius = CONFIG.starterPuddle.radius;
    const edge = CONFIG.rows - 1;

    // Four retained starter lineages. These are deliberately irregular profiles,
    // not circles that are deformed after the fact.
    const templates = [
      [0.000,0.149,0.278,0.387,0.480,0.551,0.594,0.647,0.813,0.900,0.752,0.679,0.893,1.000,0.710,0.629,0.774,0.775,0.702,0.756,0.961,0.918,0.683,0.691,0.841,0.858,0.673,0.586,0.680,0.773,0.704,0.540,0.501,0.539,0.578,0.560,0.453,0.324,0.218,0.110,0.000],
      [0.000,0.102,0.192,0.268,0.333,0.390,0.440,0.489,0.558,0.618,0.556,0.466,0.606,0.699,0.547,0.532,0.579,0.568,0.509,0.658,1.000,0.626,0.543,0.518,0.575,0.706,0.716,0.552,0.506,0.554,0.586,0.547,0.467,0.405,0.367,0.334,0.293,0.237,0.168,0.089,0.000],
      [0.000,0.134,0.240,0.309,0.370,0.457,0.571,0.717,0.879,0.853,0.687,0.652,0.738,0.770,0.573,0.517,0.625,0.651,0.590,0.566,0.690,0.758,0.703,0.660,0.830,1.000,0.743,0.564,0.670,0.776,0.702,0.543,0.528,0.560,0.580,0.521,0.395,0.281,0.185,0.092,0.000],
      [0.000,0.146,0.272,0.377,0.467,0.527,0.556,0.602,0.757,0.828,0.720,0.792,0.992,0.721,0.704,0.812,0.693,0.623,0.894,0.869,0.699,0.789,0.879,0.761,0.686,0.896,1.000,0.697,0.601,0.713,0.789,0.706,0.571,0.522,0.503,0.481,0.425,0.331,0.231,0.121,0.000],
    ];

    const profile = templates[randInt(0, templates.length - 1)];
    const mirrored = rng() < .5;
    const halfWidth = radius * rand(.88, .98);
    const visibleHeight = radius * rand(.36, .43);
    const baseHeight = radius * rand(.11, .15);
    const cx = starterAnchor().x + rand(-3 * GRID_SCALE, 3 * GRID_SCALE);
    const noiseKnots = Array.from({ length: 9 }, () => rand(-.018, .018));

    function sample(values, t) {
      const scaled = clamp(t, 0, 1) * (values.length - 1);
      const i = Math.min(values.length - 2, Math.floor(scaled));
      const f = scaled - i;
      return values[i] * (1 - f) + values[i + 1] * f;
    }

    for (let x = Math.floor(cx - halfWidth); x <= Math.ceil(cx + halfWidth); x++) {
      if (x < 0 || x >= CONFIG.cols) continue;
      const u = (x - cx) / halfWidth;
      if (Math.abs(u) > 1) continue;

      const profileU = mirrored ? -u : u;
      const profileValue = sample(profile, (profileU + 1) * .5);
      const noise = sample(noiseKnots, (u + 1) * .5);
      const envelope = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 6)), .68);
      const height = Math.max(
        baseHeight * envelope,
        visibleHeight * Math.max(0, profileValue + noise)
      );
      const top = Math.max(0, Math.round(edge - height));

      // Fill downward so START is always a single cell-native ink mass.
      for (let y = top; y <= edge; y++) target.add(key(x, y));
    }

    starterInk = target;
    for (const k of starterInk) ink.add(k);
  }
'''

s = s[:start] + replacement + s[end:]
p.write_text(s, encoding='utf-8')
