'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useCart } from '@/components/cart/CartProvider';
import { EASE } from '@/components/motion/Reveal';

type Cat = { name: string; slug: string };

export function Header({ categories, announcements }: { categories: Cat[]; announcements: string[] }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const { count, open: openCart } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mega, setMega] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      setHidden(y > lastY.current && y > 300);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); setMega(false); }, [pathname]);
  useEffect(() => { document.body.classList.toggle('scroll-locked', menuOpen || searchOpen); }, [menuOpen, searchOpen]);

  const transparent = isHome && !scrolled && !mega;
  const clothing = categories.filter((c) => ['tshirts', 'pants', 'punjabis', 'kurtas'].includes(c.slug));

  return (
    <>
      <AnnouncementBar messages={announcements} />
      <header
        className={`sticky top-0 z-[60] border-b transition-[transform,background-color,color,border-color] duration-500 ease-expo ${hidden && !mega ? '-translate-y-full' : ''} ${
          transparent ? 'border-transparent bg-transparent text-paper' : 'border-ink/10 bg-paper text-ink'
        } ${isHome ? '-mb-16 lg:-mb-[4.5rem]' : ''}`}
        onMouseLeave={() => setMega(false)}
      >
        <div className="container grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 lg:h-[4.5rem]">
          <div className="flex items-center gap-1">
            <button className="-ml-2 p-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
              <Icon name="menu" className="h-6 w-6" />
            </button>
            <button className="p-2 lg:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Icon name="search" />
            </button>
            <nav className="hidden lg:block" aria-label="Primary">
              <ul className="flex items-center gap-7 text-[0.72rem] font-semibold uppercase tracking-[0.18em]">
                <li><NavLink href="/collections/new-in">New in</NavLink></li>
                <li onMouseEnter={() => setMega(true)}>
                  <button className="flex h-[4.5rem] items-center gap-1 uppercase" aria-expanded={mega} onClick={() => setMega((m) => !m)} onFocus={() => setMega(true)}>
                    <span className="link-underline">Clothing</span>
                    <Icon name="chevron-down" className={`h-3 w-3 transition-transform duration-300 ${mega ? 'rotate-180' : ''}`} />
                  </button>
                </li>
                <li><NavLink href="/collections/shoes">Shoes</NavLink></li>
                <li><NavLink href="/collections/wallets">Wallets</NavLink></li>
                <li><NavLink href="/collections/punjabis">Punjabis</NavLink></li>
                <li><NavLink href="/collections/sale">Sale</NavLink></li>
              </ul>
            </nav>
          </div>

          <Link href="/" className="whitespace-nowrap font-display text-2xl uppercase leading-none tracking-wide lg:text-[1.9rem]" aria-label="NEVER SETTLE home">
            NEVER SETTLE
          </Link>

          <div className="flex items-center justify-end gap-1 lg:gap-3">
            <button className="hidden items-center gap-2 p-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] lg:flex" onClick={() => setSearchOpen(true)}>
              <Icon name="search" /><span className="link-underline">Search</span>
            </button>
            <Link href="/track" className="hidden p-2 sm:block" aria-label="Track your order"><Icon name="truck" /></Link>
            <button className="relative -mr-2 flex items-center gap-2 p-2" onClick={openCart} aria-label={`Cart, ${count} items`}>
              <Icon name="cart" />
              <motion.span
                key={count}
                initial={{ scale: 0.4 }}
                animate={{ scale: count ? 1 : 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold leading-none text-ink"
              >
                {count}
              </motion.span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mega && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute inset-x-0 top-full hidden border-b border-ink/10 bg-paper text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,.25)] lg:block"
            >
              <div className="container grid grid-cols-12 gap-8 py-10">
                <div className="col-span-5 grid grid-cols-2 gap-8">
                  {[
                    { title: 'Everyday', links: clothing.filter((c) => ['tshirts', 'pants'].includes(c.slug)) },
                    { title: 'Punjabi & Kurta', links: clothing.filter((c) => ['punjabis', 'kurtas'].includes(c.slug)) },
                  ].map((col, i) => (
                    <motion.div key={col.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.05 + i * 0.05 }}>
                      <p className="eyebrow mb-4 text-muted">{col.title}</p>
                      <ul className="space-y-2.5 text-sm">
                        {col.links.map((c) => <li key={c.slug}><Link className="link-underline" href={`/collections/${c.slug}`}>{c.name}</Link></li>)}
                      </ul>
                    </motion.div>
                  ))}
                </div>
                <div className="col-span-7 grid grid-cols-2 gap-4">
                  {[{ label: 'Shop all clothing', href: '/collections/all' }, { label: 'New arrivals', href: '/collections/new-in' }].map((p, i) => (
                    <motion.div key={p.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.05 }}>
                      <Link href={p.href} className="group/p flex h-32 items-end justify-between bg-ink p-5 text-paper transition-colors hover:bg-accent hover:text-ink">
                        <span className="font-display text-2xl uppercase leading-none">{p.label}</span>
                        <Icon name="arrow-up-right" className="h-5 w-5 transition-transform duration-500 group-hover/p:rotate-45" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} categories={categories} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Link href={href} className="flex h-[4.5rem] items-center">
      <span className="link-underline" aria-current={pathname === href ? 'page' : undefined}>{children}</span>
    </Link>
  );
}

