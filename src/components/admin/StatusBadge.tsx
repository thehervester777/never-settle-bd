const STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  CONFIRMED: 'bg-sky-100 text-sky-900',
  PROCESSING: 'bg-indigo-100 text-indigo-900',
  SHIPPED: 'bg-violet-100 text-violet-900',
  DELIVERED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-neutral-200 text-neutral-700',
  RETURNED: 'bg-neutral-200 text-neutral-700',
  PAID: 'bg-emerald-100 text-emerald-900',
  UNPAID: 'bg-amber-100 text-amber-900',
  FAILED: 'bg-red-100 text-red-900',
  REFUNDED: 'bg-neutral-200 text-neutral-700',
  VALID: 'bg-emerald-100 text-emerald-900',
  INITIATED: 'bg-amber-100 text-amber-900',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${STYLES[status] ?? 'bg-neutral-100'}`}>{status.toLowerCase()}</span>;
}
