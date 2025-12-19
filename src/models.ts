export interface ProcessCsvResponse {
  ok: boolean;
  processed: number;
  matched: number;
  matchedStrict?: number;
  matchedFallback?: number;
  fallbackBy?: number;
  unmatchedCount?: number;
  updatedCount?: number;
  appendedCount?: number; // 旧版互換
  error?: string;
  code?: string;
  phase?: string;
  detail?: string;
  context?: unknown;
  encodingUsed?: string;
  hitExamples?: unknown[];
  sampleAKeys?: string[];
  sampleCsvKeys?: string[];
  usedSheetName?: string;
  keyColumnDetected?: { index: number; reason: string };
  csvPickIdxes?: (number | null)[];
  headerColsMap?: Record<string, number>;
  fallbackExamples?: unknown[];
  version?: string;
}

export interface SheetTarget {
  sheetUrl: string;
  sheetName?: string;
}

export interface ProcessCsvResult {
  target: SheetTarget;
  response: ProcessCsvResponse;
  duration: number;
}
