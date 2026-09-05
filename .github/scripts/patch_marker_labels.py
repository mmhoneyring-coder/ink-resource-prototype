from pathlib import Path

# User-facing terminology only. Internal brush variable/function names stay unchanged.
path = Path('index.html')
src = path.read_text(encoding='utf-8')
repls = [
    ('<li><strong>筆でつなぐ</strong><span>細筆・太筆を使い、限られたインクで島をつなぐ</span></li>',
     '<li><strong>マーカーでつなぐ</strong><span>細ペン・太ペンを使い、限られたインクで島をつなぐ</span></li>'),
    ('<li><strong>4ラウンド</strong><span>スプラッシュ→筆を4回繰り返し、合計得点を競う</span></li>',
     '<li><strong>4ラウンド</strong><span>スプラッシュ→マーカーを4回繰り返し、合計得点を競う</span></li>'),
    ('<span>筆</span>', '<span>マーカー</span>'),
    ('<nav class="actions" aria-label="筆操作">', '<nav class="actions" aria-label="マーカー操作">'),
    ('<button id="brushBtn" class="action" type="button" aria-label="細筆">', '<button id="brushBtn" class="action" type="button" aria-label="細ペン">'),
    ('<span>細筆</span>', '<span>細ペン</span>'),
    ('<button id="moveBtn" class="action" type="button" aria-label="太筆">', '<button id="moveBtn" class="action" type="button" aria-label="太ペン">'),
    ('<span>太筆</span>', '<span>太ペン</span>'),
    ('aria-label="筆インク残量"', 'aria-label="マーカーインク残量"'),
]
for old, new in repls:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'index replacement mismatch {count}: {old!r}')
    src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')

path = Path('app.js')
src = path.read_text(encoding='utf-8')
old = "      const penLabel = penSize === 'thin' ? '細筆' : '太筆';"
new = "      const penLabel = penSize === 'thin' ? '細ペン' : '太ペン';"
if src.count(old) != 1:
    raise SystemExit(f'app.js replacement mismatch: {src.count(old)}')
src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')
