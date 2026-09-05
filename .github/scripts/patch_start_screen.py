from pathlib import Path

# index.html
path = Path('index.html')
src = path.read_text(encoding='utf-8')
old = '''  <main class="app-shell">\n    <header class="hud" aria-label="ゲーム状況">\n'''
new = '''  <main class="app-shell">\n    <div class="start-screen" id="startScreen">\n      <div class="start-card">\n        <div class="start-title">\n          <span>INK RESOURCE</span>\n          <strong>インクをつないで、資源を取る</strong>\n        </div>\n\n        <button id="startBtn" class="start-button" type="button">はじめる</button>\n\n        <section class="start-section how-to-play" aria-labelledby="howToPlayTitle">\n          <h2 id="howToPlayTitle">遊び方</h2>\n          <ol>\n            <li><strong>スプラッシュ</strong><span>盤面を1回タップしてインクを飛ばす</span></li>\n            <li><strong>筆でつなぐ</strong><span>細筆・太筆を使い、限られたインクで島をつなぐ</span></li>\n            <li><strong>資源を取る</strong><span>30%塗ると点数判明。70%以上塗って下の起点までつなぐと取得</span></li>\n            <li><strong>4ラウンド</strong><span>スプラッシュ→筆を4回繰り返し、合計得点を競う</span></li>\n          </ol>\n        </section>\n\n        <section class="start-section high-scores" aria-labelledby="highScoreTitle">\n          <div class="start-section-heading">\n            <h2 id="highScoreTitle">ハイスコア</h2>\n            <small>BEST 3</small>\n          </div>\n          <ol id="highScoreList" class="high-score-list"></ol>\n        </section>\n      </div>\n    </div>\n\n    <header class="hud" aria-label="ゲーム状況">\n'''
if src.count(old) != 1:
    raise SystemExit(f'index anchor mismatch: {src.count(old)}')
src = src.replace(old, new, 1)
path.write_text(src, encoding='utf-8')

# app.css
path = Path('app.css')
src = path.read_text(encoding='utf-8')
anchor = '''button { font: inherit; }\n\n.app-shell {\n'''
insert = '''button { font: inherit; }\n\n.start-screen {\n  position: fixed;\n  inset: 0;\n  z-index: 30;\n  display: grid;\n  place-items: center;\n  padding: max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom));\n  overflow: auto;\n  background: linear-gradient(180deg, #f3eddd 0%, #e7dcc4 100%);\n}\n.start-screen[hidden] { display: none; }\n.start-card {\n  width: min(100%, 420px);\n  display: grid;\n  gap: 12px;\n}\n.start-title {\n  display: grid;\n  gap: 5px;\n  padding: 4px 2px 6px;\n}\n.start-title span {\n  color: var(--accent);\n  font-size: 10px;\n  font-weight: 850;\n  letter-spacing: .14em;\n}\n.start-title strong {\n  color: #2d2b27;\n  font-size: clamp(24px, 7vw, 32px);\n  line-height: 1.12;\n  letter-spacing: -.025em;\n}\n.start-button {\n  min-height: 54px;\n  border: 0;\n  border-radius: 14px;\n  background: var(--accent);\n  color: white;\n  font-size: 17px;\n  font-weight: 850;\n  letter-spacing: .04em;\n  box-shadow: 0 7px 20px rgba(49,95,85,.20);\n}\n.start-button:active { transform: translateY(1px); }\n.start-section {\n  padding: 13px 14px;\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  background: rgba(255,252,243,.88);\n  box-shadow: 0 3px 12px rgba(64,52,32,.05);\n}\n.start-section h2 {\n  margin: 0;\n  color: #3b3832;\n  font-size: 13px;\n  line-height: 1.2;\n}\n.start-section-heading {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 8px;\n  margin-bottom: 8px;\n}\n.start-section-heading small {\n  color: var(--muted);\n  font-size: 8px;\n  font-weight: 800;\n  letter-spacing: .08em;\n}\n.how-to-play ol {\n  list-style: none;\n  counter-reset: howto;\n  display: grid;\n  gap: 7px;\n  margin: 10px 0 0;\n  padding: 0;\n}\n.how-to-play li {\n  counter-increment: howto;\n  display: grid;\n  grid-template-columns: 20px 78px minmax(0,1fr);\n  align-items: baseline;\n  gap: 5px;\n  color: #504c45;\n  font-size: 10.5px;\n  line-height: 1.35;\n}\n.how-to-play li::before {\n  content: counter(howto);\n  width: 18px;\n  height: 18px;\n  display: grid;\n  place-items: center;\n  border-radius: 50%;\n  background: #e4eee9;\n  color: var(--accent);\n  font-size: 9px;\n  font-weight: 850;\n}\n.how-to-play li strong { color: #37342f; font-size: 10px; }\n.high-score-list {\n  list-style: none;\n  display: grid;\n  gap: 5px;\n  margin: 0;\n  padding: 0;\n}\n.high-score-row {\n  min-height: 34px;\n  display: grid;\n  grid-template-columns: 24px minmax(0,1fr) auto;\n  align-items: center;\n  gap: 8px;\n  padding: 5px 7px;\n  border-radius: 9px;\n  background: rgba(233,223,200,.56);\n}\n.high-score-rank {\n  color: var(--muted);\n  font-size: 9px;\n  font-weight: 850;\n}\n.high-score-score {\n  color: #2d2b27;\n  font-size: 17px;\n  line-height: 1;\n  font-weight: 900;\n  font-variant-numeric: tabular-nums;\n}\n.high-score-meta {\n  color: var(--muted);\n  font-size: 8px;\n  line-height: 1.25;\n  text-align: right;\n  white-space: nowrap;\n}\n.high-score-empty {\n  padding: 9px 7px 4px;\n  color: var(--muted);\n  font-size: 10px;\n  text-align: center;\n}\n\n.app-shell {\n'''
if src.count(anchor) != 1:
    raise SystemExit(f'css anchor mismatch: {src.count(anchor)}')
