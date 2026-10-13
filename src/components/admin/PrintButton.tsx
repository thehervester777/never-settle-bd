'use client';

import { AdminIcon } from './AdminIcon';

export function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="abtn abtn-primary">
      <AdminIcon name="print" className="h-4 w-4" /> {label}
    </button>
  );
}
