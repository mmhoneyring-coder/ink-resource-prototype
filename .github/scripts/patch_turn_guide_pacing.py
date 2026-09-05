from pathlib import Path

# CSS: remove the card/frame around the guide text and slow the fade.
path = Path('app.css')
src = path.read_text(encoding='utf-8')
old = '''  opacity: 1;\n  transition: opacity .18s ease;\n}\n.turn-overlay[hidden] { display: none; }\n.turn-overlay.leaving { opacity: 0; }\n.turn-overlay strong {\n  min-width: min(250px, 72vw);\n  padding: 17px 24px;\n  border: 1px solid rgba(47,43,35,.14);\n  border-radius: 16px;\n  background: rgba(255,252,243,.94);\n  color: #2d2b27;\n  box-shadow: 0 12px 36px rgba(0,0,0,.16);\n  text-align: center;\n  font-size: clamp(25px, 8vw, 38px);\n  line-height: 1.05;\n  font-weight: 900;\n  letter-spacing: .015em;\n  font-variant-numeric: tabular-nums;\n}\n'''
new = '''  opacity: 1;\n  transition: opacity .42s ease;\n}\n.turn-overlay[hidden] { display: none; }\n.turn-overlay.leaving { opacity: 0; }\n.turn-overlay strong {\n  color: #2d2b27;\n  text-align: center;\n  font-size: clamp(28px, 8.5vw, 40px);\n  line-height: 1.05;\n  font-weight: 900;\n  letter-spacing: .015em;\n  font-variant-numeric: tabular-nums;\n  text-shadow: 0 1px 0 rgba(255,255,255,.72), 0 3px 12px rgba(0,0,0,.14);\n}\n'''
if src.count(old) != 1:
    raise SystemExit(f'css replacement mismatch: {src.count(old)}')
src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')

# JS: keep each message on screen longer and extend the fade-out.
path = Path('app.js')
src = path.read_text(encoding='utf-8')
repls = [
    ("  function showTurnOverlay(text, duration = 680, onDone = null) {", "  function showTurnOverlay(text, duration = 1000, onDone = null) {"),
    ("      }, 190);", "      }, 420);"),
    ("    showTurnOverlay(`残り ${remaining}巡`, 760, () => {\n      showTurnOverlay('スプラッシュ', 620);", "    showTurnOverlay(`残り ${remaining}巡`, 1250, () => {\n      showTurnOverlay('スプラッシュ', 1000);"),
    ("    showTurnOverlay('マーカー', 620);", "    showTurnOverlay('マーカー', 1000);")
]
for old, new in repls:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'js replacement mismatch {count}: {old!r}')
    src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')
