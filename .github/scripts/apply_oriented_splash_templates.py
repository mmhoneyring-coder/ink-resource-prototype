from pathlib import Path
import re

path = Path('app.js')
text = path.read_text(encoding='utf-8')

TEMPLATES = r'''

  // Splash island silhouettes. Each template points toward +X; runtime rotation aligns it to the splash flow.
  // These are deliberately asymmetric ink silhouettes rather than radial/random polygons.
  const SPLASH_CORE_SHAPES = [
    [
      [-0.374,-0.907],[-0.374,-0.841],[-0.538,-0.678],[-0.570,-0.449],[-0.701,-0.350],
      [-0.832,-0.383],[-0.865,-0.318],[-0.799,-0.285],[-0.930,0.009],[-0.930,0.206],
      [-0.865,0.369],[-0.636,0.566],[-0.439,0.533],[-0.276,0.696],[-0.309,0.795],
      [-0.178,0.795],[-0.210,0.860],[-0.145,0.795],[0.051,0.827],[0.149,0.762],
      [0.378,0.827],[0.542,0.631],[0.640,0.664],[0.836,0.500],[0.836,0.337],
      [1.000,0.304],[1.000,0.238],[0.771,0.108],[0.804,-0.023],[0.967,-0.121],
      [0.869,-0.056],[0.771,-0.154],[0.706,-0.383],[0.542,-0.612],[0.607,-0.743],
      [0.542,-0.808],[0.575,-0.874],[0.313,-0.710],[0.117,-0.841],[0.019,-0.808],
      [-0.145,-0.874],[-0.210,-0.808],[-0.309,-0.808],
    ],
    [
      [0.638,-0.222],[0.500,-0.166],[0.445,-0.332],[0.115,-0.387],[-0.064,-0.318],
      [-0.243,-0.387],[-0.298,-0.332],[-0.367,-0.318],[-0.367,-0.345],[-0.394,-0.318],
      [-0.381,-0.277],[-0.463,-0.139],[-0.449,-0.070],[-0.890,-0.098],[-0.931,-0.001],
      [-1.000,0.012],[-0.931,0.054],[-0.408,0.026],[-0.257,0.178],[-0.202,0.343],
      [0.018,0.425],[0.018,0.535],[0.046,0.453],[0.294,0.453],[0.321,0.343],
      [0.390,0.357],[0.376,0.315],[0.514,0.178],[0.528,-0.166],[0.610,-0.166],
    ],
    [
      [-0.666,-0.399],[-0.603,-0.242],[-0.634,-0.116],[-0.540,-0.053],[-0.540,0.104],
      [-0.446,0.135],[-0.634,0.324],[-0.571,0.418],[-0.634,0.575],[-0.509,0.638],
      [-0.351,0.827],[-0.226,0.764],[-0.069,0.795],[0.183,0.512],[0.371,0.512],
      [0.497,0.355],[0.591,0.355],[0.654,0.418],[0.623,0.355],[0.717,0.230],
      [1.000,0.324],[0.969,0.261],[0.780,0.230],[0.717,0.135],[0.591,0.135],
      [0.529,0.072],[0.591,0.010],[0.686,0.010],[0.654,-0.085],[0.717,-0.179],
      [0.560,-0.242],[0.623,-0.556],[0.309,-0.619],[0.214,-0.776],[-0.037,-0.650],
      [-0.226,-0.870],[-0.226,-0.650],[-0.351,-0.556],[-0.509,-0.588],[-0.477,-0.462],
      [-0.540,-0.399],
    ],
  ];

  const SPLASH_DROPLET_SHAPES = [
    [
      [-0.90,-0.15],[-0.55,-0.58],[-0.12,-0.70],[0.25,-0.56],[0.54,-0.72],
      [0.48,-0.30],[1.05,-0.08],[0.58,0.12],[0.62,0.45],[0.15,0.58],
      [-0.20,0.52],[-0.50,0.32],[-0.88,0.22],
    ],
    [
      [-0.92,-0.18],[-0.60,-0.52],[-0.22,-0.62],[0.06,-0.48],[0.22,-0.80],
      [0.32,-0.38],[0.78,-0.46],[0.62,-0.10],[1.12,0.02],[0.54,0.16],
      [0.40,0.50],[0.02,0.62],[-0.34,0.48],[-0.58,0.18],
    ],
  ];
'''

if 'const SPLASH_CORE_SHAPES' not in text:
    marker = '\n  const COLORS = {'
    if marker not in text:
        raise SystemExit('COLORS marker not found')
    text = text.replace(marker, TEMPLATES + marker, 1)

NEW_FUNC = r'''  function createSplashIslandPoints(cx, cy, baseRadius, kind, flowDirection) {
    // Keep placement/size randomness separate from silhouette quality.
    // Templates face +X and are rotated to the physical splash direction.
    if (kind === 'speck') {
      const count = randInt(7, 10);
      const rotation = flowDirection + rand(-.95, .95);
      const stretchX = rand(.88, 1.10);
      const stretchY = rand(.88, 1.10);
      const points = [];
      for (let i = 0; i < count; i++) {
        const angle = i / count * TAU + rand(-.08, .08);
        const radius = baseRadius * rand(.84, 1.16);
        const px = Math.cos(angle) * radius * stretchX;
        const py = Math.sin(angle) * radius * stretchY;
        const cr = Math.cos(rotation);
        const sr = Math.sin(rotation);
        points.push({ x: cx + px * cr - py * sr, y: cy + px * sr + py * cr });
      }
      return points;
    }

    const templates = kind === 'core' ? SPLASH_CORE_SHAPES : SPLASH_DROPLET_SHAPES;
    const template = templates[randInt(0, templates.length - 1)];
    const mirror = rng() < .5 ? -1 : 1;
    const rotationJitter = kind === 'core' ? .30 : .52;
    const rotation = flowDirection + rand(-rotationJitter, rotationJitter);
    const stretchX = kind === 'core' ? rand(.88, 1.15) : rand(.90, 1.11);
    const stretchY = kind === 'core' ? rand(.88, 1.12) : rand(.91, 1.10);
    const localJitter = kind === 'core' ? .055 : .045;
    const forwardStretch = kind === 'core' ? rand(1.02, 1.14) : rand(1.00, 1.09);
    const rearCompress = kind === 'core' ? rand(.92, 1.00) : rand(.95, 1.00);
    const cr = Math.cos(rotation);
    const sr = Math.sin(rotation);

    return template.map(([u, v]) => {
      const jitter = rand(1 - localJitter, 1 + localJitter);
      const directionalScale = u >= 0 ? forwardStretch : rearCompress;
      const px = u * baseRadius * stretchX * directionalScale * jitter;
      const py = v * mirror * baseRadius * stretchY * jitter;
      return {
        x: cx + px * cr - py * sr,
        y: cy + px * sr + py * cr,
      };
    });
  }

  function rasterizeSplashPolygon'''

pattern = re.compile(r"  function createSplashIslandPoints\(cx, cy, baseRadius, kind, flowDirection\) \{.*?\n  \}\n\n  function rasterizeSplashPolygon", re.S)
text, n = pattern.subn(NEW_FUNC, text, count=1)
if n != 1:
    raise SystemExit(f'createSplashIslandPoints replacement failed: {n}')

path.write_text(text, encoding='utf-8')
