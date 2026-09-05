from pathlib import Path

path = Path('app.css')
src = path.read_text(encoding='utf-8')
old = '''.score-token.known::before,\n.score-token.owned::before { opacity: 1; }\n.score-token.owned { color: var(--score-gold); }\n'''
new = '''.score-token.known {\n  color: var(--accent);\n  font-size: 10.5px;\n  font-weight: 900;\n  text-shadow: 0 1px 0 rgba(255,255,255,.88);\n}\n.score-token.known::before {\n  width: 40px;\n  height: 22px;\n  opacity: 1;\n  filter: blur(1.3px);\n  background: radial-gradient(ellipse at center,\n    rgba(255,255,255,1) 0%,\n    rgba(255,255,255,.78) 46%,\n    rgba(255,255,255,.28) 72%,\n    rgba(255,255,255,0) 100%);\n}\n.score-token.owned::before { opacity: 1; }\n.score-token.owned { color: var(--score-gold); }\n'''
if src.count(old) != 1:
    raise SystemExit(f'css replacement mismatch: {src.count(old)}')
src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')
