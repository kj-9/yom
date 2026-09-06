## 1. 既定値と保存

- [x] 1.1 サイト設定をSSR・初期state・Resetへ伝播し、共通関数のunit testと非標準の既定値を使うdev/static E2Eで確認する。

## 2. 表示設定UI

- [x] 2.1 不透明なポップオーバー／シートと境界補正を実装し、320×568、390×320、1,024×600、1,440×900のE2Eで全外周とスクロールを確認する。
- [x] 2.2 Escape・閉じるボタン・外側クリック・Tab離脱とフォーカス復帰を実装し、モバイルのEscapeが設定だけを閉じることをE2Eで確認する。

## 3. 統合検証

- [x] 3.1 dev/static画像比較、全配色axe監査、保存・Reset・再読込を含むE2Eを成功させる。
- [x] 3.2 README両言語とROADMAPを更新し、OpenSpec strict validationと./scripts/check.shを成功させる。
