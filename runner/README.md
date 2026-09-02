# Balance Runner

`ink-resource-prototype` 本体とは分離したバランス検証用ランナー。
本体のゲームファイルは変更せず、`runner/` 内だけで大量試行できる。

## 現在の対象

v0.1 は **スプラッシュによる探索率** の検証専用。

- 現在の `app.js` のスプラッシュ形状・着弾ブレ・小島除去をスナップショットとして再現
- 1ランあたりのスプラッシュ回数を変更可能
- 「全体に広く」「下から上へ」「各層集中」「ランダム」を比較可能
- 全体・上層・中層・下層の探索率を集計
- 盤面サイズのプリセット比較
- Seed 固定可能

点数分布、資源の情報状態、総インク、筆接続、取得戦略は未実装。仕様確定後に追加する。

## Browser

GitHub Pages の `/runner/` から利用する。

## Node

```bash
node runner/run.mjs --trials 1000 --splashes 8 --strategy wide
```

盤面を個別指定:

```bash
node runner/run.mjs --cols 240 --rows 420 --trials 1000 --splashes 8 --strategy upward
```

JSON 出力:

```bash
node runner/run.mjs --trials 1000 --json
```

## 注意

`sim-core.mjs` のスプラッシュ設定は本体から自動読込していない。
本体側のスプラッシュ仕様を変更した場合は、必要に応じてランナー側にも反映する。
