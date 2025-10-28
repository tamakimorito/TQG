import { Injectable, effect, signal } from '@angular/core';
import { ProcessCsvResponse, RegisteredSheet } from '../models';

@Injectable({ providedIn: 'root' })
export class SheetApiService {
  private readonly ENDPOINT = "https://script.google.com/macros/s/AKfycbwhG8ut__PrT9WCYiug4WqXO-nl2y2SEF8_DB6isn0PiClrWGP9Qy61UpBaSWunip0O/exec";
  // FIX: Add storage key for localStorage persistence.
  private readonly SHEETS_STORAGE_KEY = 'registeredSheets';

  // FIX: Add sheets signal, initialized from localStorage.
  sheets = signal<RegisteredSheet[]>(this.getInitialSheets());

  constructor() {
    // FIX: Add effect to persist sheets to localStorage on change.
    effect(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.SHEETS_STORAGE_KEY, JSON.stringify(this.sheets()));
      }
    });
  }

  private getInitialSheets(): RegisteredSheet[] {
    if (typeof localStorage !== 'undefined') {
      const storedSheets = localStorage.getItem(this.SHEETS_STORAGE_KEY);
      if (storedSheets) {
        try {
          return JSON.parse(storedSheets);
        } catch (e) {
          console.error('Error parsing stored sheets from localStorage', e);
          return [];
        }
      }
    }
    return [];
  }

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

  async processCsv(sheetUrl: string, file: File): Promise<ProcessCsvResponse> {
    const dataUrl = await this.fileToBase64(file);
    const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
    return this.api<ProcessCsvResponse>({ action: 'processCsv', sheetUrl, csvBase64: base64 });
  }

  // FIX: Implement the missing registerSheet method.
  async registerSheet(name: string, url: string): Promise<void> {
    this.sheets.update(sheets => [...sheets, { name, url }]);
  }
}
