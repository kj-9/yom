## Context

`SettingsPanel`は共有Preact componentだが、現在はdetailsと絶対配置CSSに開閉を任せ、画面端の補正やEscape処理がない。初期payloadにサイト設定は含まれるが、stateとResetへ伝播していない。動機はproposal.mdを参照する。

## Goals / Non-Goals

**Goals:** detailsの構造を維持し、配置とfocusを専用hookへ分離する。サイト既定値と保存値の優先順位をSSR/hydrationで一致させる。

**Non-Goals:** 新しい設定項目、保存キー、UIライブラリは追加しない。

## Decisions

- details/summaryを維持し、開閉を同期する。新しいモーダルを文書ドロワーへ入れ子にせず、設定は非モーダルのパネルとする。
- 固定配置で画面とsidebarの境界を計測し、ResizeObserverとscroll/resizeで補正する。モバイルはsidebar内の下端へ揃えたシートにする。CSSだけでは短いviewportとスクロール後の両方を安定して扱えないため計測を使う。
- Escapeは設定側で処理して伝播を止め、次のEscapeで文書ドロワーを閉じる。Tabは自然な順序で移動し、パネルから離れたら閉じる。
- サイト既定値をSSRとbrowserの同じ生成関数へ渡す。保存値が優先し、Resetでサイト既定値を書き戻す。

## Risks / Trade-offs

- [設定とドロワーのEscape競合] → 設定を先に閉じる処理とE2Eで検証する。
- [viewport変更で画面外へ残る] → 開いている間だけ境界を再計測する。
- [SSRとhydrationの既定値差] → 共通関数とサイト設定付きE2Eで検証する。

## Migration Plan

既存保存キーを維持し、UIと初期設定伝播を同時に更新する。設定schemaと外部APIの移行は不要。
