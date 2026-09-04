(() => {
  'use strict';

  const PROFILES = window.STARTER_WRAP_PROFILES || [];
  const PROFILE_MAP = new Map(PROFILES.map(p => [p.id, p]));
  const STORAGE_KEY = 'inkStarterWrapLabV3';
  const SAMPLE_COUNT = 240;
  const FULL_SIZE = 520;
  const CROP_RATIO = 0.30;
  const DEFAULT_WRAP = 72;
  const $ = s => document.querySelector(s);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function smoothCircular(values, passes) {
    let src = values.slice();
    for (let pass = 0; pass < passes; pass++) {
      const dst = new Array(src.length);
      for (let i = 0; i < src.length; i++) {
        const n = src.length;
        dst[i] =
          src[(i - 2 + n) % n] * .06 +
          src[(i - 1 + n) % n] * .24 +
          src[i] * .40 +
          src[(i + 1) % n] * .24 +
          src[(i + 2) % n] * .06;
      }
      src = dst;
    }
    return src;
  }

  const prepared = new Map(PROFILES.map(profile => {
    const raw = profile.values.slice();
    const broad = smoothCircular(raw, 7);
    const mean = broad.reduce((a, b) => a + b, 0) / broad.length;
    return {
      broad: broad.map(v => v - mean),
      detail: raw.map((v, i) => v - broad[i]),
    };
  }));

  function sample(values, t) {
    const n = values.length;
    const x = ((((t % 1) + 1) % 1) * n);
    const i = Math.floor(x) % n;
    const f = x - Math.floor(x);
    return lerp(values[i], values[(i + 1) % n], f);
  }

  function superellipse(theta, exponent) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const p = 2 / exponent;
    return {
      x: Math.sign(c) * Math.pow(Math.abs(c), p),
      y: Math.sign(s) * Math.pow(Math.abs(s), p),
    };
  }

  function buildShape(slot, size = FULL_SIZE) {
    const wrap = clamp(slot.wrap, 0, 100) / 100;
    const exponent = lerp(3.8, 2.0, wrap);
    const coreR = size * lerp(.215, .240, wrap);
    const coverage = size * .055;
    const source = prepared.get(slot.profileId);
    const reliefs = new Array(SAMPLE_COUNT);

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = i / SAMPLE_COUNT;
      const broad = sample(source.broad, t);
      const detail = sample(source.detail, t);
      reliefs[i] = Math.max(
        size * .025,
        coverage + size * (.075 * broad + .45 * detail)
      );
    }

    const smoothReliefs = smoothCircular(reliefs, 5);
    const cx = size * .5;
    const cy = size * .505;
    const points = [];

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const theta = i / SAMPLE_COUNT * Math.PI * 2 - Math.PI / 2;
      const base = superellipse(theta, exponent);
      const len = Math.hypot(base.x, base.y) || 1;
      const relief = Math.max(size * .025, smoothReliefs[i]);
      points.push({
        x: cx + base.x * coreR + base.x / len * relief,
        y: cy + base.y * coreR + base.y / len * relief,
      });
    }
    return { points, core: { cx, cy, r: coreR } };
  }

  function bounds(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function path(ctx, points) {
    const n = points.length;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6,
        p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6,
        p2.y - (p3.y - p1.y) / 6,
        p2.x, p2.y
      );
    }
    ctx.closePath();
  }

  function clear(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  }

  function drawFull(canvas, slot, showCore) {
    const ctx = clear(canvas);
    const shape = buildShape(slot, canvas.width);
    const b = bounds(shape.points);
    const cropY = b.minY + b.height * CROP_RATIO;

    ctx.fillStyle = '#202327';
    path(ctx, shape.points);
    ctx.fill();

    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(96,119,124,.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.max(8, b.minX - 10), cropY);
    ctx.lineTo(Math.min(canvas.width - 8, b.maxX + 10), cropY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (showCore) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(204,81,64,.9)';
      ctx.beginPath();
      ctx.arc(shape.core.cx, shape.core.cy, shape.core.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawPreview(canvas, slot) {
    const ctx = clear(canvas);
    const shape = buildShape(slot);
    const b = bounds(shape.points);
    const cropH = Math.max(1, b.height * CROP_RATIO);
    const scale = Math.min(
      (canvas.width - 32) / b.width,
      (canvas.height - 20) / cropH
    );
    const midX = (b.minX + b.maxX) * .5;
    const pts = shape.points.map(p => ({
      x: canvas.width * .5 + (p.x - midX) * scale,
      y: 10 + (p.y - b.minY) * scale,
    }));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();
    ctx.fillStyle = '#202327';
    path(ctx, pts);
    ctx.fill();
    ctx.restore();
  }

  function initialState() {
    return {
      version: 3,
      cursor: 3,
      slots: [0, 1, 2].map(i => ({
        profileId: PROFILES[i].id,
        wrap: DEFAULT_WRAP,
        fixed: false,
      })),
      used: PROFILES.slice(0, 3).map(p => p.id),
      history: [],
    };
  }

  function loadState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (
        state?.version === 3 &&
        Array.isArray(state.slots) &&
        state.slots.length === 3 &&
        state.slots.every(s => PROFILE_MAP.has(s.profileId))
      ) return state;
    } catch {}
    return initialState();
  }

  let state = loadState();
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  function nextProfile(excluded) {
    const block = new Set(excluded);
    for (let i = 0; i < PROFILES.length; i++) {
      const idx = (state.cursor + i) % PROFILES.length;
      const p = PROFILES[idx];
      if (!block.has(p.id) && !state.used.includes(p.id)) {
        state.cursor = (idx + 1) % PROFILES.length;
        state.used.push(p.id);
        return p;
      }
    }
    for (let i = 0; i < PROFILES.length; i++) {
      const idx = (state.cursor + i) % PROFILES.length;
      const p = PROFILES[idx];
      if (!block.has(p.id)) {
        state.cursor = (idx + 1) % PROFILES.length;
        return p;
      }
    }
    return PROFILES[0];
  }

  function replaceSlot(index) {
    const slot = state.slots[index];
    if (slot.fixed) return;
    const old = PROFILE_MAP.get(slot.profileId);
    const next = nextProfile(state.slots.map(s => s.profileId));
    slot.profileId = next.id;
    state.history.unshift(
      `${String.fromCharCode(65 + index)}: ${old.label} → ${next.label}`
    );
    state.history = state.history.slice(0, 24);
    save();
    render();
  }

  function replaceUnlocked() {
    const occupied = new Set(state.slots.filter(s => s.fixed).map(s => s.profileId));
    state.slots.forEach((slot, index) => {
      if (slot.fixed) return;
      const old = PROFILE_MAP.get(slot.profileId);
      const next = nextProfile([...occupied]);
      slot.profileId = next.id;
      occupied.add(next.id);
      state.history.unshift(
        `${String.fromCharCode(65 + index)}: ${old.label} → ${next.label}`
      );
    });
    state.history = state.history.slice(0, 24);
    save();
    render();
  }

  function card(slot, index) {
    const p = PROFILE_MAP.get(slot.profileId);
    const letter = String.fromCharCode(65 + index);
    return `
      <article class="card ${slot.fixed ? 'is-fixed' : ''}" data-index="${index}">
        <div class="card-head">
          <h2 class="card-title">${letter} · ${p.label}${slot.fixed ? ' · 固定' : ''}</h2>
          <span class="meta">${p.id}</span>
        </div>
        <div class="full-wrap">
          <canvas class="full-canvas" width="520" height="520"></canvas>
          <span class="preview-label">島全体 / 線より上が30%</span>
        </div>
        <div class="preview-wrap">
          <canvas class="preview-canvas" width="520" height="170"></canvas>
          <span class="preview-label">START表示</span>
        </div>
        <div class="controls">
          <label class="wrap-row">
            <span>巻き具合</span>
            <input class="wrap-slider" type="range" min="0" max="100" value="${slot.wrap}">
            <span class="wrap-value">${slot.wrap}%</span>
          </label>
          <div class="slot-actions">
            <button class="fix-btn ${slot.fixed ? 'fixed-on' : ''}">${slot.fixed ? '固定解除' : 'この形を固定'}</button>
            <button class="replace-btn" ${slot.fixed ? 'disabled' : ''}>別の過去形状に交換</button>
          </div>
        </div>
      </article>`;
  }

  function render() {
    const root = $('#candidates');
    root.innerHTML = state.slots.map(card).join('');
    const showCore = $('#showCore').checked;

    root.querySelectorAll('.card').forEach(el => {
      const index = Number(el.dataset.index);
      const slot = state.slots[index];
      const full = el.querySelector('.full-canvas');
      const preview = el.querySelector('.preview-canvas');
      drawFull(full, slot, showCore);
      drawPreview(preview, slot);

      const slider = el.querySelector('.wrap-slider');
      const value = el.querySelector('.wrap-value');
      slider.addEventListener('input', () => {
        slot.wrap = Number(slider.value);
        value.textContent = `${slot.wrap}%`;
        drawFull(full, slot, $('#showCore').checked);
        drawPreview(preview, slot);
        save();
      });
      el.querySelector('.fix-btn').addEventListener('click', () => {
        slot.fixed = !slot.fixed;
        save();
        render();
      });
      el.querySelector('.replace-btn').addEventListener('click', () => replaceSlot(index));
    });

    $('#statusText').textContent =
      `固定 ${state.slots.filter(s => s.fixed).length}/3 · 使用済み ${state.used.length}/${PROFILES.length}`;

    $('#historyList').innerHTML = state.history.length
      ? state.history.map(v => `<span class="history-chip">${v}</span>`).join('')
      : '<span class="history-chip">まだ交換していません</span>';
  }

  $('#showCore').addEventListener('change', render);
  $('#replaceUnlockedBtn').addEventListener('click', replaceUnlocked);
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('固定・巻き具合・交換履歴を初期化しますか？')) return;
    state = initialState();
    save();
    render();
  });
  $('#copyBtn').addEventListener('click', async () => {
    const data = state.slots.map((slot, i) => ({
      slot: String.fromCharCode(65 + i),
      profileId: slot.profileId,
      profileLabel: PROFILE_MAP.get(slot.profileId).label,
      wrap: slot.wrap,
      fixed: slot.fixed,
    }));
    const text = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      $('#copyBtn').textContent = 'コピーしました';
      setTimeout(() => $('#copyBtn').textContent = '3枠JSONをコピー', 900);
    } catch {
      window.prompt('コピーしてください', text);
    }
  });

  render();
})();
