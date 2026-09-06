## Why

表示設定カードは半透明で、低い画面や狭いサイドバーで外へはみ出す場合がある。Phase 7の仕上げとして、読みやすさとキーボード操作を保った設定UIへ整理する。

## What Changes

- デスクトップでは画面内に収まる不透明な設定ポップオーバーを表示する。
- モバイルでは文書ドロワー内に収まる設定シートとして表示する。
- Escape、閉じるボタン、外側クリックで閉じ、キーボードで操作を完結できる。
- テーマ・配色・文字サイズ・本文幅・outlineの変更と保存を維持し、Resetでサイト設定の既定値に戻す。
- 非目標: 検索などPhase 8の機能、設定項目や保存キーの追加、依存パッケージの追加。
- CLIオプションと設定ファイルの形式は維持する。

## Capabilities

### New Capabilities

- `display-settings`: 表示設定の配置、開閉、保存・リセットの操作契約。

### Modified Capabilities

なし。

## Impact

`src/site/`の設定component・スタイル・初期設定処理、dev/staticのE2E、README両言語とROADMAPを更新する。
