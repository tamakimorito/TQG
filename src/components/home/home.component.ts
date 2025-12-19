import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SheetApiService, ProcessCsvOptions } from '../../services/sheet-api.service';
import { NotificationService } from '../../services/notification.service';
import { ProcessCsvResponse } from '../../models';

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
  sheetUrls = computed(() =>
    this.sheetUrlsInput()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
  );
  validSheetUrls = computed(() =>
    this.sheetUrls().filter((url) => /^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url))
  );
  invalidSheetUrls = computed(() =>
    this.sheetUrls().filter((url) => url !== '' && !/^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url))
  );

  selectedFile = signal<File | null>(null);
  result = signal<
    | {
        duration: number;
        response: ProcessCsvResponse | null;
        error?: string;
      }
    | null
  >(null);
  
  encodingHint = signal('');
  mdqOnly = signal(false);

  isProcessing = this.notificationService.isProcessing;

  summaryResponse = computed(() => this.result()?.response ?? null);
  sheetResultCount = computed(() => this.summaryResponse()?.results.length ?? 0);
  successSheetCount = computed(() => this.summaryResponse()?.results.filter(r => r.ok).length ?? 0);
  totalUpdatedCount = computed(() =>
    (this.summaryResponse()?.results || [])
      .filter(r => r.ok)
      .reduce((sum, r) => sum + (r.updatedCount ?? r.appendedCount ?? 0), 0)
  );

  canSubmit = computed(() =>
    this.validSheetUrls().length > 0 &&
    this.invalidSheetUrls().length === 0 &&
    this.selectedFile() &&
    !this.isProcessing()
  );

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.result.set(null);
    }
  }

  onSheetUrlInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.sheetUrlsInput.set(input.value);
  }

  onEncodingChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.encodingHint.set(select.value);
  }

  onMdqOnlyChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.mdqOnly.set(checkbox.checked);
  }

  async onSubmit() {
    if (!this.canSubmit()) {
      if (this.validSheetUrls().length === 0) {
        this.notificationService.showToast('有効なスプレッドシートURLを1件以上入力してください。', 'error');
      } else if (this.invalidSheetUrls().length > 0) {
        this.notificationService.showToast('URLの形式を確認してください。無効な行があります。', 'error');
      } else if (!this.selectedFile()) {
        this.notificationService.showToast('CSVファイルを選択してください。', 'error');
      }
      return;
    }

    const urlCount = this.validSheetUrls().length;
    if (!confirm(`入力した ${urlCount} 件のスプレッドシートに対して処理を実行します。よろしいですか？`)) {
      return;
    }
    
    this.notificationService.startProcessing();
    this.result.set(null);
    const startTime = performance.now();

    try {
      const file = this.selectedFile();
      const urls = this.validSheetUrls();
      if (!file || urls.length === 0) throw new Error("File or Sheet URL is missing.");

      const options: ProcessCsvOptions = {
        encodingHint: this.encodingHint(),
        mdqOnly: this.mdqOnly()
      };
      const response = await this.sheetApiService.processCsv(urls, file, options);
      
      const endTime = performance.now();
      const duration = Math.round((endTime - startTime) / 100) / 10;
      
      const successCount = response.results.filter(r => r.ok).length;
      const totalUpdated = response.results
        .filter(r => r.ok)
        .reduce((sum, r) => sum + (r.updatedCount ?? r.appendedCount ?? 0), 0);

      this.result.set({ response, duration });

      if (response.ok) {
        this.notificationService.showToast(
          `処理が完了しました。${successCount}件のスプレッドシートで${totalUpdated}件更新しました。`,
          'success'
        );
      } else {
        this.notificationService.showToast(response.error || '処理中にエラーが発生しました。', 'error');
      }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.notificationService.showToast(`エラーが発生しました: ${errorMessage}`, 'error');
        const duration = Math.round((performance.now() - startTime) / 100) / 10;
        this.result.set({
            response: null,
            duration: duration,
            error: errorMessage,
        });
    } finally {
        this.notificationService.stopProcessing();
    }
  }
}
