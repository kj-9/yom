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

開発時の最低限の確認:

```bash
cd ~/work/repos/yom
./scripts/check.sh
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

起動するとデフォルトでブラウザが [http://127.0.0.1:8000](http://127.0.0.1:8000) を開きます。

## オプション

```bash
uv run yom ~/work/repos/yom/work --host 127.0.0.1 --port 8000 --interval 0.7 --title "yom docs"
```

`yom --help` で確認できるオプション:

- `root`: 探索対象ディレクトリ
- `--host`: 待受ホスト
- `--port`: 待受ポート
- `--interval`: 更新監視のポーリング間隔(秒)
- `--no-watch`: ファイル更新監視を無効にする
- `--title`: ブラウザタイトルを指定する
- `--no-open`: 起動時のブラウザ自動オープンを無効にする

## 更新監視の確認

手元で更新監視を確認する最短手順:

```bash
cd ~/work/repos/yom
uv run yom work
```

1. ブラウザで `http://127.0.0.1:8000` を開く
2. `work/` 配下の Markdown を 1 つ表示する
3. 別ターミナルで対象ファイルを書き換える
4. 数秒以内に表示内容と監視ステータスが更新されることを確認する

監視なしで起動したい場合:

```bash
cd ~/work/repos/yom
uv run yom work --no-watch
```

ブラウザを自動で開きたくない場合:

```bash
cd ~/work/repos/yom
uv run yom work --no-open
```
