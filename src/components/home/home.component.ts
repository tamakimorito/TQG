import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SheetApiService } from '../../services/sheet-api.service';
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

  sheets = this.sheetApiService.sheets;
  selectedSheetName = signal('');
  selectedSheetUrl = computed(() => {
    const name = this.selectedSheetName();
    const sheet = this.sheets().find(s => s.name === name);
    return sheet?.url ?? '';
  });
  selectedFile = signal<File | null>(null);
  result = signal<(ProcessCsvResponse & { duration: number; error?: string; }) | null>(null);
  
  isProcessing = this.notificationService.isProcessing;

  canSubmit = computed(() => this.selectedSheetUrl() && this.selectedFile() && !this.isProcessing());

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.result.set(null);
    }
  }

  onSheetNameInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedSheetName.set(input.value);
  }

  async onSubmit() {
    if (!this.canSubmit()) {
      this.notificationService.showToast('有効なシートとCSVファイルを選択してください。', 'error');
      return;
    }

    if (!confirm('選択したシートとCSVで処理を実行します。よろしいですか？')) {
      return;
    }
    
    this.notificationService.startProcessing();
    this.result.set(null);
    const startTime = performance.now();

    try {
      const file = this.selectedFile();
      const sheetUrl = this.selectedSheetUrl();
      if (!file || !sheetUrl) throw new Error("File or Sheet URL is missing.");

      const response = await this.sheetApiService.processCsv(sheetUrl, file);
      
      const endTime = performance.now();
      const duration = Math.round((endTime - startTime) / 100) / 10;
      
      this.result.set({ ...response, duration });
      this.notificationService.showToast(`処理が完了しました。${response.appendedCount}件のデータを追記しました。`, 'success');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.notificationService.showToast(`エラーが発生しました: ${errorMessage}`, 'error');
        const duration = Math.round((performance.now() - startTime) / 100) / 10;
        this.result.set({
            ok: false,
            processed: 0,
            matched: 0,
            appendedCount: 0,
            duration: duration,
            error: errorMessage,
        });
    } finally {
        this.notificationService.stopProcessing();
    }
  }
}