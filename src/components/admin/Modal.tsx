'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { AdminIcon } from './AdminIcon';

export function Modal({ open, onClose, title, description, children, width = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: string; description?: React.ReactNode; children: React.ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div data-lenis-prevent className="fixed inset-0 z-[70] grid place-items-end overflow-y-auto p-0 sm:place-items-center sm:p-6">
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className={`relative w-full ${width} rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl`}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description && <p className="mt-1 text-sm text-ink/55">{description}</p>}
              </div>
              <button type="button" onClick={onClose} className="-mr-2 -mt-1 rounded-xl p-2 text-ink/50 hover:bg-black/[0.05] hover:text-ink" aria-label="Close"><AdminIcon name="close" /></button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
