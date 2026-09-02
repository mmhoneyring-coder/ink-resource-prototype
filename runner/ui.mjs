import { BOARD_PRESETS, compareBoards, runExplorationBatch, simulateExploration } from './sim-core.mjs';

const $ = id => document.getElementById(id);
const controls = ['compareBtn', 'singleBtn', 'sampleBtn'].map($);

function readOptions() {
  return {
    trials: Math.max(1, Number($('trials').value || 300)),
    splashes: Math.max(1, Number($('splashes').value || 8)),
    seed: Number($('seed').value || 12345) >>> 0,
    strategy: $('strategy').value,
    cols: Math.max(40, Number($('cols').value || 180)),
    rows: Math.max(60, Number($('rows').value || 280)),
    resources: {
      count: Math.max(1, Number($('resourceCount').value || 30)),
      baseRadius: Math.max(.5, Number($('resourceRadius').value || 3)),
      countMode: $('resourceCountMode').value,
      scaleMode: $('resourceScaleMode').value,
    },
  };
}

function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

function renderResults(rows) {
  $('results').innerHTML = rows.map(r => `
    <tr>
      <td>${r.cols}×${r.rows}</td>
      <td>${r.resourceCount}</td>
      <td>${r.resourceScale.toFixed(2)}×</td>
      <td>${r.meanResourceRadius.toFixed(1)}</td>
      <td>${pct(r.meanCoverage)}</td>
      <td>${pct(r.meanHitRate)}</td>
      <td>${r.meanHitCount.toFixed(1)}</td>
      <td>${pct(r.p10HitRate)}</td>
      <td>${pct(r.p50HitRate)}</td>
      <td>${pct(r.p90HitRate)}</td>
      <td>${pct(r.meanResourceUpper)}</td>
      <td>${pct(r.meanResourceMiddle)}</td>
      <td>${pct(r.meanResourceLower)}</td>
    </tr>`).join('');
}

function setBusy(busy, message) {
  for (const button of controls) button.disabled = busy;
  $('status').textContent = message;
}

async function run(kind) {
  const options = readOptions();
  setBusy(true, '計算中…');
  await new Promise(resolve => setTimeout(resolve, 20));
  try {
    const rows = kind === 'compare'
      ? compareBoards(options, BOARD_PRESETS)
      : [runExplorationBatch(options)];
    renderResults(rows);
    $('status').textContent = `${options.trials}試行 × ${options.splashes}スプラッシュ / 資源基準${options.resources.count}個`;
  } catch (error) {
    console.error(error);
    $('status').textContent = `エラー: ${error.message}`;
  } finally {
    for (const button of controls) button.disabled = false;
  }
}

function drawSample() {
  const options = readOptions();
  const result = simulateExploration({ ...options, returnInk: true, returnResources: true });
  const canvas = $('sampleCanvas');
  const ctx = canvas.getContext('2d');
  const maxW = 720;
  const maxH = 720;
  const scale = Math.min(maxW / result.cols, maxH / result.rows);
  canvas.width = Math.max(1, Math.round(result.cols * scale));
  canvas.height = Math.max(1, Math.round(result.rows * scale));

  ctx.fillStyle = '#f7f3e8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const y1 = canvas.height / 3;
  const y2 = canvas.height * 2 / 3;
  ctx.strokeStyle = 'rgba(80,70,55,.24)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y1); ctx.lineTo(canvas.width, y1);
  ctx.moveTo(0, y2); ctx.lineTo(canvas.width, y2);
  ctx.stroke();

  ctx.fillStyle = '#24221f';
  for (let y = 0; y < result.rows; y++) {
    for (let x = 0; x < result.cols; x++) {
      if (!result.ink[y * result.cols + x]) continue;
      ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }

  for (const resource of result.resources) {
    ctx.beginPath();
    ctx.arc(resource.x * scale, resource.y * scale, Math.max(2, resource.radius * scale), 0, Math.PI * 2);
    ctx.fillStyle = resource.hit ? 'rgba(194,77,47,.92)' : 'rgba(56,120,100,.82)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(35,32,28,.7)';
    ctx.stroke();
  }

  $('status').textContent = `1ラン: 面積 ${pct(result.coverage)} / 資源 ${result.hitCount}/${result.resourceCount} (${pct(result.hitRate)}) / 半径倍率 ${result.resourceScale.toFixed(2)}×`;
}

$('compareBtn').addEventListener('click', () => run('compare'));
$('singleBtn').addEventListener('click', () => run('single'));
$('sampleBtn').addEventListener('click', drawSample);

drawSample();
