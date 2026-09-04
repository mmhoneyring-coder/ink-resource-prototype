from pathlib import Path

p = Path('starter-wrap-lab.js')
s = p.read_text(encoding='utf-8')

start = s.index('  function buildShape(slot, size = FULL_SIZE) {')
end = s.index('\n  function bounds(points) {', start)
new_build = r'''  function buildShape(slot, size = FULL_SIZE) {
    const wrap = clamp(Number(slot.wrap) || 0, 0, 100) / 100;
    const profile = PROFILE_MAP.get(slot.profileId);
    const raw = profile && Array.isArray(profile.values) && profile.values.length >= 4
      ? profile.values.map(Number)
      : [0, .5, 1, .5, 0];

    const minV = Math.min(...raw);
    const maxV = Math.max(...raw);
    const span = Math.max(.0001, maxV - minV);
    const normalized = raw.map(v => (v - minV) / span);
    const smoothProfile = smoothCircular(normalized, 2);
    const mean = smoothProfile.reduce((a, b) => a + b, 0) / smoothProfile.length;

    // 巻き具合は、平面寄りの丸角形 → 円形へ連続的に変える。
    // 元の平面輪郭そのものは半径方向の起伏として保持する。
    const exponent = lerp(4.8, 2.0, wrap);
    const yScale = lerp(.66, 1.0, wrap);
    const coreR = size * .225;
    const coverage = size * .072;
    const reliefAmp = size * .115;
    const cx = size * .5;
    const cy = size * .515;
    const points = [];

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = i / SAMPLE_COUNT;
      // 平面型の端同士が上端で直結しないよう、継ぎ目は側面へ逃がす。
      const sourceT = (t + .19) % 1;
      const profileValue = sample(smoothProfile, sourceT);
      const relief = Math.max(size * .035, coverage + reliefAmp * (profileValue - mean));

      const theta = t * Math.PI * 2 - Math.PI / 2;
      const base = superellipse(theta, exponent);
      const len = Math.hypot(base.x, base.y) || 1;
      const ux = base.x / len;
      const uy = base.y / len;

      const x = cx + base.x * coreR + ux * relief;
      const y = cy + (base.y * coreR + uy * relief) * yScale;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`invalid point: ${slot.profileId}`);
      }
      points.push({ x, y });
    }

    return { points, core: { cx, cy, r: coreR, yScale } };
  }
'''
s = s[:start] + new_build + s[end:]

start = s.index('  function path(ctx, points) {')
end = s.index('\n  function clear(canvas) {', start)
new_path = r'''  function path(ctx, points) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    // 240点の折れ線なら画面上では十分滑らかで、Safariでも安定する。
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
  }
'''
s = s[:start] + new_path + s[end:]

# core display: circle -> ellipse matching current wrap flattening
s = s.replace(
"      ctx.arc(shape.core.cx, shape.core.cy, shape.core.r, 0, Math.PI * 2);",
"      ctx.ellipse(shape.core.cx, shape.core.cy, shape.core.r, shape.core.r * shape.core.yScale, 0, 0, Math.PI * 2);"
)

# Make render failures visible instead of silently leaving a blank canvas.
s = s.replace(
"      drawFull(full, slot, showCore);\n      drawPreview(preview, slot);",
"      try {\n        drawFull(full, slot, showCore);\n        drawPreview(preview, slot);\n      } catch (err) {\n        const ctx = full.getContext('2d');\n        ctx.fillStyle = '#8b2f2f';\n        ctx.font = '16px sans-serif';\n        ctx.fillText('描画エラー', 20, 40);\n        console.error(err);\n      }"
)

p.write_text(s, encoding='utf-8')
