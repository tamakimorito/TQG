export interface ProcessCsvSheetResult {
  ok: boolean;
  sheetUrl: string;
  sheetTitle?: string;
  usedSheetName?: string;
  processed: number;
  matched: number;
  matchedStrict?: number;
  matchedFallback?: number;
  fallbackBy?: number;
  updatedCount?: number;
  appendedCount?: number;
  unmatchedCount?: number;
  error?: string;
  code?: string;
  detail?: string;
  encodingUsed?: string;
  triedEncodings?: string[];
  keyColumnDetected?: {
    index: number;
    reason: string;
  };
  csvPickIdxes?: (number | null)[];
  fallbackExamples?: unknown[];
}

export interface ProcessCsvResponse {
  ok: boolean;
  version?: string;
  results: ProcessCsvSheetResult[];
  error?: string;
  detail?: string;
  encodingUsed?: string;
  triedEncodings?: string[];
}
