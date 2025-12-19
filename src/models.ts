export interface ProcessCsvResponse {
  ok: boolean;
  processed: number;
  matched: number;
  appendedCount: number;
  error?: string;
  encodingUsed?: string;
  hitExamples?: unknown[];
  sampleAKeys?: string[];
  sampleCsvKeys?: string[];
}

export interface SheetTarget {
  url: string;
  sheetName?: string;
}

export interface SheetProcessResult {
  sheetUrl: string;
  sheetName?: string;
  ok: boolean;
  processed: number;
  matched: number;
  appendedCount: number;
  duration: number;
  encodingUsed?: string;
  response?: ProcessCsvResponse;
  error?: string;
}
