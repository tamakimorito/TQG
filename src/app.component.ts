import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NotificationService } from './services/notification.service';
import { SheetApiService } from './services/sheet-api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
})
export class AppComponent {
  notificationService = inject(NotificationService);
  sheetApiService = inject(SheetApiService);

  toast = this.notificationService.toast;
  isProcessing = this.notificationService.isProcessing;
  readonly appVersion = 'v1.3.2';
}
