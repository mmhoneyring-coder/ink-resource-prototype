from pathlib import Path

# app.js
path = Path('app.js')
src = path.read_text(encoding='utf-8')
old = "  const BAND_NAMES = ['upper', 'middle', 'lower'];\n  const BAND_LABELS = ['上層', '中層', '下層'];\n"
new = "  const BAND_NAMES = ['upper', 'middle', 'lower'];\n  const BAND_LABELS = ['上層', '中層', '下層'];\n  const BAND_BASELINES = [225, 130, 65];\n"
if src.count(old) != 1:
    raise SystemExit(f'band constants anchor mismatch: {src.count(old)}')
src = src.replace(old, new, 1)

old = '''      return `<div class="score-board-row">\n        <span class="score-board-label">${BAND_LABELS[band]}</span>\n        <div class="score-board-values">${items}</div>\n      </div>`;\n'''
new = '''      return `<div class="score-board-row">\n        <div class="score-board-baseline" aria-label="${BAND_LABELS[band]}の基準点 ${BAND_BASELINES[band]}点">\n          <span>基準</span>\n          <strong>${BAND_BASELINES[band]}</strong>\n        </div>\n        <span class="score-board-label">${BAND_LABELS[band]}</span>\n        <div class="score-board-values">${items}</div>\n      </div>`;\n'''
if src.count(old) != 1:
    raise SystemExit(f'renderScoreBoard anchor mismatch: {src.count(old)}')
src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')

# app.css
path = Path('app.css')
src = path.read_text(encoding='utf-8')
old = '''.score-board-row {\n  min-height: 0;\n  display: grid;\n  grid-template-rows: minmax(0, 1fr);\n  padding: 2px 2px;\n  border-bottom: 1px dashed rgba(78,68,51,.20);\n}\n'''
new = '''.score-board-row {\n  min-height: 0;\n  display: grid;\n  grid-template-rows: auto minmax(0, 1fr);\n  padding: 0 2px 2px;\n  border-bottom: 1px dashed rgba(78,68,51,.20);\n}\n.score-board-baseline {\n  min-height: 24px;\n  margin: 0 -2px 1px;\n  padding: 3px 0 4px;\n  display: grid;\n  place-items: center;\n  align-content: center;\n  gap: 1px;\n  border-bottom: 1px solid rgba(78,68,51,.18);\n  background: rgba(91,82,68,.07);\n  color: #766f64;\n  line-height: 1;\n  font-variant-numeric: tabular-nums;\n}\n.score-board-baseline span {\n  font-size: 6px;\n  font-weight: 750;\n  letter-spacing: .08em;\n}\n.score-board-baseline strong {\n  color: #625c52;\n  font-size: 8.5px;\n  font-weight: 850;\n}\n'''
if src.count(old) != 1:
    raise SystemExit(f'css row anchor mismatch: {src.count(old)}')
src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')
