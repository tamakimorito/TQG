import { Injectable } from '@angular/core';
import { ProcessCsvResponse } from '../models';

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

  async processCsv(sheetUrl: string, file: File, options: ProcessCsvOptions = {}): Promise<ProcessCsvResponse> {
    const dataUrl = await this.fileToBase64(file);
    const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
    
    const payload = { 
      action: 'processCsv', 
      sheetUrl, 
      csvBase64: base64,
      sheetName: 'フォームの回答 1',  // 「回答」と「1」の間に半角スペース
      debug: true,
      ...(options.encodingHint && { encodingHint: options.encodingHint }),
      ...(options.mdqOnly && { mdqOnly: options.mdqOnly }),
    };

    const response = await this.api<ProcessCsvResponse>(payload);

    if (response.ok && payload.debug && (response.encodingUsed || response.hitExamples)) {
      console.log('Debug Info from API:', {
        encodingUsed: response.encodingUsed,
        hitExamples: response.hitExamples,
      });
    }

    return response;
  }
}
