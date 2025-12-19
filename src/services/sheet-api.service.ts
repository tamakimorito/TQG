import { Injectable } from '@angular/core';
import { ProcessCsvResponse, ProcessCsvResult, SheetTarget } from '../models';

export interface ProcessCsvOptions {
  encodingHint?: string;
  mdqOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SheetApiService {
  private readonly ENDPOINT = "https://script.google.com/macros/s/AKfycbwhG8ut__PrT9WCYiug4WqXO-nl2y2SEF8_DB6isn0PiClrWGP9Qy61UpBaSWunip0O/exec";

  private async callProcessCsv(payload: any): Promise<ProcessCsvResponse> {
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
      return JSON.parse(responseText) as ProcessCsvResponse;
    } catch (e) {
      console.error("Failed to parse JSON from response text:", responseText, e);
      throw new Error(`API returned an invalid response. Body: ${responseText}`);
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

  private async fileToCsvBase64(file: File): Promise<string> {
    const dataUrl = await this.fileToBase64(file);
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  }

  private buildPayload(target: SheetTarget, csvBase64: string, options: ProcessCsvOptions) {
    return {
      action: 'processCsv',
      sheetUrl: target.sheetUrl,
      csvBase64,
      debug: true,
      ...(target.sheetName && target.sheetName.trim() ? { sheetName: target.sheetName.trim() } : {}),
      ...(options.encodingHint ? { encodingHint: options.encodingHint } : {}),
      ...(options.mdqOnly ? { mdqOnly: options.mdqOnly } : {}),
    };
  }

  async processCsvForTargets(targets: SheetTarget[], file: File, options: ProcessCsvOptions = {}): Promise<ProcessCsvResult[]> {
    const csvBase64 = await this.fileToCsvBase64(file);
    const results: ProcessCsvResult[] = [];

    for (const target of targets) {
      const startTime = performance.now();
      try {
        const response = await this.callProcessCsv(this.buildPayload(target, csvBase64, options));
        const duration = Math.round((performance.now() - startTime) / 100) / 10;
        results.push({ target, response, duration });
      } catch (error) {
        const duration = Math.round((performance.now() - startTime) / 100) / 10;
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          target,
          response: { ok: false, processed: 0, matched: 0, updatedCount: 0, error: message },
          duration,
        });
      }
    }

    return results;
  }

  async processCsv(sheetUrl: string, file: File, options: ProcessCsvOptions = {}, sheetName?: string): Promise<ProcessCsvResponse> {
    const [first] = await this.processCsvForTargets([{ sheetUrl, sheetName }], file, options);
    return first?.response ?? { ok: false, processed: 0, matched: 0, updatedCount: 0, error: '処理結果を取得できませんでした。' };
  }
}
