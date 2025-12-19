import { Injectable } from '@angular/core';
import { ProcessCsvResponse, SheetProcessResult, SheetTarget } from '../models';

export interface ProcessCsvOptions {
  encodingHint?: string;
  mdqOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SheetApiService {
  private readonly ENDPOINT = "https://script.google.com/macros/s/AKfycbwhG8ut__PrT9WCYiug4WqXO-nl2y2SEF8_DB6isn0PiClrWGP9Qy61UpBaSWunip0O/exec";

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

  private async getCsvBase64(file: File): Promise<string> {
    const dataUrl = await this.fileToBase64(file);
    return dataUrl.substring(dataUrl.indexOf(',') + 1);
  }

  async processCsvBatch(targets: SheetTarget[], file: File, options: ProcessCsvOptions = {}): Promise<SheetProcessResult[]> {
    if (!targets.length) return [];

    const csvBase64 = await this.getCsvBase64(file);
    const results: SheetProcessResult[] = [];

    for (const target of targets) {
      const start = performance.now();
      try {
        const payload = {
          action: 'processCsv',
          sheetUrl: target.url,
          csvBase64,
          debug: true,
          ...(target.sheetName && { sheetName: target.sheetName }),
          ...(options.encodingHint && { encodingHint: options.encodingHint }),
          ...(options.mdqOnly && { mdqOnly: options.mdqOnly }),
        };

        const response = await this.api<ProcessCsvResponse>(payload);
        const duration = Math.round((performance.now() - start) / 100) / 10;

        if (response.ok && payload.debug && (response.encodingUsed || response.hitExamples)) {
          console.log('Debug Info from API:', {
            sheetUrl: target.url,
            sheetName: target.sheetName,
            encodingUsed: response.encodingUsed,
            hitExamples: response.hitExamples,
          });
        }

        results.push({
          sheetUrl: target.url,
          sheetName: target.sheetName,
          ok: response.ok,
          processed: response.processed,
          matched: response.matched,
          appendedCount: response.appendedCount,
          duration,
          encodingUsed: response.encodingUsed,
          response,
        });
      } catch (error) {
        const duration = Math.round((performance.now() - start) / 100) / 10;
        results.push({
          sheetUrl: target.url,
          sheetName: target.sheetName,
          ok: false,
          processed: 0,
          matched: 0,
          appendedCount: 0,
          duration,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  async processCsv(sheetUrl: string, file: File, options: ProcessCsvOptions = {}, sheetName?: string): Promise<ProcessCsvResponse> {
    const [result] = await this.processCsvBatch([{ url: sheetUrl, sheetName }], file, options);
    if (!result) {
      throw new Error('処理対象のシートが設定されていません。');
    }
    if (!result.ok) {
      throw new Error(result.error || 'シート処理に失敗しました。');
    }
    return result.response as ProcessCsvResponse;
  }
}
