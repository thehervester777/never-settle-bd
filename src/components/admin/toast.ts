/** Shows a toast from any client component (the FlashToast in the admin shell listens). */
export function toast(text: string, tone: 'ok' | 'warn' = 'ok') {
  window.dispatchEvent(new CustomEvent('admin-toast', { detail: { text, tone } }));
}
