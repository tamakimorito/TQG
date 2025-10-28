export interface ProcessCsvResponse {
  ok: boolean;
  processed: number;
  matched: number;
  appendedCount: number;
  error?: string;
  encodingUsed?: string;
  hitExamples?: unknown[];
}
