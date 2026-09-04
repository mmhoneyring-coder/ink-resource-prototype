from pathlib import Path
import math
import hashlib

COLS = 208
ROWS = 450
RADIUS = 48
EDGE = ROWS - 1
CX = COLS // 2


def mulberry32(seed):
    a = seed & 0xffffffff
    def rng():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xffffffff
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xffffffff
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xffffffff)) & 0xffffffff
        return ((t ^ (t >> 14)) & 0xffffffff) / 4294967296
    return rng


def generate(seed):
    rng = mulberry32(seed)
    def rand(lo, hi): return lo + rng() * (hi - lo)
    def rand_int(lo, hi): return math.floor(rand(lo, hi + 1))
    cells = set()

    def add_disk(cx, cy, radius):
        r2 = radius * radius
        for y in range(math.floor(cy - radius - 1), math.ceil(cy + radius + 1) + 1):
            for x in range(math.floor(cx - radius - 1), math.ceil(cx + radius + 1) + 1):
                if not (0 <= x < COLS and 0 <= y < ROWS):
                    continue
                dx = x - cx
                dy = y - cy
                if dx * dx + dy * dy <= r2 + rand(-1.6, 1.6):
                    cells.add((x, y))

    def stroke(x0, y0, x1, y1, start_radius, end_radius):
        distance = math.hypot(x1 - x0, y1 - y0)
        steps = max(2, math.ceil(distance / 1.1))
        for i in range(steps + 1):
            t = i / steps
            radius = start_radius + (end_radius - start_radius) * t
            jitter = math.sin(t * math.pi) * .22
            add_disk(
                x0 + (x1 - x0) * t + rand(-jitter, jitter),
                y0 + (y1 - y0) * t + rand(-jitter, jitter),
                max(.72, radius),
            )

    body_radius = RADIUS * .83
    cx = CX + rand(-1.4, 1.4)
    cy = EDGE + body_radius * .38
    add_disk(cx, cy, body_radius)

    for _ in range(2):
        angle = rand(math.radians(220), math.radians(320))
        distance = body_radius * rand(.10, .25)
        add_disk(
            cx + math.cos(angle) * distance,
            cy + math.sin(angle) * distance,
            RADIUS * rand(.25, .33),
        )

    count = rand_int(5, 7)
    hero = rand_int(max(1, count // 3), min(count - 2, (2 * count) // 3))
    for i in range(count):
        angle = math.radians(208 + 124 * (i + .5) / count + rand(-7, 7))
        ux = math.cos(angle)
        uy = math.sin(angle)
        root_distance = body_radius * rand(.68, .78)
        if i == hero:
            extra = RADIUS * rand(.24, .38)
            start_radius = RADIUS * rand(.14, .19)
            end_radius = RADIUS * rand(.11, .15)
        else:
            extra = RADIUS * rand(.12, .29)
            start_radius = RADIUS * rand(.11, .17)
            end_radius = RADIUS * rand(.07, .125)
        x0 = cx + ux * root_distance
        y0 = cy + uy * root_distance
        x1 = cx + ux * (root_distance + extra)
        y1 = cy + uy * (root_distance + extra)
        stroke(x0, y0, x1, y1, start_radius, end_radius)
        add_disk(x1, y1, end_radius * rand(1.04, 1.16))

    queue = [cell for cell in cells if cell[1] >= EDGE - 1]
    active = set(queue)
    index = 0
    while index < len(queue):
        x, y = queue[index]
        index += 1
        for next_cell in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if next_cell in cells and next_cell not in active:
                active.add(next_cell)
                queue.append(next_cell)
    return active


# Trial before touching app.js.
widths = []
heights = []
areas = []
row15 = []
signatures = set()
for seed in range(1, 501):
    cells = generate(seed)
    if not cells:
        raise SystemExit(f'empty starter at seed {seed}')
    xs = [x for x, _ in cells]
    ys = [y for _, y in cells]
    widths.append(max(xs) - min(xs) + 1)
    heights.append(EDGE - min(ys) + 1)
    areas.append(len(cells))
    row15.append(sum(1 for _, y in cells if y == EDGE - 15))
    signatures.add(hashlib.sha1(repr(sorted(cells)).encode()).hexdigest())

print(f'trial 500: width={min(widths)}..{max(widths)} avg={sum(widths)/len(widths):.1f}')
print(f'trial 500: height={min(heights)}..{max(heights)} avg={sum(heights)/len(heights):.1f}')
print(f'trial 500: area={min(areas)}..{max(areas)} avg={sum(areas)/len(areas):.1f}')
print(f'trial 500: row15 min={min(row15)} unique={len(signatures)}')

if not (72 <= sum(widths) / len(widths) <= 78):
    raise SystemExit('average width drifted too far from current starter')
if not (31 <= sum(heights) / len(heights) <= 37):
    raise SystemExit('average visible height drifted too far from current starter')
if min(row15) < 48:
    raise SystemExit('touchable upper width became too narrow')
if len(signatures) < 495:
    raise SystemExit('starter variation is insufficient')

path = Path('app.js')
text = path.read_text(encoding='utf-8')
start = text.index('  function createStarterPuddle() {')
end = text.index('\nfunction splashPoint(', start)
replacement = r'''  function createStarterPuddle() {
    const target = new Set();
    const radius = CONFIG.starterPuddle.radius;
    const edge = CONFIG.rows - 1;
    const bodyRadius = radius * .83;
    const cx = starterAnchor().x + rand(-1.4, 1.4);
    const cy = edge + bodyRadius * .38;

    // The full splat continues below the board; only roughly its upper 40% is visible.
    addDisk(cx, cy, bodyRadius, target);

    // Small buried bulges keep the body from becoming a perfect circle.
    for (let i = 0; i < 2; i++) {
      const angle = rand(220 * Math.PI / 180, 320 * Math.PI / 180);
      const distance = bodyRadius * rand(.10, .25);
      addDisk(
        cx + Math.cos(angle) * distance,
        cy + Math.sin(angle) * distance,
        radius * rand(.25, .33),
        target
      );
    }

    // Five to seven rounded connected fingers form the visible splat rim.
    const count = randInt(5, 7);
    const hero = randInt(Math.max(1, Math.floor(count / 3)), Math.min(count - 2, Math.floor(2 * count / 3)));
    for (let i = 0; i < count; i++) {
      const angle = (208 + 124 * (i + .5) / count + rand(-7, 7)) * Math.PI / 180;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const rootDistance = bodyRadius * rand(.68, .78);
      const strong = i === hero;
      const extra = radius * rand(strong ? .24 : .12, strong ? .38 : .29);
      const startRadius = radius * rand(strong ? .14 : .11, strong ? .19 : .17);
      const endRadius = radius * rand(strong ? .11 : .07, strong ? .15 : .125);
      const x0 = cx + ux * rootDistance;
      const y0 = cy + uy * rootDistance;
      const x1 = cx + ux * (rootDistance + extra);
      const y1 = cy + uy * (rootDistance + extra);

      addTaperedCellStroke(x0, y0, x1, y1, startRadius, endRadius, target);
      addDisk(x1, y1, endRadius * rand(1.04, 1.16), target);
    }

    // START must always be one gameplay-connected mass. No detached starter droplets.
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
text = text[:start] + replacement + text[end:]
text = text.replace('minHomeDistance: 34,', 'minHomeDistance: 48,', 1)
path.write_text(text, encoding='utf-8')
