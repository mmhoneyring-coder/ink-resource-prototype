from pathlib import Path

js_path = Path('app.js')
css_path = Path('app.css')
js = js_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

# DOM refs
old = "  const boardWrap = document.getElementById('boardWrap');\n  const scoreBoardEl = document.getElementById('scoreBoard');"
new = "  const boardWrap = document.getElementById('boardWrap');\n  const appShell = document.querySelector('.app-shell');\n  const actionsEl = document.querySelector('.actions');\n  const scoreBoardEl = document.getElementById('scoreBoard');"
if old not in js and "const actionsEl = document.querySelector('.actions')" not in js:
    raise SystemExit('DOM ref insertion point not found')
js = js.replace(old, new, 1)

# Drag state
old = "  let splashShapes = [];\n  let splashVisualInk = new Set();\n\n  const pointers = new Map();"
new = "  let splashShapes = [];\n  let splashVisualInk = new Set();\n  let actionDrag = null;\n  let actionsMoved = false;\n\n  const pointers = new Map();"
if old not in js and 'let actionDrag = null;' not in js:
    raise SystemExit('drag state insertion point not found')
js = js.replace(old, new, 1)

# Toolbar positioning functions before resizeCanvas
marker = "  function resizeCanvas() {"
insert = r'''  function actionToolbarBounds() {
    const shellRect = appShell.getBoundingClientRect();
    const boardRect = boardWrap.getBoundingClientRect();
    const toolRect = actionsEl.getBoundingClientRect();
    const margin = 4;
    const minLeft = boardRect.left - shellRect.left + margin;
    const minTop = boardRect.top - shellRect.top + margin;
    const maxLeft = Math.max(minLeft, boardRect.right - shellRect.left - toolRect.width - margin);
    const maxTop = Math.max(minTop, boardRect.bottom - shellRect.top - toolRect.height - margin);
    return { minLeft, minTop, maxLeft, maxTop };
  }

  function positionActionToolbar(left, top) {
    const bounds = actionToolbarBounds();
    actionsEl.style.left = `${clamp(left, bounds.minLeft, bounds.maxLeft)}px`;
    actionsEl.style.top = `${clamp(top, bounds.minTop, bounds.maxTop)}px`;
    actionsEl.style.right = 'auto';
    actionsEl.style.bottom = 'auto';
    actionsMoved = true;
  }

  function keepActionToolbarInBounds() {
    if (!actionsMoved) return;
    const shellRect = appShell.getBoundingClientRect();
    const rect = actionsEl.getBoundingClientRect();
    positionActionToolbar(rect.left - shellRect.left, rect.top - shellRect.top);
  }

'''
if marker not in js:
    raise SystemExit('resizeCanvas marker not found')
if 'function actionToolbarBounds()' not in js:
    js = js.replace(marker, insert + marker, 1)

# Toolbar pointer handlers before canvas pointerdown
marker = "  canvas.addEventListener('pointerdown', event => {"
handlers = r'''  actionsEl.addEventListener('pointerdown', event => {
    // Pen buttons keep their normal tap behavior. Everything else on the toolbar is a drag handle.
    if (event.target.closest('.action')) return;
    if (gameOver || phase !== 'brush') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const rect = actionsEl.getBoundingClientRect();
    const shellRect = appShell.getBoundingClientRect();
    actionDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    // Convert the initial bottom-anchored position to explicit left/top without a visual jump.
    actionsEl.style.left = `${rect.left - shellRect.left}px`;
    actionsEl.style.top = `${rect.top - shellRect.top}px`;
    actionsEl.style.right = 'auto';
    actionsEl.style.bottom = 'auto';
    actionsEl.classList.add('dragging');
    actionsEl.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  actionsEl.addEventListener('pointermove', event => {
    if (!actionDrag || actionDrag.pointerId !== event.pointerId) return;
    const shellRect = appShell.getBoundingClientRect();
    positionActionToolbar(
      event.clientX - shellRect.left - actionDrag.offsetX,
      event.clientY - shellRect.top - actionDrag.offsetY
    );
    event.preventDefault();
  });

  function endActionToolbarDrag(event) {
    if (!actionDrag || actionDrag.pointerId !== event.pointerId) return;
    actionDrag = null;
    actionsEl.classList.remove('dragging');
    try {
      if (actionsEl.hasPointerCapture?.(event.pointerId)) actionsEl.releasePointerCapture(event.pointerId);
    } catch (_) {}
  }

  actionsEl.addEventListener('pointerup', endActionToolbarDrag);
  actionsEl.addEventListener('pointercancel', endActionToolbarDrag);
  actionsEl.addEventListener('lostpointercapture', event => {
    if (actionDrag && actionDrag.pointerId === event.pointerId) {
      actionDrag = null;
      actionsEl.classList.remove('dragging');
    }
  });

'''
if marker not in js:
    raise SystemExit('canvas pointerdown marker not found')
if "actionsEl.addEventListener('pointerdown'" not in js:
    js = js.replace(marker, handlers + marker, 1)

# Resize keeps a moved toolbar visible.
old = "  window.addEventListener('resize', resizeCanvas);"
new = "  window.addEventListener('resize', () => {\n    resizeCanvas();\n    if (actionsMoved) requestAnimationFrame(keepActionToolbarInBounds);\n  });"
if old not in js and "requestAnimationFrame(keepActionToolbarInBounds)" not in js:
    raise SystemExit('resize listener not found')
js = js.replace(old, new, 1)

# CSS: preserve current width while allowing left/top dragging.
css = css.replace(
"  left: 6px;\n  right: 50px;\n  bottom: max(6px, env(safe-area-inset-bottom));",
"  left: 6px;\n  right: auto;\n  width: calc(100% - 56px);\n  bottom: max(6px, env(safe-area-inset-bottom));",
1)
css = css.replace(
"  -webkit-backdrop-filter: blur(5px);\n}",
"  -webkit-backdrop-filter: blur(5px);\n  touch-action: none;\n  user-select: none;\n  -webkit-user-select: none;\n  cursor: grab;\n}\n.actions.dragging {\n  cursor: grabbing;\n}\n.actions .action {\n  touch-action: manipulation;\n}",
1)
css = css.replace(
"    left: 4px;\n    right: 46px;\n    grid-template-columns: 1fr 1fr 86px;",
"    left: 4px;\n    right: auto;\n    width: calc(100% - 50px);\n    grid-template-columns: 1fr 1fr 86px;",
1)

js_path.write_text(js, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
