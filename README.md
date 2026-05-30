# yom

`yom` は、指定ディレクトリ以下の `.md` ファイルを探索し、サイドバー付きのローカル Web サイトとして表示する Python ツールです。

## 特徴

- `.md` ファイルを再帰的に探索
- サイドバーにファイルツリーを表示
- Markdown を HTML としてレンダリング
- ファイル更新を監視し、ブラウザへ即時反映
- 単一コマンドでローカルサーバー起動

## 開発環境

この README は `~/work/repos/yom` にクローン済みで、`uv` が使える前提です。

```bash
cd ~/work/repos/yom
uv sync
```

## 使い方

リポジトリ直下を表示する場合:

```bash
cd ~/work/repos/yom
uv run yom .
```

サンプル用に `work/` を表示する場合:

```bash
cd ~/work/repos/yom
uv run yom work
```

ブラウザで [http://127.0.0.1:8000](http://127.0.0.1:8000) を開きます。

## オプション

```bash
uv run yom ~/work/repos/yom/work --host 127.0.0.1 --port 8000 --interval 0.7
```

`yom --help` で確認できるオプション:

- `root`: 探索対象ディレクトリ
- `--host`: 待受ホスト
- `--port`: 待受ポート
- `--interval`: 更新監視のポーリング間隔(秒)
