import { BOARD_PRESETS } from './sim-core.mjs';
import { compareBrushBoards, compareBrushStrategies, runBrushBatch, simulateBrushRun } from './brush-sim.mjs';

const $ = id => document.getElementById(id);
const controls = ['compareBtn', 'strategyCompareBtn', 'singleBtn', 'sampleBtn'].map($);

const STRATEGY_LABELS = {
  nearest: '近い順',
  valueRate: '点/距離',
  highValue: '高得点優先',
  upper: '上層寄り',
  goalFirst: '見える当たり優先',
};

function readOptions() {
  return {
    trials: Math.max(1, Number($('trials').value || 300)),
    splashes: Math.max(1, Number($('splashes').value || 8)),
    seed: Number($('seed').value || 12345) >>> 0,
    strategy: $('strategy').value,
    cols: Math.max(40, Number($('cols').value || 240)),
    rows: Math.max(60, Number($('rows').value || 420)),
    resources: {
      count: Math.max(1, Number($('resourceCount').value || 40)),
      baseRadius: Math.max(.5, Number($('resourceRadius').value || 3)),
      countMode: $('resourceCountMode').value,
      scaleMode: $('resourceScaleMode').value,
    },
    brush: {
      budget: Math.max(0, Number($('brushBudget').value || 480)),
      radius: Math.max(.25, Number($('brushRadius').value || 2)),
      startY: Math.max(.5, Math.min(.98, Number($('startY').value || 78) / 100)),
      strategy: $('brushStrategy').value,
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
      <td>${STRATEGY_LABELS[r.brushStrategy] ?? r.brushStrategy}</td>
      <td>${r.visibleCount}/${r.knownCount}/${r.hiddenCount}</td>
      <td>${r.meanSplashHiddenDiscoveries.toFixed(1)}</td>
      <td>${r.meanBrushDiscoveries.toFixed(1)}</td>
      <td>${r.meanFinalFound.toFixed(1)}</td>
      <td><strong>${r.meanActivated.toFixed(1)}</strong></td>
      <td><strong>${r.meanScore.toFixed(1)}</strong></td>
      <td>${r.p10Score.toFixed(0)}</td>
      <td>${r.p50Score.toFixed(0)}</td>
      <td>${r.p90Score.toFixed(0)}</td>
      <td>${pct(r.goalRate)}</td>
      <td>${pct(r.treasureRate)}</td>
      <td>${r.meanBrushUsed.toFixed(0)} / ${r.brushBudget.toFixed(0)}</td>
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
    let rows;
    if (kind === 'compareBoards') rows = compareBrushBoards(options, BOARD_PRESETS);
    else if (kind === 'compareStrategies') rows = compareBrushStrategies(options);
    else rows = [runBrushBatch(options)];
    renderResults(rows);
    $('status').textContent = `${options.trials}試行 × ${options.splashes}スプラッシュ / 資源${options.resources.count} / 筆予算${options.brush.budget}`;
  } catch (error) {
    console.error(error);
    $('status').textContent = `エラー: ${error.message}`;
  } finally {
    for (const button of controls) button.disabled = false;
  }
}

function drawResource(ctx, resource, scale) {
  const r = Math.max(2, resource.radius * scale);
  ctx.beginPath();
  ctx.arc(resource.x * scale, resource.y * scale, r, 0, Math.PI * 2);

  if (resource.activated) {
    ctx.fillStyle = resource.discoveredByBrush ? 'rgba(129,72,155,.95)' : 'rgba(194,77,47,.92)';
  } else if (resource.splashHit) {
    ctx.fillStyle = 'rgba(225,157,55,.92)';
  } else if (resource.visibility === 'visible') {
    ctx.fillStyle = 'rgba(63,116,173,.90)';
  } else if (resource.visibility === 'known') {
    ctx.fillStyle = 'rgba(120,130,138,.72)';
  } else {
    ctx.fillStyle = 'rgba(56,120,100,.26)';
  }
  ctx.fill();

  ctx.lineWidth = resource.isTreasure ? 2.5 : resource.isGoal ? 2 : 1;
  ctx.strokeStyle = resource.isTreasure ? 'rgba(179,121,18,.95)' : resource.isGoal ? 'rgba(45,76,128,.95)' : 'rgba(35,32,28,.62)';
  ctx.stroke();

  if (resource.valueKnown || resource.isGoal) {
    ctx.fillStyle = '#161513';
    ctx.font = `${Math.max(8, Math.min(13, r * 1.25))}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(resource.value), resource.x * scale, resource.y * scale);
  } else if (resource.positionKnown) {
    ctx.fillStyle = '#25231f';
    ctx.font = `${Math.max(8, Math.min(13, r * 1.35))}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', resource.x * scale, resource.y * scale);
  }
}

function drawSample() {
  const options = readOptions();
  const result = simulateBrushRun({ ...options, returnInk: true });
  const canvas = $('sampleCanvas');
  const ctx = canvas.getContext('2d');
  const maxW = 720;
  const maxH = 820;
  const scale = Math.min(maxW / result.cols, maxH / result.rows);
  canvas.width = Math.max(1, Math.round(result.cols * scale));
  canvas.height = Math.max(1, Math.round(result.rows * scale));

  ctx.fillStyle = '#f7f3e8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const y1 = canvas.height / 3;
  const y2 = canvas.height * 2 / 3;
  ctx.strokeStyle = 'rgba(80,70,55,.30)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y1); ctx.lineTo(canvas.width, y1);
  ctx.moveTo(0, y2); ctx.lineTo(canvas.width, y2);
  ctx.stroke();

  ctx.fillStyle = '#24221f';
  for (let y = 0; y < result.rows; y++) {
    for (let x = 0; x < result.cols; x++) {
      if (!result.ink?.[y * result.cols + x]) continue;
      ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(57,84,132,.78)';
  ctx.lineWidth = Math.max(2, result.brushRadius * 2 * scale);
  for (const segment of result.brushSegments) {
    ctx.beginPath();
    ctx.moveTo(segment.a.x * scale, segment.a.y * scale);
    ctx.lineTo(segment.b.x * scale, segment.b.y * scale);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(result.home.x * scale, result.home.y * scale, Math.max(3, 3 * scale), 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();

  for (const resource of result.resources) drawResource(ctx, resource, scale);

  const names = ['上層', '中層', '下層'];
  $('distribution').innerHTML = result.distribution.map((text, i) =>
    `<div><strong>${names[i]}</strong><span>${text || 'なし'}</span></div>`
  ).join('') + `<p>特別埋蔵：50pt×1（今回は${result.treasureBand === 1 ? '中層' : '下層'}）。青枠が見える12ptの擬似ゴール、金枠が50ptお宝。</p>`;

  $('status').textContent = `1ラン: 有効化 ${result.activatedCount} / 得点 ${result.score} / 隠し発見 splash ${result.splashHiddenDiscoveries} + 筆 ${result.brushDiscoveries} / お宝 ${result.treasureActivated ? '取得' : '未取得'}`;
}

$('compareBtn').addEventListener('click', () => run('compareBoards'));
$('strategyCompareBtn').addEventListener('click', () => run('compareStrategies'));
$('singleBtn').addEventListener('click', () => run('single'));
$('sampleBtn').addEventListener('click', drawSample);

drawSample();