src = src.replace(anchor, insert, 1)
path.write_text(src, encoding='utf-8')

# app.js
path = Path('app.js')
src = path.read_text(encoding='utf-8')

replacements = [
    (
'''  const retryBtn = document.getElementById('retryBtn');\n  const nextBtn = document.getElementById('nextBtn');\n\n  let seed = randomSeed();\n''',
'''  const retryBtn = document.getElementById('retryBtn');\n  const nextBtn = document.getElementById('nextBtn');\n  const startScreen = document.getElementById('startScreen');\n  const startBtn = document.getElementById('startBtn');\n  const highScoreList = document.getElementById('highScoreList');\n  const HIGH_SCORE_KEY = 'inkResource.bestRuns.v1';\n  const HIGH_SCORE_LIMIT = 3;\n\n  let seed = randomSeed();\n'''
    ),
    (
'''  function randomSeed() {\n    return (Math.random() * 0xffffffff) >>> 0;\n  }\n\n  function mulberry32(a) {\n''',
'''  function randomSeed() {\n    return (Math.random() * 0xffffffff) >>> 0;\n  }\n\n  function readHighScores() {\n    try {\n      const parsed = JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) || '[]');\n      return Array.isArray(parsed)\n        ? parsed.filter(entry => entry && Number.isFinite(Number(entry.score))).slice(0, HIGH_SCORE_LIMIT)\n        : [];\n    } catch (_) {\n      return [];\n    }\n  }\n\n  function writeHighScores(list) {\n    try {\n      localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(list.slice(0, HIGH_SCORE_LIMIT)));\n      return true;\n    } catch (_) {\n      return false;\n    }\n  }\n\n  function formatHighScoreDate(iso) {\n    const date = new Date(iso);\n    if (Number.isNaN(date.getTime())) return '';\n    return `${date.getMonth() + 1}/${date.getDate()}`;\n  }\n\n  function renderHighScores() {\n    if (!highScoreList) return;\n    const list = readHighScores();\n    if (!list.length) {\n      highScoreList.innerHTML = '<li class="high-score-empty">まだ記録なし</li>';\n      return;\n    }\n    highScoreList.innerHTML = list.map((entry, index) => `\n      <li class="high-score-row">\n        <span class="high-score-rank">${index + 1}</span>\n        <strong class="high-score-score">${Number(entry.score).toLocaleString('ja-JP')}</strong>\n        <span class="high-score-meta">取得 ${Number(entry.owned) || 0}個<br>${formatHighScoreDate(entry.date)}</span>\n      </li>`).join('');\n  }\n\n  function recordHighScore() {\n    const record = {\n      score: Number(score) || 0,\n      owned: resources.filter(resource => resource.owned).length,\n      date: new Date().toISOString(),\n    };\n    const list = readHighScores();\n    list.push(record);\n    list.sort((a, b) =>\n      Number(b.score) - Number(a.score) ||\n      Number(b.owned || 0) - Number(a.owned || 0) ||\n      String(a.date || '').localeCompare(String(b.date || ''))\n    );\n    writeHighScores(list.slice(0, HIGH_SCORE_LIMIT));\n    renderHighScores();\n  }\n\n  function mulberry32(a) {\n'''
    ),
    (
'''  function showResult() {\n    finalScore.textContent = score;\n    finalOwned.textContent = resources.filter(r => r.owned).length;\n    result.hidden = false;\n  }\n''',
'''  function showResult() {\n    finalScore.textContent = score;\n    finalOwned.textContent = resources.filter(r => r.owned).length;\n    recordHighScore();\n    result.hidden = false;\n  }\n'''
    ),
    (
'''  thinBtn.addEventListener('click', () => selectPen('thin'));\n  wideBtn.addEventListener('click', () => selectPen('wide'));\n  newBtn.addEventListener('click', () => reset(false));\n''',
'''  thinBtn.addEventListener('click', () => selectPen('thin'));\n  wideBtn.addEventListener('click', () => selectPen('wide'));\n  startBtn.addEventListener('click', () => {\n    startScreen.hidden = true;\n    requestAnimationFrame(() => {\n      resizeCanvas();\n      render();\n    });\n  });\n  newBtn.addEventListener('click', () => reset(false));\n'''
    ),
    (
'''  requestAnimationFrame(() => {\n    resizeCanvas();\n    reset(true);\n  });\n''',
'''  requestAnimationFrame(() => {\n    renderHighScores();\n    resizeCanvas();\n    reset(true);\n  });\n'''
    ),
]

for old, new in replacements:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'app.js anchor mismatch ({count}): {old[:120]!r}')
    src = src.replace(old, new, 1)

path.write_text(src, encoding='utf-8')
