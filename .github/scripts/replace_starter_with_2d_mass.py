from pathlib import Path

p = Path('app.js')
s = p.read_text(encoding='utf-8')

helper_start = s.index('  function carveOpenStarterValley(')
func_start = s.index('  function createStarterPuddle() {', helper_start)
func_end = s.index('\nfunction splashPoint(', func_start)

replacement = r'''  function createStarterPuddle() {
    const target = new Set();
    const radius = CONFIG.starterPuddle.radius;
    const edge = CONFIG.rows - 1;
    const cx = starterAnchor().x + rand(-2.5 * GRID_SCALE, 2.5 * GRID_SCALE);

    // Build a full 2D ink mass first. The visible top contour is only a result
    // of cropping that mass at the bottom of the board; it is not generated as
    // a height profile or a row of hills.
    const bodies = [
      {
        x: cx + radius * rand(-.26, -.10),
        radius: radius * rand(.44, .50),
        depth: rand(.45, .58),
      },
      {
        x: cx + radius * rand(-.02, .14),
        radius: radius * rand(.43, .49),
        depth: rand(.47, .60),
      },
      {
        x: cx + radius * rand(.20, .36),
        radius: radius * rand(.32, .42),
        depth: rand(.50, .65),
      },
    ];

    for (const body of bodies) {
      body.y = edge + body.radius * body.depth;
      addDisk(body.x, body.y, body.radius, target);
    }

    // Broad perimeter lobes belong to the mass itself rather than sitting on a
    // flat baseline. Their size and spacing vary independently.
    const lobeCount = randInt(4, 7);
    for (let i = 0; i < lobeCount; i++) {
      const body = bodies[randInt(0, bodies.length - 1)];
      const angle = rand(205, 335) * Math.PI / 180;
      const lobeRadius = radius * rand(.035, .085);
      const distance = body.radius + lobeRadius * rand(-.16, .22);
      addDisk(
        body.x + Math.cos(angle) * distance,
        body.y + Math.sin(angle) * distance,
        lobeRadius,
        target
      );
    }

    // A few short fluid projections add necks and rounded tips. They grow from
    // the 2D mass itself, not from a horizontal top edge.
    const armCount = randInt(3, 6);
    for (let i = 0; i < armCount; i++) {
      const body = bodies[randInt(0, bodies.length - 1)];
      const angle = rand(205, 335) * Math.PI / 180;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const rootDistance = body.radius * rand(.70, .86);
      const length = radius * rand(.06, .18);
      const startRadius = radius * rand(.015, .035);
      const endRadius = radius * rand(.035, .070);
      const x0 = body.x + ux * rootDistance;
      const y0 = body.y + uy * rootDistance;
      const x1 = x0 + ux * length;
      const y1 = y0 + uy * length;

      addTaperedCellStroke(x0, y0, x1, y1, startRadius, endRadius, target);
      addDisk(x1, y1, endRadius * rand(.95, 1.15), target);
    }

    // Find the real outside contour of the mass and cut only valleys that are
    // open to that exterior. This avoids internal holes and avoids inventing a
    // separate top-edge profile.
    function starterTopAt(sampleX, window = 2 * GRID_SCALE) {
      const left = Math.max(0, Math.floor(sampleX - window));
      const right = Math.min(CONFIG.cols - 1, Math.ceil(sampleX + window));
      for (let y = 0; y <= edge; y++) {
        for (let x = left; x <= right; x++) {
          if (target.has(key(x, y))) return y;
        }
      }
      return null;
    }

    const valleyCount = randInt(2, 4);
    for (let i = 0; i < valleyCount; i++) {
      let x = cx;
      let top = null;
      for (let tries = 0; tries < 30; tries++) {
        x = Math.round(cx + radius * rand(-.55, .55));
        top = starterTopAt(x);
        if (top !== null && top < edge - 5 * GRID_SCALE) break;
      }
      if (top === null) continue;

      const valleyRadius = radius * rand(.035, .070);
      carveDisk(
        x,
        top + valleyRadius * rand(.15, .35),
        valleyRadius,
        target
      );
    }

    // Only the mass connected to the board bottom is gameplay START. If a cut
    // detaches a small cap, it is discarded instead of becoming a loose droplet.
    const queue = [];
    const active = new Set();
    for (const k of target) {
      const p = parseKey(k);
      if (p.y < CONFIG.rows - 2) continue;
      active.add(k);
      queue.push(k);
    }
    for (let i = 0; i < queue.length; i++) {
      const p = parseKey(queue[i]);
      for (const [dx, dy] of neighbors) {
        const nk = key(p.x + dx, p.y + dy);
        if (active.has(nk) || !target.has(nk)) continue;
        active.add(nk);
        queue.push(nk);
      }
    }

    starterInk = active.size ? active : target;
    for (const k of starterInk) ink.add(k);
  }
'''

s = s[:helper_start] + replacement + s[func_end:]
p.write_text(s, encoding='utf-8')
