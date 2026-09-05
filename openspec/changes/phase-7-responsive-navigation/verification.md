# 検証記録

記録日: 2026-09-05（macOS arm64）

- `./scripts/check.sh`: 型検査、compile、Prettier、58 unit tests、3 packed tests、4 Chromium E2Eがすべて成功。
- `bun run test:e2e -- --grep "responsive navigation"`: dev/staticで同じヘルパーを実行し成功。
- 320、390、899、900、1,024、1,199、1,200、1,440pxでページ全体の横あふれなし。
- 1,024pxでは保存済みsidebar幅560pxを制限し、本文側レイアウト領域640px以上を確保。1,440pxへ戻ると保存幅を復元。
- 390／1,024／1,440pxの通常表示と390pxのドロワー表示で画像が一致。比較時はサーバー固有のステータス領域のみマスク。
- キーボードで開く、Tab循環、Escape、Close、背景クリック、文書選択、900px以上へのリサイズを検証。
- 背景のinert、スクロール抑止、閉じた後のフォーカスとスクロール位置の復元を検証。
- ライト／ダーク×paper／forest／seaの全6組合せでドロワーのaxe違反なし。
- 320pxの長い文書パス・本文、コード、表、画像を検証。コードと表は要素内でスクロール。
- JavaScript無効の390px静的サイトで文書一覧と前後ページ移動が利用可能。
- benchmark: 100件 0.95 ms、1,000件 3.42 ms、10,000件 49.92 ms。

画像はテスト実行時に`test-results/dev-responsive-navigation--60541-eractions-in-dev-and-static/`へ生成する。`preview-390.png`、`preview-1024.png`、`preview-1440.png`はマスクなしの表示例。実ブラウザ画像も目視確認済み。

比較で見つかったdev初期文書順の差は、静的buildと同じツリー走査順を使うことで修正し、unit testを追加した。配色ごとのダーク背景とCopyボタンの配置も修正した。表示設定UIの再設計は本変更へ含めず、Phase 7の後続作業として残す。
