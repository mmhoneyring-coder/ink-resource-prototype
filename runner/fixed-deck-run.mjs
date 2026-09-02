#!/usr/bin/env node
import { compareFixedDeckStrategies, FIXED_DECK } from './fixed-deck-sim.mjs';

const trials = Number(process.argv[2] ?? 600);
const rows = compareFixedDeckStrategies({ trials });

console.log('Fixed deck');
console.log(`upper(${FIXED_DECK.upper.length}): ${FIXED_DECK.upper.join(',')}`);
console.log(`middle(${FIXED_DECK.middle.length}): ${FIXED_DECK.middle.join(',')}`);
console.log(`lower(${FIXED_DECK.lower.length}): ${FIXED_DECK.lower.join(',')}`);
console.log(`trials=${trials}`);
console.log('strategy\tact\tp10/p50/p90\tscore\tp10/p50/p90\ttreasure\tgoal\tU/M/L act\tU/M/L score');
for (const r of rows) {
  console.log([
    r.brushStrategy,
    r.meanActivated.toFixed(2),
    `${r.p10Activated.toFixed(0)}/${r.p50Activated.toFixed(0)}/${r.p90Activated.toFixed(0)}`,
    r.meanScore.toFixed(1),
    `${r.p10Score.toFixed(0)}/${r.p50Score.toFixed(0)}/${r.p90Score.toFixed(0)}`,
    `${(r.treasureRate * 100).toFixed(1)}%`,
    `${(r.goalRate * 100).toFixed(1)}%`,
    `${r.meanActivatedUpper.toFixed(2)}/${r.meanActivatedMiddle.toFixed(2)}/${r.meanActivatedLower.toFixed(2)}`,
    `${r.meanScoreUpper.toFixed(1)}/${r.meanScoreMiddle.toFixed(1)}/${r.meanScoreLower.toFixed(1)}`,
  ].join('\t'));
}
