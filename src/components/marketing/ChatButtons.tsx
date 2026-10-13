'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { trackChat } from '@/lib/track';

export const waLink = (number: string, text: string) => `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export function WhatsAppIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.24 8.24 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.25 8.23Zm4.52-6.16c-.25-.12-1.46-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23a7.48 7.48 0 0 1-1.38-1.72c-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  );
}

function MessengerIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.99-.88a.8.8 0 0 1 .53-.04c.91.25 1.88.39 2.9.39 5.64 0 10-4.13 10-9.7S17.64 2 12 2Zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63Z" />
    </svg>
  );
}

/** Floating WhatsApp / Messenger buttons. Each tap counts as a "Contact" for the ad platforms. */
export function ChatButtons({ whatsapp, messenger, storeName }: { whatsapp: string; messenger: string; storeName: string }) {
  const path = usePathname();
  if ((!whatsapp && !messenger) || path.startsWith('/checkout')) return null;

  const openWhatsApp = () => {
    trackChat('whatsapp', path);
    const text = path.startsWith('/products/') ? `Hi ${storeName}! I have a question about this: ${window.location.href}` : `Hi ${storeName}! `;
    window.open(waLink(whatsapp, text), '_blank', 'noopener');
  };

  return (
    <div className="no-print fixed bottom-4 right-4 z-[70] flex flex-col gap-3 sm:bottom-6 sm:right-6">
      {messenger && (
        <motion.a
          href={`https://m.me/${encodeURIComponent(messenger)}`} target="_blank" rel="noopener"
          onClick={() => trackChat('messenger', path)}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.9, type: 'spring', stiffness: 260, damping: 20 }}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          className="grid h-12 w-12 place-items-center rounded-full bg-[#0084FF] text-white shadow-lg shadow-black/20"
          aria-label="Chat with us on Messenger"
        >
          <MessengerIcon />
        </motion.a>
      )}
      {whatsapp && (
        <motion.button
          type="button" onClick={openWhatsApp}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.75, type: 'spring', stiffness: 260, damping: 20 }}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          className="grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20"
          aria-label="Chat with us on WhatsApp"
        >
          <WhatsAppIcon className="h-7 w-7" />
        </motion.button>
      )}
    </div>
  );
}
