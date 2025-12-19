# 仕様 (v1.3.2)
- 対象: TQG フロントエンド + GAS 連携。
- バージョン規則: 0.01刻み。今回のアプリ版は **v1.3.2**、GASスクリプトは **v1.6.4**。

## フロントエンドフロー
1. スプレッドシートURLを改行区切りで入力（最低1件、全て `https://docs.google.com/spreadsheets/d/` で始まること）。
2. CSVファイルを1件アップロード。全てのシートに同じCSVを適用する。
3. 任意設定: 文字コード指定（自動/Windows-31J/UTF-8）、`MDQ` 始まりのみ照合のフィルタ。
4. 実行時に確認ダイアログを表示し、一括で処理。結果はシート単位でタイトル（spreadsheetTitle or タブ名 or URL由来の識別子）、URL、小計（processed/matched/updatedCount など）をカード表示する。
5. 成功/失敗件数と総処理時間をヘッダで表示。失敗したシートはエラーメッセージを明示する。

## API連携
- 基本エンドポイント: `https://script.google.com/macros/s/AKfycbwhG8ut__PrT9WCYiug4WqXO-nl2y2SEF8_DB6isn0PiClrWGP9Qy61UpBaSWunip0O/exec`
- 送信形式: `POST` JSON。GAS v1.6.4 では `processCsvBatch` を推奨（複数URL同時）。未対応環境では `processCsv` に順次フォールバック。
- 共通ペイロード項目:
  - `csvBase64`: CSVのBase64文字列（全シート共通）。
  - `sheetUrls`: string[] （batch用）、または `sheetUrl` （single用）。
  - `sheetName`: 既定は `フォームの回答 1` 。
  - `encodingHint?`: `Windows-31J` | `Shift_JIS` | `UTF-8` | undefined。
  - `mdqOnly?`: boolean。
  - `csvPickByLetters?`: 列記号指定（A,B,…）。5列 or TARGET_HEADERS長で有効。
- レスポンス（batch）:
  - `ok`: true 固定、`results`: 各シートの結果配列。
  - 各要素: `{ ok, sheetUrl, spreadsheetTitle?, usedSheetName?, processed, matched, matchedStrict?, matchedFallback?, updatedCount, unmatchedCount?, fallbackBy?, version }`。エラー時は `{ ok:false, sheetUrl, code, error, detail?, context? }`。
  - `encodingUsed`, `triedEncodings` はCSV解析情報。
- レスポンス（single）: 上記1件分を直接返却。
- デバッグ時（`debug:true`）は `encodingUsed`・`headerColsMap`・`keyColumnDetected`・`fallbackExamples`・`csvPickIdxes` を含む。

## GASスクリプト
- ファイル: `memory/tqg-gas-v1.6.4.js`
- 役割: CSVを1回パースし、`processCsvBatch` で複数シートを一括処理。`processCsv` は互換性維持。
- 主なロジック:
  - A列キー（正規化MDQ/英数字）で突合。未一致時は `DEFAULT_FALLBACK_KEY_PAIRS` に基づき補助列突合。
  - `TARGET_HEADERS` の列を確保し、既存列があれば上書き、なければ末尾に新設。
  - 日付2099/12/31は空欄扱い。
  - 列記号指定（5列 or 9列）とヘッダ名抽出の両対応。
  - レスポンスに `spreadsheetTitle` と `sheetUrl` を付加。

## ドキュメント運用
- 変更時は `memory/changelog.md` にエントリを追加（日付 + バージョン + 1行概要）。
- `memory/rules.md` に手順・制約を追記し、旧コードや互換情報がある場合は参考節として残す。
- GASコードの更新は `memory/` 配下に保存し、ファイル名・バージョンを明記する。
