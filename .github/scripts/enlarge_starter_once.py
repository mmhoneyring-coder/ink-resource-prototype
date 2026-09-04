from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')
old = "starterPuddle: { radius: 30 },"
new = "starterPuddle: { radius: 35 },"
if old not in text:
    raise SystemExit('starter radius target not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
