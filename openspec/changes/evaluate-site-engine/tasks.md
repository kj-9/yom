## 1. 隔離spikeの準備

- [x] 1.1 `spikes/site-engine/astro-starlight/`へ独立packageと、frontmatterなしのH1文書、入れ子文書、raw確認用文書を含む最小fixtureを追加し、rootの`package.json`、`bun.lock`、`src/`に差分がないことを確認する。
- [x] 1.2 Astro + Starlightを標準構成で起動・buildできる最小siteを作り、spike package内のcheckとbuildが成功することを確認する。

## 2. Go/No-Go条件の検証

- [x] 2.1 custom content loaderで任意の外部fixture rootを読み込み、frontmatterなしのtitleをH1から補完し、言語未指定を`und`として扱えることを自動検証する。
- [x] 2.2 dev中のMarkdown追加、変更、削除を再起動なしで反映し、文書一覧と本文が各操作後に更新されることを自動検証する。
- [x] 2.3 raw source表示をStarlightの公開APIと2個以下の浅いcomponent overrideで追加し、rendered表示との切り替えをE2Eで確認する。
- [x] 2.4 static buildしたHTMLへMarkdown本文が含まれ、JavaScriptを無効にしたbrowserでも本文と文書navigationを読めることをE2Eで確認する。

## 3. 判断と全体確認

- [x] 3.1 `evaluation.md`へ5条件のpass／fail、使用した公開API、override一覧、依存install容量と初期build asset容量の概算、go／no-go理由、後続移行変更の範囲を記録し、designの判断規則と結論が一致することを確認する。
- [x] 3.2 `openspec validate evaluate-site-engine --strict`と`./scripts/check.sh`を実行し、OpenSpec整合性と既存projectの全検証が成功することを確認する。
