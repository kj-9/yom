# document-discovery-integrity Specification

## Purpose

大規模なMarkdownツリーでも無視対象や設定による除外を確実に適用し、利用者が意図した文書だけを初期表示とナビゲーションへ含める。

## Requirements

### Requirement: 無視対象を規模にかかわらず既定で除外する

yomはGit管理下のrootを走査するとき、候補パス数や無視対象の出力量にかかわらず、`.gitignore`で無視されたファイルとディレクトリを既定では文書・asset・初期表示候補へ含めてはならない（MUST NOT）。明示的な`includeIgnored`だけがこの既定を限定的に上書きできる。

#### Scenario: 大きな依存ディレクトリを含むrootを開く

- **WHEN** `.gitignore`で除外されたディレクトリ内に、標準のprocess bufferを超える量のMarkdownとassetが存在するrootを開く
- **THEN** 無視対象は文書ツリー、検索対象、asset一覧、初期表示候補へ現れず、無視されていない文書から初期表示が選ばれる

#### Scenario: 無視対象ディレクトリがネストしている

- **WHEN** rootまたは下位ディレクトリのignore規則がディレクトリ全体を除外する
- **THEN** yomはその配下を公開文書として列挙しない

### Requirement: 無視対象を限定的にopt-inできる

yomは`includeIgnored`をroot相対pathのglob配列として受け取り、`.gitignore`対象のうち一致した文書とassetだけを公開対象として再び含めなければならない（MUST）。この設定はgitignore判定だけを上書きし、dot prefixによる既存の非公開規則や他の公開範囲規則を暗黙に解除してはならない（MUST NOT）。

#### Scenario: 無視された生成文書を公開する

- **WHEN** `.gitignore`が`docs/generated/`を除外し、`includeIgnored`へ`docs/generated/**`を設定する
- **THEN** includeとexcludeの条件も満たす生成Markdownは文書ツリーと検索対象へ含まれる

#### Scenario: opt-inした文書のassetをbuildする

- **WHEN** `includeIgnored`に一致する文書が同じopt-in範囲内の画像を参照する
- **THEN** devは画像を配信し、static buildは既存のasset規則に従って画像を成果物へ含める

#### Scenario: 無視された親の一部だけをopt-inする

- **WHEN** 無視されたディレクトリの子孫だけに一致する`includeIgnored` globを設定する
- **THEN** yomは一致候補へ到達するために必要な祖先を走査するが、一致しない兄弟の文書とassetは公開しない

#### Scenario: includeIgnoredを省略する

- **WHEN** 既存設定が`includeIgnored`を指定しない
- **THEN** yomは空配列として扱い、すべてのgitignore対象を従来どおり除外する

### Requirement: 無視判定の失敗を明示する

Git管理下のrootで無視判定を完了できない場合、yomは無視対象を公開文書として扱うのではなく、原因を示すエラーで起動またはbuildを停止しなければならない（MUST）。

#### Scenario: Gitの無視判定が異常終了する

- **WHEN** Git executableの起動またはignore照会が正常に完了できない
- **THEN** CLIは無視判定に失敗したことと対象rootを示し、無視対象を含むサイトを生成しない

### Requirement: 公開範囲設定の優先順位を維持する

yomは文書pathが`include`に一致し、`exclude`に一致せず、かつgitignore対象外または`includeIgnored`に一致するときだけ、その文書を公開しなければならない（MUST）。`exclude`は`includeIgnored`より優先しなければならない（MUST）。

#### Scenario: 設定とgitignoreを併用する

- **WHEN** rootにgitignore規則、include、exclude、includeIgnoredが存在する
- **THEN** 文書ツリーにはすべての公開条件を満たすMarkdownだけが含まれる

#### Scenario: opt-inしたpathをexcludeする

- **WHEN** 同じ文書pathが`includeIgnored`と`exclude`の両方に一致する
- **THEN** その文書は文書ツリー、検索対象、初期表示候補へ含まれない
