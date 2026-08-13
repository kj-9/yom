# yom Roadmap

`yom`を「動くalpha」から、日常的に安心して使えて配布できるMarkdown
ビューア兼静的サイトビルダーへ育てるためのロードマップです。

当面は新機能を増やすことよりも、リポジトリの整理、devの回帰防止、
配布物の実動作保証を優先します。

## Phase 0: リポジトリを整理する

**Status:** Completed on 2026-08-12

### 目的

現行実装と開発手順が一意に分かる状態にします。

### 作業

- Python版の残骸を削除する
  - `pyproject.toml`
  - `uv.lock`
  - `tests/test_cli.py`
  - `tests/test_server.py`
  - `.gitignore`内のPython向け設定
- 使用されなくなった`scanMarkdownMtimes()`を削除する
- `package-lock.json`と`bun.lock`のどちらを正とするか決める
- `AGENTS.md`を現在のTypeScript/Bun構成に更新する
- `README.md`と`README.ja.md`を実装と照合する
- 標準のローカル検証手順を`./scripts/check.sh`へ集約する

### 完了条件

- Bun/TypeScriptだけで現在の構成と開発手順を説明できる
- 古いPython向けコマンドやテストがリポジトリに残っていない
- `./scripts/check.sh`が標準のフルチェックとして成功する

## Phase 1: devの回帰を防ぐ

**Status:** Completed on 2026-08-12

### 目的

外部プロジェクトからの起動、ファイル監視、ブラウザ更新に関する不具合の
再発を防ぎます。

### 作業

- 実ブラウザを使うE2Eテストを追加する
  - 外部プロジェクトから`yom dev`を起動できる
  - 呼び出し元の`vite.config.ts`を読み込まない
  - Markdown編集後に画面が一度だけ更新される
  - ファイルの追加と削除がサイドバーへ反映される
  - `document.documentElement.lang`のデフォルトが`und`になる
- 2秒間隔のポーリングが存在しないことを保証する
- SSEの切断と再接続後も更新を受信できることを確認する
- 画像などMarkdown以外のアセット更新も画面へ反映する
- 表示中のページが削除された場合の遷移先を定義する
- 内容が変わっていない場合は本文DOMを更新しない

### 完了条件

- `kazeflow`相当の外部ディレクトリをfixtureにしたテストが成功する
- Chrome翻訳を有効にしてもDOM更新ループが発生しない
- ファイル更新、追加、削除、再接続が自動テストで検証されている

## Phase 2: 配布物を実利用に近い形で検証する

**Status:** Completed on 2026-08-12

### 目的

リポジトリでは動作しても、npmから導入すると動作しない問題を防ぎます。

### 作業

- `npm pack`で実際の配布tarballを作成する
- 空の一時プロジェクトへtarballをインストールする
- インストール先から次を検証する
  - `yom --help`
  - `yom dev`
  - `yom build`
  - `yom preview`
- パッケージに必要なランタイムファイルが含まれることを確認する
- LinuxとmacOSでテストする
- サポート対象とする最小Bunバージョンでテストする
- prereleaseとstableのnpm tag運用を整理する
  - prereleaseは`alpha`または`beta`
  - stableは`latest`

### 完了条件

- CIで`pack -> install -> dev/build/preview`が成功する
- CLIがリポジトリ内のソース配置に依存しない
- 公開前に配布漏れを検出できる

## Phase 3: スキャンと更新を高速化する

**Status:** Completed on 2026-08-12

### 目的

Markdownが数千ファイルあるリポジトリでも快適に動作させます。

現状はツリー取得や文書読み込みの際にファイル一覧と`git check-ignore`を
再計算します。小規模なツリーでは問題ありませんが、ファイル数が増えると
最初の性能ボトルネックになります。

### 作業

- 起動時にサイトインデックスを一度構築する
- Vite watcherのイベントでインデックスを差分更新する
- 文書読み込み時の全ファイル再走査を廃止する
- `.gitignore`の判定結果をキャッシュする
- 更新イベントに変更種別と対象パスを含める
  - `document:change`
  - `document:add`
  - `document:remove`
  - `asset:change`
- クライアントが必要なデータだけ再取得するようにする
- 100、1,000、10,000ファイルの簡易ベンチマークを追加する

### 完了条件

- Markdown本文の更新では対象文書だけを再取得する
- ツリー構造の変更時だけツリーを再取得する
- 1,000ファイル規模でも起動と更新待ちが体感上問題にならない
- 性能劣化を継続的に検出できる

## Phase 4: devとbuildの表示を統一する

**Status:** Completed on 2026-08-12

### 目的

`yom dev`で確認した表示と操作を、`yom build`の成果物でも再現します。

