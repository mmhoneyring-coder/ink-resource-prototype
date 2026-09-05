from pathlib import Path

path = Path('app.css')
src = path.read_text(encoding='utf-8')
old = "  bottom: max(6px, env(safe-area-inset-bottom));\n"
new = "  bottom: calc(23% + max(6px, env(safe-area-inset-bottom)));\n"
count = src.count(old)
if count != 1:
    raise SystemExit(f'bottom anchor mismatch: {count}')
src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')
