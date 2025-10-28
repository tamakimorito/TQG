
import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';
export interface Toast {
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  toast = signal<Toast | null>(null);
  isProcessing = signal(false);

  showToast(message: string, type: ToastType) {
    this.toast.set({ message, type });
    setTimeout(() => this.hideToast(), 5000);
  }

  hideToast() {
    this.toast.set(null);
  }

  startProcessing() {
    this.isProcessing.set(true);
  }

  stopProcessing() {
    this.isProcessing.set(false);
  }
}
