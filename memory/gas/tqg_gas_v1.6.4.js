/***** TQG GAS v1.6.4 (複数スプレッドシート一括処理対応) *****
 * 主な機能:
 *  - シートURLを配列で受け取り、同一CSVを各スプレッドシートへ順次反映
 *  - A列(表示値)をキーにCSVと突合（MDQ想定）。未一致は任意でセカンダリキー突合。
 *  - CSVの [Q,T,U,V,C] 等、列記号で抽出できる (csvPickByLetters)
 *  - でんき系(でんき_開始日/提供状態/再点状態/SW状態)は「既存5列の後ろに H/M/N/O を足す」形で追加抽出可能
 *  - もしくはCSVヘッダ名に基づいて抽出（従来互換）
 *  - 2099/12/31 は空欄保存（ガス/でんき_開始日）
 *  - 見出し名が既にあればその列に上書きし、足りない見出しだけ末尾に新設（重複ヘッダの増殖なし）
 * I/F(JSON):
 *  - action:"processCsv"
 *  - sheetUrls:string[] (sheetUrl:string も後方互換で可)
 *  - sheetName?:string
 *  - csvBase64:string, encodingHint?:"Windows-31J"|"Shift_JIS"|"utf-8"
 *  - debug?:boolean
 *  - mdqOnly?:boolean
 *  - enableFallback?:boolean (default true)
 *  - fallbackKeyPairs?: {sheetHeaderCandidates:string[], csvHeaderCandidates:string[]}[]
 *  - keyColumnName?:string | keyColumnIndex?:number  // CSV側のMDQキー列の明示指定（0始まり）
 *  - csvPickByLetters?: string[]  // 例 ["Q","T","U","V","C","H","M","N","O"]
 *****************************************************************/

const PROP_KEY_SHEETS = 'TQG_SHEETS';
const TARGET_HEADERS = [
  "ガス_開始日",
  "ガス_提供状態",
  "ガス_開栓状態",
  "ガス_SW状態",
  "お客様区分",
  "でんき_開始日",
  "でんき_提供状態",
  "でんき_再点状態",
  "でんき_SW状態",
];
const START_DATE_HEADERS = new Set(["ガス_開始日", "でんき_開始日"]);
const KEY_HEADER_CANDIDATES = ["レコードID","提携先管理番号","管理番号","顧客ID","id","ID","No","番号","申込番号","申込ID"];

const DEFAULT_FALLBACK_KEY_PAIRS = [
  { // 現お客様番号 ←→ お客様番号
    // ↓ここに実際の列名を追加しました
    sheetHeaderCandidates: ["現ガスお客様番号", "現電力お客様番号", "現お客様番号", "お客様番号", "現お客様番号番号"],
    csvHeaderCandidates:   ["お客様番号", "顧客番号", "お客様ID", "現お客様番号"]
  },
{ // 現供給地点番号 ←→ 供給地点番号
    // ↓ここに実際の列名を追加
    sheetHeaderCandidates: ["現ガス供給地点特定番号", "現電力供給地点特定番号", "現供給地点番号", "現供給地点特定番号", "供給地点番号"],
    csvHeaderCandidates:   ["供給地点特定番号", "供給地点番号", "現供給地点番号"]
  }
];

// ---------- Common ----------
const RESP = (ok, payload = {}) =>
  ContentService.createTextOutput(JSON.stringify({ ok, ...payload }))
    .setMimeType(ContentService.MimeType.JSON);

const errResp = (code, phase, message, detail, context) =>
  RESP(false, { code, phase, error: message, detail: detail!=null?String(detail):undefined, context });

// ---------- Normalizers ----------
function normalizeWidth(s){ if(s==null)return ''; return String(s).replace(/^[\s\u3000]+|[\s\u3000]+$/g,'').normalize('NFKC').replace(/^[\s\u3000]+|[\s\u3000]+$/g,''); }
function normalizeKey(s){ return normalizeWidth(s).replace(/[\u200B-\u200D\uFEFF]/g,'').toUpperCase(); }
function canonicalizeLabel(s){ return normalizeWidth(s).replace(/[()\[\]{}〈〉《》「」『』【】・,，．。\.\-＿_/\s　:：;；]/g,'').toLowerCase(); }
function alnumOnlyUpper(s){ return normalizeKey(s).replace(/[^0-9A-Z]/g,''); }
function digitsOnly(s){ return normalizeWidth(s).replace(/[^0-9]/g,''); }
function looksLikeMDQ(s){ return /^MDQ[0-9]+$/.test(normalizeKey(s)); }

