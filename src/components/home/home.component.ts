import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SheetApiService, ProcessCsvOptions } from '../../services/sheet-api.service';
import { NotificationService } from '../../services/notification.service';
import { ProcessCsvResponse } from '../../models';

interface SheetResultView {
  sheetUrl: string;
  title: string;
  ok: boolean;
  processed: number;
  matched: number;
  updatedCount: number;
  unmatchedCount?: number;
  fallbackBy?: number;
  version?: string;
  usedSheetName?: string;
  error?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  sheetApiService = inject(SheetApiService);
  notificationService = inject(NotificationService);

  sheetUrlsInput = signal('');
  sheetUrls = computed(() => this.sheetUrlsInput().split(/\r?\n/).map(url => url.trim()).filter(url => url.length > 0));
  invalidSheetUrls = computed(() => this.sheetUrlsInput()
    .split(/\r?\n/)
    .map(url => url.trim())
    .filter(url => url.length > 0 && !this.isSheetUrl(url))
  );
  selectedFile = signal<File | null>(null);
  result = signal<{ totalDuration: number; sheets: SheetResultView[] } | null>(null);
  
  encodingHint = signal('');
  mdqOnly = signal(false);

  isProcessing = this.notificationService.isProcessing;

  isValidSheetUrls = computed(() => this.sheetUrls().length > 0 && this.invalidSheetUrls().length === 0);

  canSubmit = computed(() => this.isValidSheetUrls() && this.selectedFile() && !this.isProcessing());

  summary = computed(() => {
    const current = this.result();
    if (!current) {
      return { total: 0, success: 0, failure: 0 };
    }
    const success = current.sheets.filter(s => s.ok).length;
    const failure = current.sheets.length - success;
    return { total: current.sheets.length, success, failure };
  });

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.result.set(null);
    }
  }

  onSheetUrlsInput(event: Event) {
    const input = event.target as HTMLTextAreaElement;
    this.sheetUrlsInput.set(input.value);
    this.result.set(null);
  }

  onEncodingChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.encodingHint.set(select.value);
  }

  onMdqOnlyChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.mdqOnly.set(checkbox.checked);
  }

  private isSheetUrl(url: string) {
    return /^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url);
  }

  private deriveTitleFromUrl(url: string, index: number) {
    if (!url) return `スプレッドシート${index + 1}`;
    const match = url.match(/\/d\/([^/]+)/);
    return match ? `スプレッドシート (${match[1]})` : url;
  }

  private buildSheetResult(response: ProcessCsvResponse & { sheetUrl: string; }, fallbackTitle: string): SheetResultView {
    const updatedCount = response.updatedCount ?? response.appendedCount ?? response.matched ?? 0;
    const title = response.spreadsheetTitle || response.usedSheetName || fallbackTitle;

    return {
      sheetUrl: response.sheetUrl,
      title,
      ok: response.ok,
      processed: response.processed ?? 0,
      matched: response.matched ?? 0,
      updatedCount,
      unmatchedCount: response.unmatchedCount,
      fallbackBy: response.fallbackBy,
      version: response.version,
      usedSheetName: response.usedSheetName,
      error: response.error,
    };
  }

  async onSubmit() {
    if (!this.canSubmit()) {
      if (!this.isValidSheetUrls()) {
        this.notificationService.showToast('有効なスプレッドシートURLを改行区切りで入力してください。', 'error');
      } else if (!this.selectedFile()) {
        this.notificationService.showToast('CSVファイルを選択してください。', 'error');
      }
      return;
    }

    const file = this.selectedFile();
    const sheetUrls = this.sheetUrls();
    if (!file || !sheetUrls.length) return;

    if (!confirm(`${sheetUrls.length}件のスプレッドシートで処理を実行します。よろしいですか？`)) {
      return;
    }
    
    this.notificationService.startProcessing();
    this.result.set(null);
    const startTime = performance.now();

    try {
      const options: ProcessCsvOptions = {
        encodingHint: this.encodingHint() || undefined,
        mdqOnly: this.mdqOnly(),
      };

      const responses = await this.sheetApiService.processCsvForSheets(sheetUrls, file, options);
      const totalDuration = Math.round((performance.now() - startTime) / 100) / 10;

      const sheets = responses.map((res, index) => this.buildSheetResult(res, this.deriveTitleFromUrl(res.sheetUrl ?? sheetUrls[index], index)));
      const successCount = sheets.filter(s => s.ok).length;
      const failureCount = sheets.length - successCount;

      const toastMessage = failureCount
        ? `一部でエラーが発生しました（成功 ${successCount} / 失敗 ${failureCount}）。`
        : `${sheets.length}件のスプレッドシートで処理が完了しました。`;

      this.result.set({ totalDuration, sheets });
      this.notificationService.showToast(toastMessage, failureCount ? 'error' : 'success');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.notificationService.showToast(`エラーが発生しました: ${errorMessage}`, 'error');
      const duration = Math.round((performance.now() - startTime) / 100) / 10;
      this.result.set({
        totalDuration: duration,
        sheets: sheetUrls.map((url, index) => ({
          sheetUrl: url,
          title: this.deriveTitleFromUrl(url, index),
          ok: false,
          processed: 0,
          matched: 0,
          updatedCount: 0,
          error: errorMessage,
        })),
      });
    } finally {
      this.notificationService.stopProcessing();
    }
  }
}
