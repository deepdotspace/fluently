/**
 * Toast notification utility
 * Provides a simple way to show toast notifications without browser alerts
 */

export type ToastType = 'error' | 'success' | 'info';

export interface Toast {
  message: string;
  type: ToastType;
}

export type ToastCallback = (toast: Toast) => void;

let toastCallback: ToastCallback | null = null;

export function showToast(message: string, type: ToastType = 'error'): void {
  if (toastCallback) {
    toastCallback({ message, type });
  } else {
    // Fallback: create a temporary toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      padding: 12px 20px;
      background: ${type === 'error' ? 'rgba(239, 68, 68, 0.95)' : type === 'success' ? 'rgba(34, 197, 94, 0.95)' : 'rgba(59, 130, 246, 0.95)'};
      backdrop-filter: blur(10px);
      border-radius: 8px;
      font-size: 14px;
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      max-width: 90%;
      animation: fadeIn 0.2s ease-in;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px)';
      setTimeout(() => document.body.removeChild(toast), 200);
    }, 3000);
  }
}

export function setToastCallback(callback: ToastCallback): void {
  toastCallback = callback;
}
