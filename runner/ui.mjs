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
  };
}

function pct(v) {
  return `${(v * 100).toFixed(2)}%`;
}

function renderResults(rows) {
  $('results').innerHTML = rows.map(r => `
    <tr>
      <td>${r.cols}×${r.rows}</td>
      <td>${pct(r.meanCoverage)}</td>
      <td>${pct(r.p10Coverage)}</td>
      <td>${pct(r.p50Coverage)}</td>
      <td>${pct(r.p90Coverage)}</td>
      <td>${pct(r.meanUpper)}</td>
      <td>${pct(r.meanMiddle)}</td>
      <td>${pct(r.meanLower)}</td>
      <td>${r.meanInkCells.toFixed(0)}</td>
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
    $('status').textContent = `${options.trials}試行 × ${options.splashes}スプラッシュ 完了`;
  } catch (error) {
    console.error(error);
    $('status').textContent = `エラー: ${error.message}`;
  } finally {
    for (const button of controls) button.disabled = false;
  }
}

function drawSample() {
  const options = readOptions();
  const result = simulateExploration({ ...options, returnInk: true });
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

  $('status').textContent = `1ラン: 全体 ${pct(result.coverage)} / 上 ${pct(result.upper)} / 中 ${pct(result.middle)} / 下 ${pct(result.lower)}`;
}

$('compareBtn').addEventListener('click', () => run('compare'));
$('singleBtn').addEventListener('click', () => run('single'));
$('sampleBtn').addEventListener('click', drawSample);

drawSample();
