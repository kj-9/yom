## Why

Phase 7でレスポンシブ基盤と表示設定は安定したが、実利用に近い文書ツリーと長文を監査すると、無視対象の大量流入、文書リンクの誤ったセマンティクス、重複タイトル、平坦で過密なナビゲーションが閲覧開始と現在位置の把握を妨げている。Phase 8で発見・再開機能を追加する前に、既存閲覧UIの情報階層と基礎的な正しさを整える。

## What Changes

- 大量の候補パスがある場合も`.gitignore`対象を確実に除外し、依存パッケージのMarkdownが文書ツリーや初期表示へ流入しないようにする。
- `includeIgnored`設定により、`.gitignore`対象のうち公開を意図した文書・assetだけを相対path globで明示的にopt-inできるようにする。`include`と`exclude`は引き続き公開範囲を制約し、`exclude`を最優先する。
- 文書ツリーの文書項目をリンクとして公開し、list markerを表示せず、フォルダの展開三角形だけを階層の記号として使う。階層ごとのindentを狭く保ち、選択中の文書からsource表示へ移動できるようにする。
- 文書ツリーは現在文書の祖先を優先して展開し、大規模ツリーでも現在位置を把握できる初期状態にする。
- 本文面から文書パスと表示mode操作を除き、Markdown本文または不足時に補完する主見出しから直接読み始められるようにする。
- ページ内アウトラインへ見出し階層を反映し、現在見出しと親セクションを判別しやすくする。
- Display settingsはfloating cardではなく左ペイン内の専用画面として表示し、Documentsへ戻る操作とモバイルドロワーを閉じる操作を区別する。
- 既存のテーマ、配色、レスポンシブ配置、dev/static同等性を維持しつつ、余白、文字サイズ、選択状態、操作群の視覚的な一貫性を整える。
- 非目標: Phase 8の検索結果ビュー、クイックオープン、最近開いた文書、スクロール位置復元、パンくず、ピン留め、フォーカスモード、モバイル見出し移動は追加しない。
- 互換性: `yom.config.*`へ省略可能な`includeIgnored`を追加する。省略時は空配列として従来のgitignore除外を維持し、CLI、生成データの公開形式、既存URLは変更しない。

## Capabilities

### New Capabilities

- `document-discovery-integrity`: 大規模なツリーでも無視対象を除外し、有効なMarkdownだけを初期表示とナビゲーションへ含める契約。
- `document-navigation-ui`: 文書ツリーとページ内アウトラインの意味、階層、現在位置、初期展開の契約。
- `reading-surface-ui`: 本文見出しの補完、読書面と表示操作の分離、左ペイン内の表示設定を含む閲覧面の情報階層。

### Modified Capabilities

なし。

## Impact

- `src/core/config.ts`、`src/core/scan.ts`とrepository/index更新経路の無視対象判定および限定opt-in。
- `src/site/components.tsx`、`src/site/static.tsx`、関連stateと`src/site/styles.css`の閲覧UI。
- unit test、dev/static共通E2E、レスポンシブ画像比較、axe監査。
- `README.md`、`README.ja.md`、`ROADMAP.md`の利用説明とPhase記録。
- 新しいランタイム依存は追加しない。公開設定には省略可能な`includeIgnored: string[]`を追加する。
