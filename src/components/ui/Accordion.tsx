'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useId, useState } from 'react';
import { Icon } from './Icon';

export function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-b border-ink/15">
      <button className="flex w-full items-center justify-between gap-6 py-6 text-left text-base font-medium md:text-lg" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/20 transition-all duration-300 ${open ? 'rotate-45 bg-ink text-paper' : ''}`}><Icon name="plus" className="h-4 w-4" /></span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="max-w-2xl pb-7 text-ink/80">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
