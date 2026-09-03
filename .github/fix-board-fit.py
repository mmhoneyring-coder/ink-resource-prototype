from pathlib import Path
import re

path = Path('app.js')
s = path.read_text()

def replace_once(pattern, replacement, label):
    global s
    s2, count = re.subn(pattern, replacement, s, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, got {count}')
    s = s2

replace_once(
    r"  function resizeCanvas\(\) \{.*?\n  \}\n\n  function boardMetrics\(\)",
    """  function resizeCanvas() {
    const rect = boardWrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);

    // A viewport/layout change must not leave the baseline view cropped.
    if (gesture && pointers.size >= 2) {
      clampCamera();
    } else {
      camera.zoom = CONFIG.zoom.default;
      centerCamera();
      updateZoomLabel();
    }
    render();
  }

  function boardMetrics()""",
    'resizeCanvas'
)

replace_once(
    r"  function resetCamera\(\) \{.*?\n  \}\n\n  function pointerToCell\(event\)",
    """  function fitCamera(renderNow = true) {
    camera.zoom = CONFIG.zoom.default;
    centerCamera();
    updateZoomLabel();
    if (renderNow) render();
  }

  function resetCamera() {
    fitCamera(true);
  }

  function pointerToCell(event)""",
    'resetCamera'
)

replace_once(
    r"(\n    phase = 'brush';\n    brushRemaining = CONFIG\.brushAreaPerTurn;\n)(    updateHud\(\);)",
    r"\1    fitCamera(false);\n\2",
    'splash-to-brush fit'
)

replace_once(
    r"(\n    round\+\+;\n    phase = 'splash';\n    brushRemaining = CONFIG\.brushAreaPerTurn;\n)(    updateHud\(\);)",
    r"\1    fitCamera(false);\n\2",
    'brush-to-splash fit'
)

replace_once(
    r"(      const zoom = clamp\(gesture\.zoom \* distance / gesture\.distance, CONFIG\.zoom\.min, CONFIG\.zoom\.max\);\n)      camera\.zoom = zoom;\n      camera\.tx = mx - gesture\.wx \* zoom;\n      camera\.ty = my - gesture\.wy \* zoom;\n      clampCamera\(\);\n(      updateZoomLabel\(\);\n      render\(\);)",
    r"\1      camera.zoom = zoom;\n      if (zoom <= CONFIG.zoom.min + .002) {\n        camera.zoom = CONFIG.zoom.min;\n        centerCamera();\n      } else {\n        camera.tx = mx - gesture.wx * zoom;\n        camera.ty = my - gesture.wy * zoom;\n        clampCamera();\n      }\n\2",
    'pinch recovery'
)

replace_once(
    r"(    if \(shouldFinishStroke && !gesture\) finishStroke\(\);\n)    if \(pointers\.size < 2\) gesture = null;",
    r"\1    if (pointers.size < 2) {\n      gesture = null;\n      if (camera.zoom <= CONFIG.zoom.min + .002) fitCamera(false);\n    }",
    'pinch end recovery'
)

path.write_text(s)