function AnnouncementBar({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, [messages.length]);
  if (!messages.length) return null;
  return (
    <div className="relative z-[61] bg-ink text-paper">
      <div className="container relative flex h-9 items-center justify-center overflow-hidden text-center text-[0.68rem] font-semibold uppercase tracking-[0.2em]">
        <AnimatePresence mode="wait">
          <motion.p key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.45, ease: EASE }}>
            {messages[i]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, side, label, children, className }: {
  open: boolean; onClose: () => void; side: 'left' | 'right' | 'top'; label: string; children: React.ReactNode; className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const from = side === 'left' ? { x: '-100%' } : side === 'right' ? { x: '100%' } : { y: '-100%' };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[80] bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true" aria-label={label}
            className={`fixed z-[90] flex flex-col ${className}`}
            initial={from} animate={{ x: 0, y: 0 }} exit={from} transition={{ duration: 0.6, ease: EASE }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
export { Drawer };

function MobileMenu({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: Cat[] }) {
  const links = [{ name: 'New in', slug: 'new-in' }, ...categories, { name: 'Sale', slug: 'sale' }];
  return (
    <Drawer open={open} onClose={onClose} side="left" label="Menu" className="inset-y-0 left-0 w-full max-w-md bg-ink text-paper">
      <div className="flex h-16 items-center justify-between px-5">
        <span className="font-display text-2xl uppercase">NEVER SETTLE</span>
        <button className="-mr-2 p-2" onClick={onClose} aria-label="Close menu"><Icon name="close" className="h-6 w-6" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-5 pb-10 pt-4" aria-label="Mobile">
        <ul className="divide-y divide-paper/10 border-y border-paper/10">
          {links.map((c, i) => (
            <motion.li key={c.slug} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.05 }}>
              <Link href={`/collections/${c.slug}`} className="flex items-center justify-between py-4 font-display text-4xl uppercase leading-none">
                {c.name}<Icon name="arrow-up-right" className="h-5 w-5 opacity-50" />
              </Link>
            </motion.li>
          ))}
        </ul>
        <div className="mt-8 grid gap-3 text-sm">
          <Link href="/track" className="flex items-center gap-3"><Icon name="truck" /> Track your order</Link>
          <Link href="/contact" className="flex items-center gap-3"><Icon name="phone" /> Contact us</Link>
        </div>
      </nav>
    </Drawer>
  );
}

type Suggestion = { slug: string; title: string; price: string; image: string | null };

function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80); }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        setResults((await r.json()).results);
      } catch { /* aborted */ }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  return (
    <Drawer open={open} onClose={onClose} side="top" label="Search" className="inset-x-0 top-0 bg-paper text-ink shadow-2xl">
      <div className="container py-6 md:py-10">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Search</p>
          <button className="-mr-2 p-2" onClick={onClose} aria-label="Close search"><Icon name="close" className="h-6 w-6" /></button>
        </div>
        <form className="relative mt-4" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { onClose(); router.push(`/search?q=${encodeURIComponent(q.trim())}`); } }}>
          <label htmlFor="search-input" className="sr-only">What are you looking for?</label>
          <input
            id="search-input" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} type="search" autoComplete="off"
            placeholder="What are you looking for?"
            className="w-full border-0 border-b-2 border-ink bg-transparent px-0 pb-3 font-display text-3xl uppercase placeholder:text-ink/25 focus:border-ink focus:ring-0 md:text-6xl"
          />
          <button type="submit" className="absolute bottom-4 right-0" aria-label="Search"><Icon name="arrow-right" className="h-7 w-7 md:h-9 md:w-9" /></button>
        </form>
        <div className="max-h-[60vh] overflow-y-auto pt-6" aria-live="polite">
          {results === null ? (
            <div className="flex flex-wrap gap-2">
              <p className="eyebrow mb-1 w-full text-muted">Popular searches</p>
              {['Punjabi', 'Kurta', 'T-shirt', 'Pants', 'Shoes', 'Wallet'].map((t) => (
                <button key={t} onClick={() => setQ(t)} className="border border-ink/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper">{t}</button>
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted">Nothing matched “{q}”. Try punjabi, pants or shoes.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {results.map((r, i) => (
                <motion.li key={r.slug} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: i * 0.05 }}>
                  <Link href={`/products/${r.slug}`} onClick={onClose} className="group block">
                    <div className="relative overflow-hidden bg-bone" style={{ aspectRatio: '4 / 5' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.image && <img src={r.image} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />}
                    </div>
                    <p className="mt-2 text-sm font-medium">{r.title}</p>
                    <p className="text-sm">{r.price}</p>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
