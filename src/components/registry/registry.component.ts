import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SheetApiService } from '../../services/sheet-api.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-registry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registry.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistryComponent {
  // FIX: Explicitly type the injected FormBuilder to fix type inference issue.
  private fb: FormBuilder = inject(FormBuilder);
  sheetApiService = inject(SheetApiService);
  notificationService = inject(NotificationService);

  sheets = this.sheetApiService.sheets;
  
  isSubmitting = signal(false);

  registryForm = this.fb.group({
    name: ['', Validators.required],
    url: ['', [Validators.required, Validators.pattern(/https:\/\/docs\.google\.com\/spreadsheets\/d\//)]]
  });

  async onSubmit() {
    if (this.registryForm.invalid) {
      this.notificationService.showToast('フォームの入力内容を確認してください。', 'error');
      return;
    }
    
    const { name, url } = this.registryForm.value;

    if (name && this.sheets().some(sheet => sheet.name.toLowerCase() === name.toLowerCase())) {
        this.notificationService.showToast(`シート名「${name}」は既に使用されています。`, 'error');
        return;
    }
    
    this.isSubmitting.set(true);

    try {
        if (name && url) {
            await this.sheetApiService.registerSheet(name, url);
            this.notificationService.showToast(`「${name}」を登録しました。`, 'success');
            this.registryForm.reset();
        } else {
            throw new Error('Name and URL are required.');
        }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.notificationService.showToast(`登録に失敗しました: ${errorMessage}`, 'error');
    } finally {
        this.isSubmitting.set(false);
    }
  }
}
