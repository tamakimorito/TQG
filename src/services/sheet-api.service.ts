import { Injectable } from '@angular/core';
import { ProcessCsvBatchApiResponse, ProcessCsvResponse } from '../models';

export interface ProcessCsvOptions {
  encodingHint?: string;
  mdqOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SheetApiService {
  private readonly ENDPOINT = "https://script.google.com/macros/s/AKfycbwhG8ut__PrT9WCYiug4WqXO-nl2y2SEF8_DB6isn0PiClrWGP9Qy61UpBaSWunip0O/exec";
  private readonly DEFAULT_SHEET_NAME = 'フォームの回答 1';  // 「回答」と「1」の間に半角スペース

  private async api<T>(payload: any): Promise<T> {
    try {
      const response = await fetch(this.ENDPOINT, {
        method: "POST",
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Network error: ${response.status} ${response.statusText}. Response: ${responseText}`);
      }

      try {
        const json = JSON.parse(responseText);
        if (!json.ok) {
          throw new Error(json.error || "An unknown API error occurred");
        }
        return json as T;
      } catch (e) {
        console.error("Failed to parse JSON from response text:", responseText, e);
        throw new Error(`API returned an invalid response. Body: ${responseText}`);
      }

    } catch (error) {
      if (error instanceof Error) {
        console.error("API call failed:", error.message);
        throw error;
      }
      throw new Error("An unknown error occurred during the API call.");
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  private buildBasePayload(base64: string, options: ProcessCsvOptions = {}) {
    return {
      csvBase64: base64,
      sheetName: this.DEFAULT_SHEET_NAME,
      debug: true,
      ...(options.encodingHint && { encodingHint: options.encodingHint }),
      ...(options.mdqOnly && { mdqOnly: options.mdqOnly }),
    };
  }

  async processCsvForSheets(sheetUrls: string[], file: File, options: ProcessCsvOptions = {}): Promise<(ProcessCsvResponse & { sheetUrl: string; })[]> {
    const targets = sheetUrls.map(url => url.trim()).filter(url => url.length > 0);
    if (!targets.length) {
      throw new Error('シートURLが未入力です。');
    }

    const dataUrl = await this.fileToBase64(file);
    const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);

    const basePayload = this.buildBasePayload(base64, options);

    try {
      const batchResponse = await this.api<ProcessCsvBatchApiResponse>({
        action: 'processCsvBatch',
        sheetUrls: targets,
        ...basePayload,
      });

      return batchResponse.results.map(result => {
        if (result.ok && (result.encodingUsed || result.hitExamples)) {
          console.log('Debug Info from API:', {
            encodingUsed: result.encodingUsed,
            hitExamples: result.hitExamples,
            sheetUrl: result.sheetUrl,
          });
        }
        return { ...result, sheetUrl: result.sheetUrl };
      });
    } catch (batchError) {
      console.warn('Batch API failed, falling back to sequential requests.', batchError);
      const results: (ProcessCsvResponse & { sheetUrl: string; })[] = [];

      for (const sheetUrl of targets) {
        const payload = {
          action: 'processCsv',
          sheetUrl,
          ...basePayload,
        };

        try {
          const response = await this.api<ProcessCsvResponse>(payload);
          results.push({ ...response, sheetUrl });

          if (response.ok && (response.encodingUsed || response.hitExamples)) {
            console.log('Debug Info from API:', {
              encodingUsed: response.encodingUsed,
              hitExamples: response.hitExamples,
              sheetUrl,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            ok: false,
            sheetUrl,
            processed: 0,
            matched: 0,
            error: message,
          });
        }
      }

      return results;
    }
  }

  async processCsv(sheetUrl: string, file: File, options: ProcessCsvOptions = {}): Promise<ProcessCsvResponse> {
    const [single] = await this.processCsvForSheets([sheetUrl], file, options);
    return single;
  }
}