// ---------- CSV ----------
function parseCsvBase64Smart(b64, hint){
  const bytes=Utilities.base64Decode(b64);
  const cands = hint ? [hint,'Windows-31J','Shift_JIS','utf-8'] : ['utf-8','Windows-31J','Shift_JIS'];
  let best={rows:[],enc:'utf-8',score:-1,badCharRate:1};
  for(const enc of cands){
    try{
      const text=Utilities.newBlob(bytes).getDataAsString(enc);
      const bad=(text.match(/\uFFFD/g)||[]).length, total=text.length||1;
      const rows=Utilities.parseCsv(text), rc=rows?.length||0, commas=(text.match(/,/g)||[]).length;
      const score=(rc*10)+commas-(bad/total*1000);
      if(rc>0 && (score>best.score || (score===best.score && (bad/total)<best.badCharRate))) best={rows,enc,score,badCharRate:(bad/total)};
    }catch(_){ }
  }
  return { rows:(best.rows||[]).filter(r=>Array.isArray(r)&&r.length>0), enc:best.enc, tried:cands };
}
function buildCsvHeaderIndex(csv){
  const h=csv[0]||[], m={};
  for(let i=0;i<h.length;i++){ const canon=canonicalizeLabel(h[i]||''); if(canon) m[canon]=i; }
  return m;
}
function detectKeyColumnIndex(csv, headerIdx){
  for(const name of KEY_HEADER_CANDIDATES){ const canon=canonicalizeLabel(name); if(headerIdx[canon]!=null) return { idx: headerIdx[canon], reason:'header:'+name }; }
  const limit=Math.min(1000,csv.length-1), maxCol=Math.min(200,(csv[0]||[]).length);
  let best={idx:1,rate:-1};
  for(let c=0;c<maxCol;c++){
    let cnt=0, mdq=0; for(let r=1;r<=limit;r++){ const v=csv[r]?.[c]; if(v==null||v==='') continue; cnt++; if(looksLikeMDQ(v)) mdq++; }
    const rate=cnt?(mdq/cnt):0; if(rate>best.rate) best={idx:c,rate};
  }
  return { idx:best.idx, reason:'mdqRate:'+best.rate.toFixed(3) };
}

// ---------- Sheet ----------
function openByUrl(url){ return SpreadsheetApp.openByUrl(url); }
function resolveSheet(ss,name){
  const sheets=ss.getSheets(); if(!sheets.length) throw new Error('シートにタブがありません');
  if(!name) return ss.getActiveSheet()||sheets[0];
  const norm=s=>normalizeWidth(s).toLowerCase(); const nt=norm(name);
  return ss.getSheetByName(name) || sheets.find(sh=>norm(sh.getName())===nt) || sheets.find(sh=>{const nm=norm(sh.getName()); return nm.includes(nt)||nt.includes(nm);}) || sheets[0];
}
function ensureHeaderColumns(sheet, headers){
  const lastCol=Math.max(sheet.getLastColumn(),1);
  const values= (lastCol>0)? sheet.getRange(1,1,1,lastCol).getDisplayValues()[0] : [];
  const canonToCol=new Map();
  for(let c=0;c<values.length;c++){
    const lab=values[c];
    const canon=canonicalizeLabel(lab);
    if(!canon || canonToCol.has(canon)) continue; // 既存ヘッダを最優先で再利用
    canonToCol.set(canon, c+1);
  }
  const res={}, missing=[];
  for(const h of headers){ const col=canonToCol.get(canonicalizeLabel(h)); if(col) res[h]=col; else missing.push(h); }
  if(missing.length){ const start=sheet.getLastColumn()+1; sheet.insertColumnsAfter(sheet.getLastColumn()||1, missing.length); sheet.getRange(1,start,1,missing.length).setValues([missing]); for(let i=0;i<missing.length;i++) res[missing[i]]=start+i; }
  return res;
}
function buildAColumnMap(sheet){
  const lastRow=sheet.getLastRow(); const m1=new Map(), m2=new Map(); if(lastRow<1) return { map1:m1, map2:m2 };
  const disp=sheet.getRange(1,1,lastRow,1).getDisplayValues();
  for(let i=0;i<disp.length;i++){ const v=disp[i][0]; const k1=normalizeKey(v), k2=alnumOnlyUpper(v); if(k1 && !m1.has(k1)) m1.set(k1,{rowIndex:i+1}); if(k2 && !m2.has(k2)) m2.set(k2,{rowIndex:i+1}); }
  return { map1:m1, map2:m2 };
}
function buildSheetValueMap(sheet, sheetHeaderCandidates){
  const lastCol=sheet.getLastColumn(), lastRow=sheet.getLastRow(); if(lastCol<1||lastRow<1) return { col:null, map:new Map(), numeric:false };
  const headerVals=sheet.getRange(1,1,1,lastCol).getDisplayValues()[0];
  const canonToCol=new Map(); for(let c=0;c<headerVals.length;c++){ const lab=headerVals[c]; if(!lab) continue; canonToCol.set(canonicalizeLabel(lab), c+1); }
  let col=null; for(const name of sheetHeaderCandidates){ const got=canonToCol.get(canonicalizeLabel(name)); if(got){ col=got; break; } }
  if(!col) return { col:null, map:new Map(), numeric:false };

  const colVals=sheet.getRange(1,col,lastRow,1).getDisplayValues();
  let numCnt=0, sampleCnt=0;
  for(let i=1;i<Math.min(lastRow,1000);i++){ const v=colVals[i]?.[0]||''; if(v==='') continue; sampleCnt++; if(/^[0-9０-９\-‐-–—―]+$/.test(v)) numCnt++; }
  const numeric = sampleCnt ? (numCnt/sampleCnt>0.6) : false;

  const map=new Map();
  for(let i=1;i<lastRow;i++){
    const v=colVals[i]?.[0]||''; if(!v) continue;
    const key = numeric ? digitsOnly(v) : normalizeKey(v);
    if(!key) continue; if(!map.has(key)) map.set(key,{ rowIndex:i+1 });
  }
  return { col, map, numeric };
}

