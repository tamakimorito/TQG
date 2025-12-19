# TQG 仕様（v1.3.2）

## アプリ概要
- 単一のCSVを使い、最大5件のスプレッドシートへ連続して処理できるバッチUI。
- CSVのB列をキーにシートA列を突合し、一致行の「右端の次の列」へ `[Q, T, U, V, C]` を横方向に貼り付ける。
- オプション:
  - 文字コード指定（自動判別 / Windows-31J / UTF-8）
  - 「MDQ」で始まるキーのみを照合（mdqOnly）
- 実行結果は合計値（処理時間・行数・一致件数・追記件数・成功/失敗件数）と、シート別の処理詳細・エラーを表示。

## フロントエンド実装メモ
- `SheetApiService.processCsvBatch` で1回のCSV Base64化を使い回し、各シートへ順次 POST。
- ペイロード（共通）:
  - `action: "processCsv"`
  - `sheetUrl: <対象URL>`
  - `sheetName?: <タブ名>`（未指定時はGAS側で先頭/類似名を解決）
  - `csvBase64: <データURLからヘッダ除去したBase64>`
  - `debug: true`
  - `encodingHint?: "Windows-31J" | "Shift_JIS" | "UTF-8"`
  - `mdqOnly?: boolean`
- UIで複数URL入力 + 任意タブ名を受け付け、成功/失敗を個別に表示。最大入力数は5件。

## バックエンド（GAS v1.6.3）要約
- 主処理: `action:"processCsv"`
  - `sheetUrl` 必須、`sheetName` 任意（未指定時は最適タブを選択）。
  - `csvBase64` 必須、`encodingHint` があれば優先。UTF-8/Windows-31J/Shift_JISを自動評価。
  - キー列: CSVヘッダから推定（指定も可）。A列キー（正規化 + 英数字全角/半角吸収 + MDQ形式検出）で突合。必要に応じてフォールバックキー突合（デフォルトセットあり）。
  - 取得列: 見出し名または列記号指定で `["ガス_開始日","ガス_提供状態","ガス_開栓状態","ガス_SW状態","お客様区分","でんき_開始日","でんき_提供状態","でんき_再点状態","でんき_SW状態"]` を抽出し、既存ヘッダがあれば上書き・不足は末尾追加。2099/12/31 は空欄保存。
  - 結果: `{ ok, processed, matchedStrict, matchedFallback, matched, fallbackBy, unmatchedCount, updatedCount, version:'v1.6.3', ... }`（debug時は追加情報付き）。
- レジストリ関連: `action:"registerSheet"` / `action:"listSheets"` が存在（`PROP_KEY_SHEETS` に保存）。

## バージョン
- フロント: v1.3.2（本ドキュメント反映済み）
- GAS: v1.6.3（MDQキー強化 + 列記号抽出 + フォールバック突合 + でんき列追加対応）
