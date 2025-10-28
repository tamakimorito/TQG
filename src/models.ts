
export interface Sheet {
  name: string;
  url: string;
}

export interface ListSheetsResponse {
  ok: boolean;
  sheets: Sheet[];
  error?: string;
}

export interface RegisterSheetResponse {
  ok: boolean;
  sheets: Sheet[];
  error?: string;
}

export interface ProcessCsvResponse {
  ok: boolean;
  processed: number;
  matched: number;
  appendedCount: number;
  error?: string;
}