// ---------- 値抽出 ----------
function normalizeStartDateValue(v){
  const s=normalizeWidth(v);
  const is2099 = s==='2099/12/31' || s==='2099-12-31' ||
    (v instanceof Date && v.getFullYear?.()===2099 && v.getMonth?.()===11 && v.getDate?.()===31);
  return is2099 ? '' : v;
}

function extractCsvValuesByHeaders(csvRow, csvHeaderIdxMap){
  const out=[];
  for(const name of TARGET_HEADERS){
    const idx = csvHeaderIdxMap[canonicalizeLabel(name)];
    const v  = (idx!=null && csvRow.length>idx)? csvRow[idx] : '';
    out.push(START_DATE_HEADERS.has(name) ? normalizeStartDateValue(v) : v);
  }
  while(out.length<TARGET_HEADERS.length) out.push('');
  return out;
}

// 列記号 "A".."Z","AA".. を 0-based index に
function colLetterToIndex0(letter) {
  const s=String(letter||'').trim().toUpperCase();
  if(!/^[A-Z]+$/.test(s)) return null;
  let n=0; for(let i=0;i<s.length;i++){ n=n*26+(s.charCodeAt(i)-64); }
  return n-1;
}

// 列インデックス指定で抽出
function extractCsvValuesByIndexes(csvRow, idxes){
  const out=[];
  for(let j=0;j<TARGET_HEADERS.length;j++){
    const idx=idxes[j];
    const v=(idx!=null && csvRow.length>idx)? csvRow[idx] : '';
    out.push(START_DATE_HEADERS.has(TARGET_HEADERS[j]) ? normalizeStartDateValue(v) : v);
  }
  while(out.length<TARGET_HEADERS.length) out.push('');
  return out;
}

// ---------- Misc ----------
function overlaps(r1,r2){ const r1r=r1.getRow(), r1c=r1.getColumn(), r1h=r1.getNumRows(), r1w=r1.getNumColumns(); const r2r=r2.getRow(), r2c=r2.getColumn(), r2h=r2.getNumRows(), r2w=r2.getNumColumns(); return !(r1r+r1h-1<r2r||r2r+r2h-1<r1r||r1c+r1w-1<r2c||r2c+r2w-1<r1c); }
function roleInfo(ss){ let eff=''; try{eff=Session.getEffectiveUser()?.getEmail?.()||'';}catch(e){} const owners=[]; try{const o=ss.getOwner(); if(o) owners.push(o.getEmail());}catch(e){} let editors=[]; try{editors=ss.getEditors().map(u=>u.getEmail());}catch(e){} const isOwner=owners.includes(eff); const isEditor=editors.includes(eff)||isOwner; return { effectiveUser:eff, owners, editors, role:(isOwner?'owner':(isEditor?'editor':'viewer')) }; }

