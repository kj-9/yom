# yom

`yom` は、指定ディレクトリ以下の `.md` ファイルを探索し、サイドバー付きのローカル Web サイトとして表示する Python ツールです。

## 特徴

- `.md` ファイルを再帰的に探索
- サイドバーにファイルツリーを表示
- Markdown を HTML としてレンダリング
- Markdown 内の相対リンクと画像パスを解決
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

個別に整形と lint を回す場合:

```bash
cd ~/work/repos/yom
uv run ruff check .
uv run ruff format --check .
XDG_CACHE_HOME="$PWD/.cache" pnpx prettier@3 --check "src/yom/assets/*.{html,css,js}"
```

フロントエンド資産を整形する場合:

```bash
cd ~/work/repos/yom
XDG_CACHE_HOME="$PWD/.cache" pnpx prettier@3 --write "src/yom/assets/*.{html,css,js}"
```

UI テンプレートは [src/yom/assets](src/yom/assets) に分離してあり、見た目やクライアント側挙動を調整したいときはここを編集します。

## 使い方

いちばん手早く現在のディレクトリの Markdown を開くなら:

```bash
uvx yom .
```

`yom` をその場でダウンロードして実行するので、事前インストールなしですぐ確認できます。

特定ディレクトリを表示する場合:

```bash
uvx yom /path/to/docs
```

繰り返し使うなら、先に 1 回インストールしておく方法でも構いません:

```bash
pip install yom
```

`uv` を使う場合:

```bash
uv tool install yom
```

インストール後は次のコマンドで同じように起動できます:

```bash
yom .
```

```bash
yom /path/to/docs
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
- `--watch-mode {auto,poll,watchdog}`: 監視方式を切り替える
- `--title`: ブラウザタイトルを指定する
- `--no-open`: 起動時のブラウザ自動オープンを無効にする
- `--markdown-extension NAME`: Markdown 拡張を追加で有効化する
- `--no-default-extensions`: 既定の Markdown 拡張を無効にする

Markdown 拡張を切り替えたい場合:

```bash
cd ~/work/repos/yom
uv run yom work --markdown-extension admonition
```

`--markdown-extension` は `yom` 独自の機能を切り替えるものではなく、内部で使っている
Python-Markdown に追加の拡張名を渡すためのオプションです。たとえば `admonition` を
指定すると、Python-Markdown が提供する注意書きブロック構文を有効にできます。

既定では `fenced_code`、`tables`、`toc`、`sane_lists` が有効です。必要な拡張だけを
明示的に使いたい場合は `--no-default-extensions` で既定拡張を外してから追加します。

既定拡張を使わずに最小構成で試したい場合:

```bash
cd ~/work/repos/yom
uv run yom work --no-default-extensions
```

相対リンクの挙動:

- `./other.md` や `../guide.md` のような Markdown リンクは `yom` 内の表示遷移に変換される
- `./image.png` のような画像パスはローカルアセットとして配信される
- ディレクトリ外を指す参照はそのまま解決されず、外部への読み出しには使えない

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

`watchdog` を明示的に使いたい場合:

```bash
cd ~/work/repos/yom
uv run yom work --watch-mode watchdog
```

ブラウザを自動で開きたくない場合:

```bash
cd ~/work/repos/yom
uv run yom work --no-open
```
