(() => {
  'use strict';

  const STORAGE_KEY = 'inkStarterLabStateV1';
  const SAMPLE_COUNT = 192;
  const CROP_RATIO = 0.30;
  const FULL_SIZE = 520;
  const PREVIEW_W = 520;
  const PREVIEW_H = 170;

  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function randomSeed() {
    if (globalThis.crypto?.getRandomValues) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] >>> 0;
    }
    return (Math.random() * 0xffffffff) >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function rand(rng, lo, hi) { return lo + (hi - lo) * rng(); }
  function randInt(rng, lo, hi) { return Math.floor(rand(rng, lo, hi + 1)); }
  function wrapAngle(a) {
    const tau = Math.PI * 2;
    a %= tau;
    return a < 0 ? a + tau : a;
  }
  function angleDelta(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }
  function gaussianAngle(theta, center, width) {
    const d = angleDelta(theta, center) / width;
    return Math.exp(-0.5 * d * d);
  }

  function createParams(seed) {
    const rng = mulberry32(seed);
    const waveCount = 4;
    const waves = [];
    const freqs = [2, 3, 4, 5];
    for (let i = 0; i < waveCount; i++) {
      waves.push({
        freq: freqs[i],
        amp: rand(rng, 0.018, i < 2 ? 0.050 : 0.035),
        phase: rand(rng, 0, Math.PI * 2),
      });
    }

    const splashes = [];
    const splashCount = randInt(rng, 8, 12);
    let angle = rand(rng, 0, Math.PI * 2);
    for (let i = 0; i < splashCount; i++) {
      angle += rand(rng, 0.34, 0.80);
      const width = rand(rng, 0.10, 0.23);
      const amp = rand(rng, 0.075, 0.205);
      const dip = rand(rng, 0.018, 0.060);
      splashes.push({
        angle: wrapAngle(angle),
        amp,
        width,
        dip,
        dipOffset: width * rand(rng, 1.05, 1.65),
        dipWidth: width * rand(rng, 0.72, 1.08),
      });
    }

    return {
      seed,
      baseRadius: rand(rng, 0.315, 0.350),
      xScale: rand(rng, 0.94, 1.05),
      yScale: rand(rng, 0.94, 1.05),
      rotation: rand(rng, -0.18, 0.18),
      waves,
      splashes,
      smoothPasses: randInt(rng, 3, 5),
    };
  }

  function mutateParams(parent, seed, strength) {
    const rng = mulberry32(seed);
    const out = structuredClone(parent);
    out.seed = seed;

    const s = strength;
    out.baseRadius = clamp(out.baseRadius + rand(rng, -0.012, 0.012) * s, 0.29, 0.37);
    out.xScale = clamp(out.xScale + rand(rng, -0.035, 0.035) * s, 0.88, 1.10);
    out.yScale = clamp(out.yScale + rand(rng, -0.035, 0.035) * s, 0.88, 1.10);
    out.rotation = clamp(out.rotation + rand(rng, -0.10, 0.10) * s, -0.35, 0.35);

    for (const wave of out.waves) {
      wave.amp = clamp(wave.amp + rand(rng, -0.010, 0.010) * s, 0.010, 0.060);
      wave.phase = wrapAngle(wave.phase + rand(rng, -0.35, 0.35) * s);
    }

    for (const splash of out.splashes) {
      splash.angle = wrapAngle(splash.angle + rand(rng, -0.18, 0.18) * s);
      splash.amp = clamp(splash.amp + rand(rng, -0.030, 0.030) * s, 0.045, 0.235);
      splash.width = clamp(splash.width + rand(rng, -0.030, 0.030) * s, 0.075, 0.26);
      splash.dip = clamp(splash.dip + rand(rng, -0.018, 0.018) * s, 0.010, 0.085);
      splash.dipOffset = clamp(
        splash.dipOffset + rand(rng, -0.035, 0.035) * s,
        splash.width * 0.9,
        splash.width * 1.9
      );
      splash.dipWidth = clamp(
        splash.dipWidth + rand(rng, -0.025, 0.025) * s,
        splash.width * 0.62,
        splash.width * 1.24
      );
    }

    if (rng() < 0.18 * s && out.splashes.length < 14) {
      const source = out.splashes[randInt(rng, 0, out.splashes.length - 1)];
      out.splashes.push({
        angle: wrapAngle(source.angle + rand(rng, -0.55, 0.55)),
        amp: clamp(source.amp * rand(rng, 0.65, 1.10), 0.045, 0.22),
        width: clamp(source.width * rand(rng, 0.72, 1.14), 0.075, 0.25),
        dip: clamp(source.dip * rand(rng, 0.70, 1.18), 0.010, 0.080),
        dipOffset: source.dipOffset,
        dipWidth: source.dipWidth,
      });
    }
    if (rng() < 0.12 * s && out.splashes.length > 7) {
      out.splashes.splice(randInt(rng, 0, out.splashes.length - 1), 1);
    }

    out.splashes.sort((a, b) => a.angle - b.angle);
    out.smoothPasses = clamp(Math.round(out.smoothPasses + rand(rng, -1, 1) * s), 2, 6);
    return out;
  }

  function rawRadiusAt(params, theta) {
    let r = 1;

    for (const wave of params.waves) {
      r += wave.amp * Math.sin(wave.freq * theta + wave.phase);
    }

    for (const splash of params.splashes) {
      const rise = gaussianAngle(theta, splash.angle, splash.width);
      const leftDip = gaussianAngle(theta, splash.angle - splash.dipOffset, splash.dipWidth);
      const rightDip = gaussianAngle(theta, splash.angle + splash.dipOffset, splash.dipWidth);
      r += splash.amp * rise;
      r -= splash.dip * (leftDip + rightDip);
    }

    return Math.max(0.66, r);
  }

  function smoothCircular(values, passes) {
    let src = values.slice();
    for (let pass = 0; pass < passes; pass++) {
      const dst = new Array(src.length);
      for (let i = 0; i < src.length; i++) {
        const a = src[(i - 2 + src.length) % src.length];
        const b = src[(i - 1 + src.length) % src.length];
        const c = src[i];
        const d = src[(i + 1) % src.length];
        const e = src[(i + 2) % src.length];
        dst[i] = a * 0.06 + b * 0.24 + c * 0.40 + d * 0.24 + e * 0.06;
      }
      src = dst;
    }
    return src;
  }

  function buildShape(params, size = FULL_SIZE) {
    const cx = size * 0.5;
    const cy = size * 0.50;
    const base = size * params.baseRadius;
    const radii = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const theta = i / SAMPLE_COUNT * Math.PI * 2;
      radii.push(rawRadiusAt(params, theta));
    }
    const smoothed = smoothCircular(radii, params.smoothPasses);
    const cosR = Math.cos(params.rotation);
    const sinR = Math.sin(params.rotation);

    const points = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const theta = i / SAMPLE_COUNT * Math.PI * 2;
      const r = base * smoothed[i];
      const ex = Math.cos(theta) * r * params.xScale;
      const ey = Math.sin(theta) * r * params.yScale;
      points.push({
        x: cx + ex * cosR - ey * sinR,
        y: cy + ex * sinR + ey * cosR,
      });
    }

    return {
      points,
      core: {
        cx,
        cy,
        rx: base * params.xScale,
        ry: base * params.yScale,
        rotation: params.rotation,
      },
    };
  }

  function boundsOf(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function smoothClosedPath(ctx, points) {
    const n = points.length;
    if (n < 4) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.closePath();
  }

  function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  }

  function drawFull(canvas, candidate, showCore) {
    const ctx = clearCanvas(canvas);
    const shape = buildShape(candidate.params, canvas.width);
    const b = boundsOf(shape.points);

    ctx.save();
    ctx.fillStyle = '#202327';
    smoothClosedPath(ctx, shape.points);
    ctx.fill();

    const cropY = b.minY + b.height * CROP_RATIO;
    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(96,119,124,.75)';
    ctx.beginPath();
    ctx.moveTo(Math.max(8, b.minX - 10), cropY);
    ctx.lineTo(Math.min(canvas.width - 8, b.maxX + 10), cropY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (showCore) {
      ctx.translate(shape.core.cx, shape.core.cy);
      ctx.rotate(shape.core.rotation);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(204,81,64,.85)';
      ctx.beginPath();
      ctx.ellipse(0, 0, shape.core.rx, shape.core.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    return { shape, bounds: b, cropY };
  }

  function drawPreview(canvas, candidate) {
    const ctx = clearCanvas(canvas);
    const full = buildShape(candidate.params, FULL_SIZE);
    const b = boundsOf(full.points);
    const cropBottom = b.minY + b.height * CROP_RATIO;
    const cropHeight = cropBottom - b.minY;
    const marginX = 16;
    const marginY = 12;
    const sx = (canvas.width - marginX * 2) / b.width;
    const sy = (canvas.height - marginY * 2) / cropHeight;
    const scale = Math.min(sx, sy);
    const cropMidX = (b.minX + b.maxX) * 0.5;

    const pts = full.points.map(p => ({
      x: canvas.width * 0.5 + (p.x - cropMidX) * scale,
      y: marginY + (p.y - b.minY) * scale,
    }));

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();
    ctx.fillStyle = '#202327';
    smoothClosedPath(ctx, pts);
    ctx.fill();
    ctx.restore();
  }

  function summarize(params) {
    const amps = params.splashes.map(s => s.amp);
    const widths = params.splashes.map(s => s.width);
    const minAmp = Math.min(...amps);
    const maxAmp = Math.max(...amps);
    const minW = Math.min(...widths);
    const maxW = Math.max(...widths);
    return `${params.splashes.length}飛沫 / 膨らみ ${minAmp.toFixed(2)}–${maxAmp.toFixed(2)} / 幅 ${minW.toFixed(2)}–${maxW.toFixed(2)}`;
  }

  function makeCandidate(params, role, generation, parentSeed = null) {
    return {
      id: `G${generation}-${role}-${params.seed.toString(16).padStart(8, '0')}`,
      role,
      generation,
      parentSeed,
      params,
    };
  }

  function initialCandidates() {
    return ['A', 'B', 'C'].map(role => {
      const seed = randomSeed();
      return makeCandidate(createParams(seed), role, 0, null);
    });
  }

  function childrenFrom(parent, generation) {
    const exact = makeCandidate(structuredClone(parent.params), '親', generation, parent.params.seed);
    exact.id = `G${generation}-親-${parent.params.seed.toString(16).padStart(8, '0')}`;

    const seedA = randomSeed();
    const seedB = randomSeed();
    const a = makeCandidate(mutateParams(parent.params, seedA, 0.70), '変異A', generation, parent.params.seed);
    const b = makeCandidate(mutateParams(parent.params, seedB, 1.15), '変異B', generation, parent.params.seed);
    return [exact, a, b];
  }

  function defaultState() {
    return {
      generation: 0,
      parent: null,
      candidates: initialCandidates(),
      history: [],
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed?.candidates?.length) return defaultState();
      return parsed;
    } catch {
      return defaultState();
    }
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function renderHistory() {
    const list = $('#historyList');
    list.textContent = '';
    const items = state.history.slice(-10).reverse();
    if (!items.length) {
      const span = document.createElement('span');
      span.className = 'history-chip';
      span.textContent = 'まだ採用履歴なし';
      list.appendChild(span);
      return;
    }
    for (const item of items) {
      const span = document.createElement('span');
      span.className = 'history-chip';
      span.textContent = `G${item.generation} ${item.role} · ${item.params.seed.toString(16).padStart(8, '0')}`;
      list.appendChild(span);
    }
  }

  function render() {
    const showCore = $('#showCore').checked;
    const cards = $$('.card');
    cards.forEach((card, i) => {
      const c = state.candidates[i];
      card.dataset.index = i;
      card.querySelector('.card-title').textContent = c.role;
      card.querySelector('.meta').textContent = `seed ${c.params.seed.toString(16).padStart(8, '0')}`;
      card.querySelector('.summary').textContent = summarize(c.params);
      drawFull(card.querySelector('.full-canvas'), c, showCore);
      drawPreview(card.querySelector('.preview-canvas'), c);
    });

    const status = $('#parentStatus');
    if (state.parent) {
      status.textContent = `世代 ${state.generation} / 親 seed ${state.parent.params.seed.toString(16).padStart(8, '0')}`;
    } else {
      status.textContent = '初代3候補。1つ採用すると、その形を親として次世代を作ります。';
    }
    $('#undoBtn').disabled = state.history.length === 0;
    $('#copyBtn').disabled = !state.parent;
    renderHistory();
  }

  function adopt(index) {
    const chosen = structuredClone(state.candidates[index]);
    state.history.push({
      generation: state.generation,
      role: chosen.role,
      params: structuredClone(chosen.params),
    });
    state.parent = chosen;
    state.generation += 1;
    state.candidates = childrenFrom(chosen, state.generation);
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetLab() {
    state = defaultState();
    saveState();
    render();
  }

  function undoOne() {
    if (!state.history.length) return;
    state.history.pop();
    const previous = state.history[state.history.length - 1] || null;
    if (!previous) {
      state = defaultState();
    } else {
      state.parent = makeCandidate(structuredClone(previous.params), previous.role, previous.generation, null);
      state.generation = previous.generation + 1;
      state.candidates = childrenFrom(state.parent, state.generation);
    }
    saveState();
    render();
  }

  async function copyParentJson() {
    if (!state.parent) return;
    const payload = JSON.stringify({
      version: 1,
      cropRatio: CROP_RATIO,
      params: state.parent.params,
    }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      const btn = $('#copyBtn');
      const before = btn.textContent;
      btn.textContent = 'コピー済み';
      setTimeout(() => { btn.textContent = before; }, 900);
    } catch {
      window.prompt('このJSONをコピーしてください', payload);
    }
  }

  $$('.adopt').forEach(btn => {
    btn.addEventListener('click', () => adopt(Number(btn.closest('.card').dataset.index)));
  });
  $('#showCore').addEventListener('change', render);
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('実験場の勝ち上がり履歴をリセットしますか？')) resetLab();
  });
  $('#undoBtn').addEventListener('click', undoOne);
  $('#copyBtn').addEventListener('click', copyParentJson);

  render();
})();