// ---------- Router ----------
function doPost(e){
  try{
    let body={}; try{ body=JSON.parse(e.postData && e.postData.contents || '{}'); }catch(_){ body={}; }
    const { action } = body;

    if(action==='processCsv'){
      const { sheetUrl, sheetUrls:rawSheetUrls, csvBase64, sheetName, debug, encodingHint,
              mdqOnly, enableFallback=true, fallbackKeyPairs,
              keyColumnName, keyColumnIndex,
              csvPickByLetters } = body;

      const sheetUrlList = Array.isArray(rawSheetUrls) ? rawSheetUrls : (sheetUrl ? [sheetUrl] : []);
      const targets = sheetUrlList.map(s=>normalizeWidth(s)).filter(Boolean);
      if(!targets.length) return errResp('BAD_REQUEST','input','sheetUrl が未選択です');
      if(!csvBase64) return errResp('BAD_REQUEST','input','csvBase64 が空です');

      // parse CSV
      let parsed={rows:[],enc:'utf-8',tried:[]}; try{ parsed=parseCsvBase64Smart(csvBase64, encodingHint); }
      catch(pcErr){ return errResp('CSV_PARSE_ERROR','parseCsv','CSV parseに失敗しました',pcErr); }
      const csv=parsed.rows; if(!csv.length) return errResp('CSV_EMPTY_OR_ENCODING','parseCsv','CSVが空です（文字コード不一致の可能性）',null,{triedEncodings:parsed.tried});

      // header
      const csvHeaderIdx=buildCsvHeaderIndex(csv);

      // キー列（MDQ）
      let keyIdx=null, keyReason='';
      if(typeof keyColumnIndex==='number' && keyColumnIndex>=0){ keyIdx=keyColumnIndex; keyReason='override:index'; }
      else if(keyColumnName){ const c=csvHeaderIdx[canonicalizeLabel(keyColumnName)]; if(c==null) return errResp('KEYCOL_NOT_FOUND','detectKey','指定の keyColumnName がCSVヘッダにありません',null,{keyColumnName}); keyIdx=c; keyReason='override:name'; }
      else { const det=detectKeyColumnIndex(csv, csvHeaderIdx); keyIdx=det.idx; keyReason=det.reason; }

      // CSVの抽出方式（列記号優先）
      let csvPickIdxes = null;
      if (Array.isArray(csvPickByLetters)) {
        const idxes = csvPickByLetters.map(colLetterToIndex0);
        const hasInvalid = idxes.some(v => v==null || v<0);
        const isLegacy5 = idxes.length === 5;
        const isExtended = idxes.length === TARGET_HEADERS.length;
        if (!hasInvalid && (isLegacy5 || isExtended)) {
          const padded = idxes.slice(0, TARGET_HEADERS.length);
          while (padded.length < TARGET_HEADERS.length) padded.push(null);
          csvPickIdxes = padded;
        }
      }

      // per-sheet processor
      function processOneSheet(targetUrl){
        try{
          let ss; try{ ss=openByUrl(targetUrl); }
          catch(openErr){ return { ok:false, sheetUrl:targetUrl, code:'OPEN_FAILED', error:'スプレッドシートを開けませんでした', detail:String(openErr) }; }
          const sheetTitle = ss.getName && ss.getName();
          const role=roleInfo(ss); // 取得のみ
          let sheet, usedSheetName; try{ sheet=resolveSheet(ss, sheetName); usedSheetName=sheet.getName(); }
          catch(rsErr){ return { ok:false, sheetUrl:targetUrl, sheetTitle, code:'SHEET_NOT_FOUND', error:'指定タブが見つかりません', detail:String(rsErr) }; }

          const headerColsMap=ensureHeaderColumns(sheet, TARGET_HEADERS);
          const { map1:aMapStrict, map2:aMapAlnum } = buildAColumnMap(sheet);

          const fkPairs = Array.isArray(fallbackKeyPairs) && fallbackKeyPairs.length ? fallbackKeyPairs : DEFAULT_FALLBACK_KEY_PAIRS;
          const fallbackSheets = [];
          if(enableFallback){
            for(const pair of fkPairs){
              const sh = buildSheetValueMap(sheet, pair.sheetHeaderCandidates||[]);
              if(sh.col){
                const csvIdxes=[];
                for(const nm of (pair.csvHeaderCandidates||[])){ const idx=csvHeaderIdx[canonicalizeLabel(nm)]; if(idx!=null) csvIdxes.push(idx); }
                if(csvIdxes.length) fallbackSheets.push({ sheetCol:sh.col, sheetMap:sh.map, numeric:sh.numeric, csvIdxes });
              }
            }
          }

          let processed=0, matchedStrict=0, matchedFallback=0, fallbackBy=0, updatedCount=0, unmatchedCount=0;
          const fallbackExamples=[], unmatchedSamples=[];

          for(let i=1;i<csv.length;i++){ // 1行目はヘッダ想定
            const row=csv[i]; if(!row) continue;
            const rawKey=row[keyIdx];
            const kStrict=normalizeKey(rawKey), kAlnum=alnumOnlyUpper(rawKey);
            if(mdqOnly && !looksLikeMDQ(rawKey)) continue;
            processed++;

            // 1) A列(MDQ)突合
            let hit=aMapStrict.get(kStrict);
            if(!hit && kAlnum) hit=aMapAlnum.get(kAlnum);

            // 2) セカンダリ
            let usedFallback=null;
            if(!hit && enableFallback){
              outer: for(const fb of fallbackSheets){
                for(const idx of fb.csvIdxes){
                  const v=row[idx]; if(v==null||v==='') continue;
                  const key = fb.numeric ? digitsOnly(v) : normalizeKey(v);
                  if(!key) continue;
                  const h=fb.sheetMap.get(key);
                  if(h){ hit=h; usedFallback={sheetCol:fb.sheetCol, csvIdx:idx, numeric:fb.numeric}; break outer; }
                }
              }
            }

            if(!hit){ unmatchedCount++; if(unmatchedSamples.length<10) unmatchedSamples.push({csvRow:i+1, mdqRaw:rawKey}); continue; }
            if(usedFallback){ fallbackBy++; if(fallbackExamples.length<5) fallbackExamples.push({csvRow:i+1, viaCsvIdx:usedFallback.csvIdx}); }
            else { if(looksLikeMDQ(rawKey)) matchedStrict++; else matchedFallback++; }

            const vals = csvPickIdxes ? extractCsvValuesByIndexes(row, csvPickIdxes)
                                      : extractCsvValuesByHeaders(row, csvHeaderIdx);

            try{
              for(let j=0;j<TARGET_HEADERS.length;j++){
                const col=headerColsMap[TARGET_HEADERS[j]];
                sheet.getRange(hit.rowIndex, col, 1, 1).setValue(vals[j]);
              }
              updatedCount++;
            }catch(writeErr){
              return {
                ok:false,
                sheetUrl:targetUrl,
                sheetTitle,
                usedSheetName,
                code:'PERMISSION_DENIED',
                error:'書き込みに失敗しました。編集権限または保護設定を確認してください。',
                detail:String(writeErr),
                triedEncodings:parsed.tried,
                encodingUsed:parsed.enc,
                headerColsMap,
                keyColumnDetected:{index:keyIdx, reason:keyReason},
                csvPickIdxes
              };
            }
          }

          const base={ processed, matchedStrict, matchedFallback, matched:(matchedStrict+matchedFallback), fallbackBy, unmatchedCount, updatedCount };
          const debugInfo = debug ? { fallbackExamples } : {};
          return {
            ok:true,
            sheetUrl:targetUrl,
            sheetTitle,
            usedSheetName,
            ...base,
            version:'v1.6.4',
            encodingUsed:parsed.enc,
            triedEncodings:parsed.tried,
            keyColumnDetected:{index:keyIdx, reason:keyReason},
            csvPickIdxes,
            ...debugInfo
          };
        }catch(err){
          return { ok:false, sheetUrl:targetUrl, error:'未処理例外が発生しました', detail:String(err) };
        }
      }

      const results = targets.map(processOneSheet);
      const overallOk = results.every(r => r.ok);
      return RESP(overallOk, { results, encodingUsed: parsed.enc, triedEncodings: parsed.tried, version:'v1.6.4' });
    }

    if(action==='registerSheet'){
      const { name, url } = body;
      if(!name || !url) return errResp('BAD_REQUEST','registerSheet','name と url は必須です');
      if(!/https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url))
        return errResp('BAD_REQUEST','registerSheet','シートURL形式が不正です', null, { url });
      const list = loadRegistry(); const exist=list.find(x=>x.url===url); if(exist) exist.name=name; else list.push({name,url});
      saveRegistry(list); return RESP(true,{ sheets:list, version:'v1.6.4' });
    }

    if(action==='listSheets'){ return RESP(true,{ sheets: loadRegistry(), version:'v1.6.4' }); }

    return errResp('UNKNOWN_ACTION','router','unknown action',null,{action});
  }catch(err){ return errResp('UNCAUGHT','top','未処理例外が発生しました', err); }
}

// ---------- Registry ----------
function loadRegistry(){ const raw=PropertiesService.getScriptProperties().getProperty(PROP_KEY_SHEETS); try{ return raw?JSON.parse(raw):[] }catch{return[]} }
function saveRegistry(list){ PropertiesService.getScriptProperties().setProperty(PROP_KEY_SHEETS, JSON.stringify(list||[])); }
