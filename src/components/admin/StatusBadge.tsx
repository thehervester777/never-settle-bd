const STYLES: Record<string, [string, string]> = {
  PENDING: ['bg-amber-50 text-amber-800 ring-amber-200', 'bg-amber-500'],
  CONFIRMED: ['bg-sky-50 text-sky-800 ring-sky-200', 'bg-sky-500'],
  PROCESSING: ['bg-indigo-50 text-indigo-800 ring-indigo-200', 'bg-indigo-500'],
  SHIPPED: ['bg-violet-50 text-violet-800 ring-violet-200', 'bg-violet-500'],
  DELIVERED: ['bg-emerald-50 text-emerald-800 ring-emerald-200', 'bg-emerald-500'],
  CANCELLED: ['bg-neutral-100 text-neutral-600 ring-neutral-200', 'bg-neutral-400'],
  RETURNED: ['bg-rose-50 text-rose-700 ring-rose-200', 'bg-rose-400'],
  PAID: ['bg-emerald-50 text-emerald-800 ring-emerald-200', 'bg-emerald-500'],
  UNPAID: ['bg-amber-50 text-amber-800 ring-amber-200', 'bg-amber-500'],
  FAILED: ['bg-red-50 text-red-800 ring-red-200', 'bg-red-500'],
  REFUNDED: ['bg-neutral-100 text-neutral-600 ring-neutral-200', 'bg-neutral-400'],
  ACTIVE: ['bg-emerald-50 text-emerald-800 ring-emerald-200', 'bg-emerald-500'],
  DISABLED: ['bg-neutral-100 text-neutral-600 ring-neutral-200', 'bg-neutral-400'],
  IN_STOCK: ['bg-emerald-50 text-emerald-800 ring-emerald-200', 'bg-emerald-500'],
  LOW: ['bg-amber-50 text-amber-800 ring-amber-200', 'bg-amber-500'],
  OUT: ['bg-red-50 text-red-700 ring-red-200', 'bg-red-500'],
};

const LABELS: Record<string, string> = { PROCESSING: 'Packing', IN_STOCK: 'In stock', LOW: 'Low stock', OUT: 'Out of stock' };

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const [box, dot] = STYLES[status] ?? ['bg-neutral-100 text-neutral-700 ring-neutral-200', 'bg-neutral-400'];
  const text = label ?? LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${box}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </span>
  );
}
