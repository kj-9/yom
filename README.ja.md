# yom

`yom` は、Markdown ツリーをローカルで閲覧・静的書き出しする Bun ベースのツールです。
指定ディレクトリ以下の `.md` を走査し、サイドバー付きのブラウザ UI で表示します。

## 特徴

- `.md` ファイルを再帰的に探索
- サイドバーにファイルツリーを表示
- Markdown を HTML としてレンダリング
- `mermaid` コードフェンスをブラウザ上で図としてレンダリング
- Markdown 内の相対リンクと画像パスを解決
- ファイル更新を監視し、ブラウザへ即時反映
- 同じコンテンツツリーから静的サイトを生成
- ファイル名、タイトル、Markdown本文を横断検索
- スクロールに追従する見出しアウトラインと前後ページ移動
- front matterのタイトルとメタデータを表示
- 見出しURLとコードブロックのコピー
- キーボード操作と印刷用表示

## クイックスタート

依存関係を入れます。

```bash
bun install
```

現在のディレクトリを開発サーバーで開く場合:

```bash
bun run dev --root .
```

静的サイトをビルドする場合:

```bash
bun run build --root . --out-dir dist
```

ビルド結果を確認する場合:

```bash
bun run preview
```

CLI をリンクして直接呼ぶこともできます。

```bash
bun link
yom dev --root .
```

## 使い方

```bash
yom dev --root /path/to/docs --host 127.0.0.1 --port 4173
```

```bash
yom build --root /path/to/docs --out-dir dist --base /
```

```bash
yom preview --host 127.0.0.1 --port 4173 --base / --out-dir dist
```

`yom --help` で確認できる主な項目:

- `dev`: Vite 開発サーバーを起動
- `build`: 出力ディレクトリへ静的サイトを生成
- `preview`: ビルド済みサイトを Vite で確認
- `--root`: 配信またはビルド対象のルートディレクトリ
- `--out-dir`: ビルド成果物の出力先
- `--host`: dev / preview の待受ホスト
- `--port`: dev / preview の待受ポート
- `--base`: build / previewで使用する公開ベースパス
- `--config`: `yom.config.ts`を明示するパス
- `--open`: dev起動時にブラウザを開く

## 設定

呼び出し元ディレクトリまたはMarkdownルートに`yom.config.ts`を置きます。
同じ項目をCLIオプションで指定した場合はCLI側を優先します。

```ts
import { defineConfig } from "@kj-9/yom";

export default defineConfig({
  title: "Project docs",
  lang: "ja",
  include: ["README.md", "docs/**/*.md"],
  exclude: ["docs/drafts/**"],
  initialPage: "README.md",
  order: ["README.md", "docs"],
  base: "/project/",
  theme: "system",
  palette: "paper",
  outDir: "dist",
  open: false,
});
```

設定ファイルがない場合、文書言語は`und`のままです。Markdown本文から言語を
推測しません。不正な値や未知の項目がある場合は、理由を示して起動を停止します。

`bun run build`はdevと同じブラウザアプリをbundleし、レンダリング済み文書を
`dist/data/`、直接アクセス用ページを`dist/docs/`、参照ファイルを`dist/assets/`
へ出力します。`dist/tree.json`と`dist/404.html`も生成します。GitHub Pagesなど
サブパスへ配置する場合は`--base /project/`を指定します。

`bun run dev` では次を配信します。

- `/api/tree`: Markdown ツリー
- `/api/doc?path=...`: 1 ドキュメント分の HTML ペイロード
- `/assets/...`: 参照されたローカル資産

## 相対パス

- `./other.md` や `../guide.md` のような Markdown リンクはアプリ内遷移に変換される
- `./image.png` のような画像パスはローカルアセットとして配信される
- ルート外を指す参照は解決しない

## 閲覧操作

- `/`で全文検索へフォーカス
- `[`と`]`で前後の文書へ移動
- `Escape`で検索欄などからフォーカスを外す
- 見出し横の`#`でその見出しのURLをコピー
- fenced code blockのCopyボタンでコードをコピー
- front matterでは単純な値と`tags: [one, two]`形式の配列を利用可能

## 開発

依存関係を入れます。

```bash
bun install
bunx playwright install chromium chromium-headless-shell
```

主な確認コマンド:

```bash
bun run check
bun run format
bun run test
bun run test:e2e
bun run benchmark
bun run build
```

補助スクリプトも使えます。

```bash
./scripts/check.sh
```

フロントエンド関連は [src/site](src/site)、CLI エントリは
[src/cli/index.ts](src/cli/index.ts) にあります。今後の計画は
[ROADMAP.md](ROADMAP.md) で管理します。

互換用に npm scripts でも同じ操作ができます。

```bash
npm run dev -- --root .
npm run build -- --root . --out-dir dist
npm run preview
npm run test
```

## 公開

このリポジトリから CLI をローカル導入する場合:

```bash
bun install
bun link
```

配布物の確認:

```bash
npm pack
```

tarball を生成せず、梱包対象だけ確認する場合:

```bash
npm pack --dry-run
```

alpha 公開:

```bash
bun publish --tag alpha --access public
```

beta版では`beta`、安定版では`latest`タグを使用します。GitHub Releaseからの
公開では、`package.json`のバージョンに応じてタグを自動選択します。

実行時には `bun` が必要です。
