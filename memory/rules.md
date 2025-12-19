# 開発ルール v1.3.2
- 仕様・履歴・ルールの更新時は `changelog.md` と `spec.md` を 0.01 刻みでバージョン更新すること。
- ユーザー向けUIメッセージは日本語で統一すること（英数字のAPI名などは原文可）。
- スプレッドシートURL入力は改行区切りの複数対応が前提。無効URLは送信させない。
- GASの最新実装ファイルは `memory/gas/tqg_gas_v1.6.4.js`。バックエンド変更時はここを更新する。
- 既存の処理仕様は `memory/spec.md` を必ず参照し、差分のみを最小限で加えること。

---

## 旧GASリファレンス（v1.3.1）

/***** TQG GAS v1.3.1 (from scratch) *****/

const PROP_KEY_SHEETS = 'TQG_SHEETS';
const RESP = (ok, payload = {}) =>
  ContentService.createTextOutput(JSON.stringify({ ok, ...payload }))
    .setMimeType(ContentService.MimeType.JSON);

// ===== Helpers =====

// 全角英数字を半角に正規化。前後空白も除去。
function normalizeAlphanumeric(str) {
  if (str == null) return '';
  return String(str)
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

// NFKC正規化、不可視文字除去、大文字化。キー比較用。
function normalizeKey(str) {
  if (str == null) return '';
  return String(str)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅スペース等の不可視文字
    .trim()
    .toUpperCase();
}

// Base64 CSV → 2D 配列（UTF-8/Shift_JIS自動判別）
function parseCsvBase64(b64) {
  const bytes = Utilities.base64Decode(b64);
  const blob = Utilities.newBlob(bytes);
  let text, encodingUsed;

  try {
    text = blob.getDataAsString('utf-8');
    Utilities.parseCsv(text); // test parsing
    encodingUsed = 'UTF-8';
  } catch (e) {
    try {
      text = blob.getDataAsString('shift_jis');
      Utilities.parseCsv(text); // test parsing
      encodingUsed = 'Shift_JIS';
    } catch (e2) {
      throw new Error('CSVの解析に失敗しました。UTF-8 と Shift_JIS 両方でデコードを試みましたが、不正な形式です。');
    }
  }

  const rows = Utilities.parseCsv(text);
  return {
    rows: rows.filter(r => Array.isArray(r) && r.length > 0),
    encodingUsed,
  };
}

function loadRegistry() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY_SHEETS);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveRegistry(list) {
  PropertiesService.getScriptProperties().setProperty(PROP_KEY_SHEETS, JSON.stringify(list || []));
}

function openByUrl(url) { return SpreadsheetApp.openByUrl(url); }

// A列（1列目）のキーMap（正規化キー → 行番号(1-based)）
function buildAColumnMap(sheet) {
  const lastRow = sheet.getLastRow();
  const map = new Map();
  if (lastRow < 1) return map;
  const values = sheet.getRange(1, 1, lastRow, 1).getValues(); // A列
  for (let i = 0; i < values.length; i++) {
    const key = normalizeKey(values[i][0]);
    if (key && !map.has(key)) map.set(key, { rowIndex: i + 1 });
  }
  return map;
}

// 指定行の [Q,T,U,V,C] を返す
function pickQ_T_U_V_C(sheet, rowIndex) {
  // A=1, C=3, Q=17, T=20, U=21, V=22
  const cols = [17, 20, 21, 22, 3];
  return cols.map(c => sheet.getRange(rowIndex, c).getValue());
}

// 指定行の右端の実データ列番号（空白終端除外）。データ無ければ 0。
function lastFilledColOfRow(sheet, rowIndex) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return 0;
  const rowVals = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  for (let c = lastCol; c >= 1; c--) {
    const v = rowVals[c - 1];
    if (v !== '' && v !== null) return c;
  }
  return 0;
}

// ===== Router =====
function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents || '{}');
    const action = body.action;

    if (action === 'listSheets') {
      return RESP(true, { sheets: loadRegistry(), version: 'v1.3.1' });
    }

    if (action === 'registerSheet') {
      const { name, url } = body;
      if (!name || !url) return RESP(false, { error: 'name と url は必須です' });
      if (!/https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url)) {
        return RESP(false, { error: 'シートURL形式が不正です' });
      }
      const list = loadRegistry();
      const exist = list.find(x => x.url === url);
      if (exist) exist.name = name; else list.push({ name, url });
      saveRegistry(list);
      return RESP(true, { sheets: list, version: 'v1.3.1' });
    }

    if (action === 'processCsv') {
      const { sheetUrl, csvBase64, debug } = body;
      if (!sheetUrl) return RESP(false, { error: 'sheetUrl が未選択です' });
      if (!csvBase64) return RESP(false, { error: 'csvBase64 が空です' });

      const ss = openByUrl(sheetUrl);
      const sheet = ss.getActiveSheet(); // 必要なら getSheetByName('タブ名') で固定可

      const { rows: csv, encodingUsed } = parseCsvBase64(csvBase64);
      if (!csv.length) return RESP(false, { error: 'CSVが空です' });

      // 先頭行が見出し（B列に "b/Ｂ/No/番号/id" 等）と推定できる場合は飛ばす
      let startIdx = 0;
      if (csv[0] && /^(b|Ｂ|no|番号|id)$/i.test(String(csv[0][1] || '').trim())) startIdx = 1;

      const aMap = buildAColumnMap(sheet);

      const sampleAKeys = debug ? Array.from(aMap.keys()).slice(0, 10) : undefined;
      const sampleCsvKeys = debug ? [] : undefined;
      const hitExamples = debug ? [] : undefined;

      let processed = 0, matched = 0, appendedCount = 0;
      for (let i = startIdx; i < csv.length; i++) {
        const row = csv[i];
        // B列が無い行はスキップ
        if (!row || row.length < 2) continue;

        processed++;
        const key = normalizeKey(row[1]);
        if (!key) continue;
        
        if (debug && sampleCsvKeys.length < 10) sampleCsvKeys.push(key);

        const hit = aMap.get(key);
        if (!hit) continue;

        matched++;
        if (debug && hitExamples.length < 5) {
          hitExamples.push({ csvKey: key, sheetRow: hit.rowIndex, csvRawB: row[1] });
        }
        
        const vals = pickQ_T_U_V_C(sheet, hit.rowIndex); // [Q,T,U,V,C]
        const lastCol = lastFilledColOfRow(sheet, hit.rowIndex);
        const writeCol = (lastCol || 0) + 1;
        sheet.getRange(hit.rowIndex, writeCol, 1, vals.length).setValues([vals]);
        appendedCount++;
      }
      
      const responsePayload = { processed, matched, appendedCount, version: 'v1.3.1' };
      if (debug) {
        responsePayload.encodingUsed = encodingUsed;
        responsePayload.sampleAKeys = sampleAKeys;
        responsePayload.sampleCsvKeys = sampleCsvKeys;
        responsePayload.hitExamples = hitExamples;
      }
      return RESP(true, responsePayload);
    }

    return RESP(false, { error: 'unknown action' });

  } catch (err) {
    return RESP(false, { error: String(err && (err.stack || err.message) || err) });
  }
}
