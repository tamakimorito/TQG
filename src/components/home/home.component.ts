import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SheetApiService, ProcessCsvOptions } from '../../services/sheet-api.service';
import { NotificationService } from '../../services/notification.service';
import { ProcessCsvResult } from '../../models';

interface SheetInput {
  id: number;
  url: string;
  sheetName: string;
}

interface MultiProcessResult {
  entries: ProcessCsvResult[];
  totals: {
    processed: number;
    matched: number;
    updated: number;
    unmatched: number;
  };
  totalDuration: number;
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

  private nextSheetId = 1;

  sheetInputs = signal<SheetInput[]>([{ id: this.nextSheetId++, url: '', sheetName: '' }]);
  selectedFile = signal<File | null>(null);
  result = signal<MultiProcessResult | null>(null);
  
  encodingHint = signal('');
  mdqOnly = signal(false);

  isProcessing = this.notificationService.isProcessing;

  private isValidSheetUrl(url: string) {
    return /^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url.trim());
  }

  validSheetInputs = computed(() => this.sheetInputs().filter(input => this.isValidSheetUrl(input.url)));

  hasInvalidSheetInputs = computed(() =>
    this.sheetInputs().some(input => input.url.trim() !== '' && !this.isValidSheetUrl(input.url))
  );

  canSubmit = computed(() =>
    this.validSheetInputs().length > 0 &&
    !this.hasInvalidSheetInputs() &&
    !!this.selectedFile() &&
    !this.isProcessing()
  );

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.result.set(null);
    }
  }

  onSheetUrlInput(id: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.sheetInputs.update(list => list.map(item => item.id === id ? { ...item, url: input.value } : item));
    this.result.set(null);
  }

  onSheetNameInput(id: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.sheetInputs.update(list => list.map(item => item.id === id ? { ...item, sheetName: input.value } : item));
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

  addSheetInput() {
    this.sheetInputs.update(list => [...list, { id: this.nextSheetId++, url: '', sheetName: '' }]);
  }

  removeSheetInput(id: number) {
    this.sheetInputs.update(list => list.length > 1 ? list.filter(item => item.id !== id) : list);
  }

  private buildTargets() {
    return this.validSheetInputs().map(input => ({
      sheetUrl: input.url.trim(),
      sheetName: input.sheetName.trim() || undefined,
    }));
  }

  async onSubmit() {
    if (!this.canSubmit()) {
      if (this.hasInvalidSheetInputs()) {
        this.notificationService.showToast('赤枠のスプレッドシートURLを修正してください。', 'error');
      } else if (!this.selectedFile()) {
        this.notificationService.showToast('CSVファイルを選択してください。', 'error');
      } else {
        this.notificationService.showToast('対象シートを1件以上入力してください。', 'error');
      }
      return;
    }

    if (!confirm('入力したすべてのスプレッドシートに対してCSVを処理します。よろしいですか？')) {
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

      const targets = this.buildTargets();
      const entries = await this.sheetApiService.processCsvForTargets(targets, file, options);

      const totals = entries.reduce<MultiProcessResult['totals']>((acc, entry) => {
        const res = entry.response;
        if (res.ok) {
          acc.processed += res.processed || 0;
          acc.matched += res.matched || 0;
          acc.updated += (res.updatedCount ?? res.appendedCount ?? 0);
          acc.unmatched += res.unmatchedCount ?? 0;
        }
        return acc;
      }, { processed: 0, matched: 0, updated: 0, unmatched: 0 });

      const totalDuration = Math.round((performance.now() - startTime) / 100) / 10;
      this.result.set({ entries, totals, totalDuration });

      const successCount = entries.filter(entry => entry.response.ok).length;
      const failureCount = entries.length - successCount;
      const toastMessage = `処理が完了しました。成功 ${successCount} 件 / 失敗 ${failureCount} 件。`;
      this.notificationService.showToast(toastMessage, failureCount > 0 ? 'error' : 'success');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.notificationService.showToast(`エラーが発生しました: ${errorMessage}`, 'error');
        const duration = Math.round((performance.now() - startTime) / 100) / 10;
        this.result.set({
            entries: [],
            totals: { processed: 0, matched: 0, updated: 0, unmatched: 0 },
            totalDuration: duration,
        });
    } finally {
        this.notificationService.stopProcessing();
    }
  }
}