### 作業

- devとbuildで共有するレンダリング層を作る
- 次の表示と機能を統一する
  - Markdown表示
  - サイドバー
  - Mermaid
  - テーマ
  - モバイル表示
  - 相対リンク
- 静的サイトのサブパス配信に対応する
  - GitHub Pages
  - `/docs/`など任意のbase path
- `guide.md#section`のようなfragment付きMarkdownリンクに対応する
- 404ページと壊れたリンクの扱いを定義する
- build時にリンク切れを警告できるようにする

### 完了条件

- 同じfixtureをdevとbuildの両方で表示検証できる
- devとbuildの主要画面をスクリーンショット比較できる
- GitHub Pagesなどのサブパスから正常に閲覧できる
- Mermaidや相対リンクがdevとbuildで同じ結果になる

## Phase 5: 明示的な設定を導入する

**Status:** Completed on 2026-08-12

### 目的

内容からの推測を避け、利用者がサイトの意図を明示できるようにします。

設定形式は実装前に`yom.config.ts`または`yom.yaml`から選定します。

```yaml
title: Kazeflow Docs
lang: ja
include:
  - "**/*.md"
exclude:
  - "vendor/**"
theme: system
```

### 設定候補

- サイトタイトル
- 文書の言語
  - デフォルトは`und`
  - Markdown本文から言語を推測しない
- include / exclude
- 初期表示ページ
- サイドバーの表示順
- base path
- theme / palette
- font size / content width / outline visibility
- build出力先
- ブラウザを自動で開くかどうか

CLIオプションは設定ファイルの値を上書きするものとします。

### 完了条件

- 設定ファイルがなくても現在と同じように動作する
- `lang`は明示された場合だけ`ja`や`en`になる
- devとbuildが同じ設定を利用する
- 不正な設定値に分かりやすいエラーを返す

## Phase 6: Markdownビューアとして磨く

**Status:** Completed on 2026-08-12

### 目的

基盤が安定した後、長いドキュメントや大きなツリーを読む体験を改善します。

### 候補

- 見出しアウトライン
- スクロール位置に応じた現在見出しの追従
- 見出しリンクのコピー
- 全文検索
- キーボード操作
- コードブロックのコピー
- front matterの表示とメタデータ利用
- 前後ページへの移動
- ファイル名とは別のページタイトル表示
- 印刷用CSS
- アクセシビリティの検証と改善
- スクロール中も見出しアウトラインを画面内に固定
- テーマ、配色、文字サイズ、本文幅、アウトライン表示をまとめた表示設定
- 表示設定のローカル保存と設定ファイル既定値へのリセット

### 完了条件

- 機能ごとに利用シナリオとE2Eテストがある
- キーボードだけで主要な閲覧操作ができる
- 大きな文書ツリーでも目的の情報へ素早く移動できる

## リリース目安

| Version         | Scope                        |
| --------------- | ---------------------------- |
| `0.1.0-alpha.3` | Phase 0からPhase 6の初期実装 |
| `0.1.0-beta.1`  | 配布後の互換性検証と改善     |
| `0.1.0`         | 安定版                       |
| `0.2.0`         | 次期主要機能                 |

## 優先順位

最初に取り組む範囲は次の順序とします。

1. Phase 0: リポジトリを整理する
2. Phase 1: devの回帰を防ぐ
3. Phase 2: 配布物を実利用に近い形で検証する

この3フェーズを完了すると、外部プロジェクトからの実行、ファイル監視、
npm配布に起因する回帰を早い段階で検出できるようになります。その後に
性能とdev/buildの統一へ進み、基盤が安定してから設定や閲覧機能を拡張します。

## 完了記録

2026-08-12にPhase 0からPhase 6までを実装しました。完了状態は次の仕組みで
継続的に検証します。

- `./scripts/check.sh`
  - TypeScriptとPrettier
  - unit tests
  - 100 / 1,000 / 10,000ファイルの性能上限
  - `npm pack`したtarballのinstall / dev / build / preview
  - Playwrightによるdev / static buildの実ブラウザE2E
  - axeによるアクセシビリティ監査
- GitHub Actions
  - Linux最新版Bun
  - macOS最新版Bun
  - Linux上の最小対応Bun 1.3.0
- `tests/e2e/dev.spec.ts`
  - 外部プロジェクト起動と呼び出し元Vite設定の分離
  - イベント駆動更新、追加、削除、アセット更新、SSE再接続
  - dev / buildのスクリーンショット一致とbase path
  - fragment、404、front matter、アウトライン、コピー、全文検索
  - キーボード移動、印刷表示、アクセシビリティ
