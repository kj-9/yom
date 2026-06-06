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
yom-next dev --root .
```

## 使い方

```bash
yom-next dev --root /path/to/docs --host 127.0.0.1 --port 4173
```

```bash
yom-next build --root /path/to/docs --out-dir dist
```

```bash
yom-next preview --host 127.0.0.1 --port 4173
```

`yom-next --help` で確認できる主な項目:

- `dev`: Vite 開発サーバーを起動
- `build`: 出力ディレクトリへ静的サイトを生成
- `preview`: ビルド済みサイトを Vite で確認
- `--root`: 配信またはビルド対象のルートディレクトリ
- `--out-dir`: ビルド成果物の出力先
- `--host`: dev / preview の待受ホスト
- `--port`: dev / preview の待受ポート

`bun run build` は `dist/docs/` に静的ページを出力し、非 Markdown 資産を
`dist/assets/` にコピーして、`dist/tree.json` を生成します。

`bun run dev` では次を配信します。

- `/api/tree`: Markdown ツリー
- `/api/doc?path=...`: 1 ドキュメント分の HTML ペイロード
- `/assets/...`: 参照されたローカル資産

## 相対パス

- `./other.md` や `../guide.md` のような Markdown リンクはアプリ内遷移に変換される
- `./image.png` のような画像パスはローカルアセットとして配信される
- ルート外を指す参照は解決しない

## 開発

依存関係を入れます。

```bash
bun install
```

主な確認コマンド:

```bash
bun run check
bun run format
bun run test
bun run build
```

補助スクリプトも使えます。

```bash
./scripts/check.sh
```

フロントエンド関連は [src/site](/Users/kh03/work/repos/yom/src/site)、CLI エントリは
[src/cli/index.ts](/Users/kh03/work/repos/yom/src/cli/index.ts) にあります。

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

公開前の dry run:

```bash
bun run dryrun-publish
```

alpha 公開:

```bash
bun publish --tag alpha --access public
```

実行時には `bun` が必要です。
