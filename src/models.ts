export interface ProcessCsvResponse {
  ok: boolean;
  processed: number;
  matched: number;
  appendedCount: number;
  error?: string;
}

// FIX: Add RegisteredSheet interface for type safety.
export interface RegisteredSheet {
  name: string;
  url: string;
}
