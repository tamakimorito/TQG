import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SheetApiService, ProcessCsvOptions } from '../../services/sheet-api.service';
import { NotificationService } from '../../services/notification.service';
import { SheetProcessResult, SheetTarget } from '../../models';

interface SheetTargetInput extends SheetTarget {
  id: number;
}

interface BatchResult {
  totalDuration: number;
  totalProcessed: number;
  totalMatched: number;
  totalAppended: number;
  successCount: number;
  failureCount: number;
  items: SheetProcessResult[];
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

  private nextId = 1;
  readonly maxSheetTargets = 5;
  sheetEntries = signal<SheetTargetInput[]>([{ id: this.nextId++, url: '', sheetName: '' }]);
  selectedFile = signal<File | null>(null);
  result = signal<BatchResult | null>(null);

  encodingHint = signal('');
  mdqOnly = signal(false);

  isProcessing = this.notificationService.isProcessing;

  isValidSheetUrl(url: string) {
    return /^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url.trim());
  }

  validSheetEntries = computed(() =>
    this.sheetEntries()
      .filter(entry => entry.url.trim() !== '')
      .filter(entry => this.isValidSheetUrl(entry.url))
      .map(({ url, sheetName }) => ({ url: url.trim(), sheetName: sheetName.trim() || undefined }))
  );

  hasInvalidSheetUrl = computed(() =>
    this.sheetEntries().some(entry => entry.url.trim() !== '' && !this.isValidSheetUrl(entry.url))
  );

  canSubmit = computed(() => {
    return this.validSheetEntries().length > 0 &&
      this.selectedFile() &&
      !this.hasInvalidSheetUrl() &&
      !this.isProcessing();
  });

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.result.set(null);
    }
  }

  addSheetEntry() {
    if (this.sheetEntries().length >= this.maxSheetTargets) return;
    this.sheetEntries.update(list => [...list, { id: this.nextId++, url: '', sheetName: '' }]);
  }

  removeSheetEntry(index: number) {
    if (this.sheetEntries().length === 1) return;
    this.sheetEntries.update(list => list.filter((_, i) => i !== index));
    this.result.set(null);
  }

  onSheetUrlInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    this.sheetEntries.update(list =>
      list.map((entry, i) => i === index ? { ...entry, url: value } : entry)
    );
    this.result.set(null);
  }

  onSheetNameInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    this.sheetEntries.update(list =>
      list.map((entry, i) => i === index ? { ...entry, sheetName: value } : entry)
    );
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

  async onSubmit() {
    const validTargets = this.validSheetEntries();

    if (!this.canSubmit() || validTargets.length === 0) {
      if (this.hasInvalidSheetUrl()) {
        this.notificationService.showToast('有効なスプレッドシートURLを入力してください。', 'error');
      } else if (!this.selectedFile()) {
        this.notificationService.showToast('CSVファイルを選択してください。', 'error');
      } else {
        this.notificationService.showToast('処理対象のシートURLを入力してください。', 'error');
      }
      return;
    }

    if (!confirm(`入力した${validTargets.length}件のシートとCSVで処理を実行します。よろしいですか？`)) {
      return;
    }
    
    this.notificationService.startProcessing();
    this.result.set(null);
    const startTime = performance.now();

    try {
      const file = this.selectedFile();
      if (!file) throw new Error("File is missing.");

      const options: ProcessCsvOptions = {
        encodingHint: this.encodingHint(),
        mdqOnly: this.mdqOnly()
      };

      const results = await this.sheetApiService.processCsvBatch(validTargets, file, options);
      const totalDuration = Math.round((performance.now() - startTime) / 100) / 10;

      const successItems = results.filter(r => r.ok);
      const failureItems = results.length - successItems.length;
      const totalProcessed = successItems.reduce((sum, r) => sum + r.processed, 0);
      const totalMatched = successItems.reduce((sum, r) => sum + r.matched, 0);
      const totalAppended = successItems.reduce((sum, r) => sum + r.appendedCount, 0);

      this.result.set({
        totalDuration,
        totalProcessed,
        totalMatched,
        totalAppended,
        successCount: successItems.length,
        failureCount: failureItems,
        items: results,
      });

      if (successItems.length > 0) {
        this.notificationService.showToast(
          `処理が完了しました。${successItems.length}件成功（追記 ${totalAppended} 件）、失敗 ${failureItems} 件。`,
          failureItems > 0 ? 'error' : 'success'
        );
      } else {
        this.notificationService.showToast('全てのシート処理に失敗しました。入力内容を確認してください。', 'error');
      }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.notificationService.showToast(`エラーが発生しました: ${errorMessage}`, 'error');
        const duration = Math.round((performance.now() - startTime) / 100) / 10;
        this.result.set({
          totalDuration: duration,
          totalProcessed: 0,
          totalMatched: 0,
          totalAppended: 0,
          successCount: 0,
          failureCount: 0,
          items: [],
        });
    } finally {
        this.notificationService.stopProcessing();
    }
  }
}
