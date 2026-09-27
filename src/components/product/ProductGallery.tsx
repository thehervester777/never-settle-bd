'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export function ProductGallery({ images, title }: { images: { url: string; alt: string }[]; title: string }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const track = useRef<HTMLUListElement>(null);

  useEffect(() => {
    document.body.classList.toggle('scroll-locked', zoom !== null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  if (!images.length) return <div className="bg-bone" style={{ aspectRatio: '4 / 5' }} />;

  return (
    <div className="relative">
      <ul
        ref={track}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none md:grid md:grid-cols-2 md:gap-2 md:overflow-visible"
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {images.map((img, i) => (
          <motion.li
            key={img.url}
            className={`relative w-full shrink-0 snap-center overflow-hidden bg-bone ${i === 0 || images.length === 1 ? 'md:col-span-2' : ''}`}
            style={{ aspectRatio: '4 / 5' }}
            initial={i === 0 ? false : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} className="absolute inset-0 h-full w-full object-cover" />
            <button className="absolute inset-0 cursor-zoom-in" onClick={() => setZoom(i)} aria-label={`Open image ${i + 1} of ${images.length} full screen`} />
          </motion.li>
        ))}
      </ul>
      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-4 left-4 bg-paper/90 px-3 py-1.5 text-xs font-semibold tabular-nums md:hidden">{current + 1} / {images.length}</div>
      )}

      <AnimatePresence>
        {zoom !== null && (
          <motion.div className="fixed inset-0 z-[110] overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="fixed right-4 top-4 z-10 grid h-12 w-12 place-items-center rounded-full bg-ink text-paper" onClick={() => setZoom(null)} aria-label="Close full screen view" autoFocus>
              <Icon name="close" />
            </button>
            <div className="mx-auto max-w-5xl">
              {images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.url} src={img.url} alt={img.alt} className="h-auto w-full" ref={(el) => { if (el && i === zoom) el.scrollIntoView(); }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
