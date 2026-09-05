## Why

現在のbrowser UIは約1,400行の命令的DOM操作へ状態管理と描画が集中し、dev表示とstatic buildのHTML生成も別経路になっている。軽量な配布を維持しながら今後のUI改善を安全に進めるため、Viteを残して表示層だけをPreactへ移し、同じcomponentから対話UIと静的HTMLを生成できる基盤へ揃える。

## What Changes

- browser UIを命令的DOM描画からPreact componentと明示的なstateへ移行する。
- `preact-render-to-string`を使い、static buildの各文書ページへ本文、文書navigation、ページ内見出し、ページ送りをprerenderする。
- browserではprerender済みmarkupをhydrateし、初期文書を再取得せず対話機能を有効化する。
- devとstatic buildで同じcomponent、route規則、文書payload、主要操作を共有する。
- 公開packageをcompiled ESMとして配布し、BunがないNode.js 22および24環境で`dev`、`build`、`preview`を実行できるようにする。
- Bunは開発用package managerおよびtest runnerとして維持し、公開runtime dependencyから外す。
- caller projectのVite設定を読み込まず、yom自身のVite設定と公開APIを使用する既存の分離を維持する。
- 初期browser JavaScriptとproduction install容量に増分予算を設け、Astro、Starlight、Pagefindを依存へ追加しない。
- Mermaidは現在の遅延読み込みと表示動作を維持し、削除・optional化・別package化は行わない。
- 非目標: 検索、Pagefind、Phase 7のレスポンシブ再設計、新しい閲覧機能、Mermaid最適化は含めない。
- **BREAKING**: 公開CLIの最低runtimeをNode.js 22.12へ変更し、package exportとbinはTypeScript sourceではなくcompiled ESMを参照する。

## Capabilities

### New Capabilities

- `node-compatible-cli`: pack済みyomをBunなしのNode.js 22／24環境へinstallし、CLIと公開exportを実行できる互換性を定義する。
- `preact-site-rendering`: devとstatic buildで共有するPreact UI、静的prerender、hydration、既存閲覧動作の契約を定義する。

### Modified Capabilities

なし。

## Impact

- `src/site/`をPreact component、state、browser entryへ再編する。
- `src/cli/`、`src/core/`、`src/dev/`、`vite.config.ts`、`bin/yom`、package exports、build出力をNode-compatibleな配布境界へ変更する。
- Preactとserver rendering用の小さな依存を追加し、Astro、Starlight、Pagefindは追加しない。
- unit、package、E2EにNode 22／24、prerender、hydrate、dev/static同等性、caller cwd分離の検証を追加する。
- `README.md`、`README.ja.md`、`ROADMAP.md`を新しいruntime要件と開発・配布手順へ合わせる。
- `phase-7-responsive-navigation`の実装は本変更完了後に開始し、Preact component構造を前提として計画を再確認する。
