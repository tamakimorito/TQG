export interface ProcessCsvResponse {
  ok: boolean;
  processed: number;
  matched: number;
  appendedCount?: number;
  updatedCount?: number;
  unmatchedCount?: number;
  fallbackBy?: number;
  version?: string;
  usedSheetName?: string;
  spreadsheetTitle?: string;
  sheetUrl?: string;
  encodingUsed?: string;
  hitExamples?: unknown[];
  sampleAKeys?: string[];
  sampleCsvKeys?: string[];
  error?: string;
  code?: string;
}

export interface ProcessCsvBatchApiResponse {
  ok: boolean;
  results: (ProcessCsvResponse & { sheetUrl: string; spreadsheetTitle?: string; })[];
  version?: string;
  encodingUsed?: string;
  triedEncodings?: string[];
}
