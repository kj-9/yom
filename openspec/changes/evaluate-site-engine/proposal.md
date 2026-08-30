## Why

Phase 7のUI実装前に、Astro + Starlightへ既存のドキュメントUI責務を委譲できるかだけを短時間で確認したい。全面的な候補比較は行わず、yom固有の外部Markdownルートと閲覧動作に適合するなら採用候補とし、適合しなければVite + Preactへ進む。

## What Changes

- Astro + Starlightの隔離されたgo/no-go spikeを作る。
- 外部Markdownルート、H1タイトルfallback、dev時の追加・変更・削除、raw source表示、本文を含む静的HTMLの5点だけを確認する。
- Starlightの公開APIと浅いcomponent overrideで実現できればgo、内部API、patch、fork、広範なlayout overrideが必要ならno-goと判断する。
- spikeではPreactを導入せず、採用後に独自の対話UIが必要になった場合だけislandとして検討する。
- 結果と採否理由を記録し、goならAstro + Starlight移行、no-goならVite + Preact + Pagefind移行を別のOpenSpec変更として提案する。
- 非目標: 候補間の精密benchmark、本番コードの移行、公開CLIやNode.js互換対応、Phase 7のUI実装はこの変更に含めない。

## Capabilities

### New Capabilities

なし。この変更は技術選定用spikeであり、製品の外部動作を追加しない。

### Modified Capabilities

なし。

## Impact

- `spikes/site-engine/astro-starlight/`に公開経路から隔離した検証コードを追加する。
- `openspec/changes/evaluate-site-engine/evaluation.md`に結果と判断を記録する。
- `src/`、公開package dependencies、CLI、設定形式、READMEは変更しない。
- `phase-7-responsive-navigation`は本変更と後続移行計画が確定するまで保留する。
