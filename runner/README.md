# Balance Runner

ゲーム本体とは分離した、Ink Resource Prototype 用のバランス検証ランナー。

## 現在できること

- 現在の `app.js` と同じスプラッシュ生成パラメータで大量試行
- 180×280 / 220×360 / 240×420 / 260×450 の盤面比較
- 狙い方（全体、下→上、各層集中、ランダム）の比較
- 面積探索率の集計
- 円形資源を置いた資源命中率・平均命中個数の集計
- 資源サイズを各個体±25%でランダム化
- 盤面拡大時に資源サイズを緩く拡大する比較
- 資源数を「全盤面で同じ個数」または「面積比例」に切り替えて比較

資源サイズの自動拡大は 180×280 を 1.00× とし、面積比の 0.32 乗で緩く増やす。現在のプリセットでは概ね 1.00 / 1.16 / 1.25 / 1.31 倍。

## ブラウザ

GitHub Pages の `/runner/` から実行できる。

## CLI

例:

```bash
node runner/run.mjs --trials 500 --splashes 8 --strategy wide
node runner/run.mjs --trials 500 --resources 30 --resourceRadius 3 --resourceCountMode fixed --resourceScaleMode auto
node runner/run.mjs --trials 500 --resourceCountMode density --resourceScaleMode fixed --json
```

## まだ入れていないもの

- 層ごとの点数分布
- 見えている / 存在のみ見える / 完全隠し
- 特別なお宝
- 総インク消費
- 筆接続と取得戦略

これらは仕様確定後に同じランナーへ追加する。
