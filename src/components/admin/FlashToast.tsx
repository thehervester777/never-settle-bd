'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AdminIcon } from './AdminIcon';

const MESSAGES: Record<string, [string, 'ok' | 'warn']> = {
  saved: ['Changes saved', 'ok'],
  created: ['Created', 'ok'],
  deleted: ['Deleted', 'ok'],
  updated: ['Updated', 'ok'],
  denied: ["You don't have access to that page", 'warn'],
  stock: ['Stock updated', 'ok'],
  password: ['Password changed', 'ok'],
};

/** Shows a toast for ?flash=… after a redirect, then removes it from the address bar. */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [toast, setToast] = useState<{ key: number; text: string; tone: 'ok' | 'warn' } | null>(null);

  useEffect(() => {
    const flash = params.get('flash');
    if (!flash) return;
    // Only known keys: the address bar must not be able to put arbitrary text in front of an admin.
    const known = MESSAGES[flash];
    if (known) setToast({ key: Date.now(), text: known[0], tone: known[1] });
    const rest = new URLSearchParams(params);
    rest.delete('flash');
    router.replace(rest.size ? `${path}?${rest}` : path, { scroll: false });
  }, [params, path, router]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent<{ text: string; tone: 'ok' | 'warn' }>).detail;
      setToast({ key: Date.now(), text, tone });
    };
    window.addEventListener('admin-toast', onToast);
    return () => window.removeEventListener('admin-toast', onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="no-print pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink py-3 pl-3 pr-4 text-sm text-white shadow-2xl"
          >
            <span className={`grid h-7 w-7 place-items-center rounded-full ${toast.tone === 'ok' ? 'bg-accent text-ink' : 'bg-amber-400 text-ink'}`}>
              <AdminIcon name={toast.tone === 'ok' ? 'check' : 'alert'} className="h-4 w-4" strokeWidth={2.5} />
            </span>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
