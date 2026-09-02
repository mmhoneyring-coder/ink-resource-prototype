#!/usr/bin/env node
import { BOARD_PRESETS, compareBoards, runExplorationBatch } from './sim-core.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;
    const key = part.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    args[key] = value;
  }
  return args;
}

function pct(v) {
  return `${(v * 100).toFixed(2)}%`;
}

function parseBoards(value) {
  if (!value) return BOARD_PRESETS;
  return String(value).split(',').map(part => {
    const [cols, rows] = part.toLowerCase().split('x').map(Number);
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) throw new Error(`Invalid board: ${part}`);
    return [cols, rows];
  });
}

const args = parseArgs(process.argv.slice(2));
const options = {
  trials: Number(args.trials ?? 500),
  splashes: Number(args.splashes ?? 8),
  strategy: String(args.strategy ?? 'wide'),
  seed: Number(args.seed ?? 12345),
};

let results;
if (args.cols && args.rows) {
  results = [runExplorationBatch({ ...options, cols: Number(args.cols), rows: Number(args.rows) })];
} else {
  results = compareBoards(options, parseBoards(args.boards));
}

if (args.json) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

console.log(`strategy=${options.strategy} splashes=${options.splashes} trials=${options.trials} seed=${options.seed}`);
console.log('board\tcoverage\tp10\tp50\tp90\tupper\tmiddle\tlower\tmeanInk');
for (const r of results) {
  console.log([
    `${r.cols}x${r.rows}`,
    pct(r.meanCoverage),
    pct(r.p10Coverage),
    pct(r.p50Coverage),
    pct(r.p90Coverage),
    pct(r.meanUpper),
    pct(r.meanMiddle),
    pct(r.meanLower),
    r.meanInkCells.toFixed(0),
  ].join('\t'));
}
