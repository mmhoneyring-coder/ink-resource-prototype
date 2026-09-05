from pathlib import Path

# index.html
path = Path('index.html')
src = path.read_text(encoding='utf-8')
old = '''    <header class="hud" aria-label="ゲーム状況">\n'''
new = '''    <div class="turn-overlay" id="turnOverlay" hidden aria-live="polite">\n      <strong id="turnOverlayText"></strong>\n    </div>\n\n    <header class="hud" aria-label="ゲーム状況">\n'''
if src.count(old) != 1:
    raise SystemExit(f'index anchor mismatch: {src.count(old)}')
src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')

# app.css
path = Path('app.css')
src = path.read_text(encoding='utf-8')
anchor = '''.start-screen[hidden] { display: none; }\n'''
insert = '''.start-screen[hidden] { display: none; }\n.turn-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 20;\n  display: grid;\n  place-items: center;\n  background: rgba(31, 37, 35, .18);\n  backdrop-filter: blur(1px);\n  -webkit-backdrop-filter: blur(1px);\n  opacity: 1;\n  transition: opacity .18s ease;\n}\n.turn-overlay[hidden] { display: none; }\n.turn-overlay.leaving { opacity: 0; }\n.turn-overlay strong {\n  min-width: min(250px, 72vw);\n  padding: 17px 24px;\n  border: 1px solid rgba(47,43,35,.14);\n  border-radius: 16px;\n  background: rgba(255,252,243,.94);\n  color: #2d2b27;\n  box-shadow: 0 12px 36px rgba(0,0,0,.16);\n  text-align: center;\n  font-size: clamp(25px, 8vw, 38px);\n  line-height: 1.05;\n  font-weight: 900;\n  letter-spacing: .015em;\n  font-variant-numeric: tabular-nums;\n}\n'''
if src.count(anchor) != 1:
    raise SystemExit(f'css anchor mismatch: {src.count(anchor)}')
src = src.replace(anchor, insert, 1)
path.write_text(src, encoding='utf-8')

# app.js
path = Path('app.js')
src = path.read_text(encoding='utf-8')

repls = [
(
'''  const highScoreList = document.getElementById('highScoreList');\n  const HIGH_SCORE_KEY = 'inkResource.bestRuns.v1';\n''',
'''  const highScoreList = document.getElementById('highScoreList');\n  const turnOverlay = document.getElementById('turnOverlay');\n  const turnOverlayText = document.getElementById('turnOverlayText');\n  const HIGH_SCORE_KEY = 'inkResource.bestRuns.v1';\n'''
),
(
'''  let actionsMoved = false;\n\n  const pointers = new Map();\n''',
'''  let actionsMoved = false;\n  let turnOverlayTimer = null;\n  let turnOverlayToken = 0;\n\n  const pointers = new Map();\n'''
),
(
'''  function mulberry32(a) {\n''',
'''  function hideTurnOverlay() {\n    turnOverlayToken += 1;\n    if (turnOverlayTimer) clearTimeout(turnOverlayTimer);\n    turnOverlayTimer = null;\n    turnOverlay.classList.remove('leaving');\n    turnOverlay.hidden = true;\n  }\n\n  function showTurnOverlay(text, duration = 680, onDone = null) {\n    const token = ++turnOverlayToken;\n    if (turnOverlayTimer) clearTimeout(turnOverlayTimer);\n    turnOverlayTimer = null;\n    turnOverlayText.textContent = text;\n    turnOverlay.classList.remove('leaving');\n    turnOverlay.hidden = false;\n\n    turnOverlayTimer = setTimeout(() => {\n      if (token !== turnOverlayToken) return;\n      turnOverlay.classList.add('leaving');\n      turnOverlayTimer = setTimeout(() => {\n        if (token !== turnOverlayToken) return;\n        turnOverlay.hidden = true;\n        turnOverlay.classList.remove('leaving');\n        turnOverlayTimer = null;\n        if (onDone) onDone();\n      }, 190);\n    }, duration);\n  }\n\n  function showRoundIntro() {\n    const remaining = CONFIG.rounds - round + 1;\n    showTurnOverlay(`残り ${remaining}巡`, 760, () => {\n      showTurnOverlay('スプラッシュ', 620);\n    });\n  }\n\n  function showMarkerIntro() {\n    showTurnOverlay('マーカー', 620);\n  }\n\n  function mulberry32(a) {\n'''
),
(
'''    updateHud();\n    updateActionAvailability();\n    render();\n  }\n\n  function placeResource(list, band, value, size, id, isTreasure = false) {\n''',
'''    updateHud();\n    updateActionAvailability();\n    render();\n    showMarkerIntro();\n  }\n\n  function placeResource(list, band, value, size, id, isTreasure = false) {\n'''
),
(
'''    updateHud();\n    updateActionAvailability();\n    render();\n  }\n\n  function showResult() {\n''',
'''    updateHud();\n    updateActionAvailability();\n    render();\n    showRoundIntro();\n  }\n\n  function showResult() {\n'''
),
(
'''    result.hidden = true;\n    distributionPanel.hidden = true;\n\n    createStarterPuddle();\n''',
'''    result.hidden = true;\n    distributionPanel.hidden = true;\n    hideTurnOverlay();\n\n    createStarterPuddle();\n'''
),
(
'''  startBtn.addEventListener('click', () => {\n    startScreen.hidden = true;\n    requestAnimationFrame(() => {\n      resizeCanvas();\n      render();\n    });\n  });\n  newBtn.addEventListener('click', () => reset(false));\n  retryBtn.addEventListener('click', () => reset(true));\n  nextBtn.addEventListener('click', () => reset(false));\n''',
'''  startBtn.addEventListener('click', () => {\n    startScreen.hidden = true;\n    requestAnimationFrame(() => {\n      resizeCanvas();\n      render();\n      showRoundIntro();\n    });\n  });\n  newBtn.addEventListener('click', () => { reset(false); showRoundIntro(); });\n  retryBtn.addEventListener('click', () => { reset(true); showRoundIntro(); });\n  nextBtn.addEventListener('click', () => { reset(false); showRoundIntro(); });\n'''
),
]

for old, new in repls:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'js replacement mismatch {count}: {old[:120]!r}')
    src = src.replace(old, new, 1)

path.write_text(src, encoding='utf-8')
