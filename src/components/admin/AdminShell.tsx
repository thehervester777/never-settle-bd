'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { AdminIcon } from './AdminIcon';
import { activeHref, type NavGroup } from './nav';
import { MotionRoot } from './motion/MotionRoot';
import { gsap, reducedMotion, ScrollTrigger, useGSAP } from './motion/gsap';

type Badges = { toConfirm: number; unread: number; lowStock: number };
type Props = {
  admin: { name: string; email: string; roleLabel: string };
  nav: NavGroup[];
  badges: Badges;
  canSearchOrders: boolean;
  logout: () => Promise<void>;
  children: React.ReactNode;
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'A';
const EASE = [0.16, 1, 0.3, 1] as const;

function Sidebar({ nav, badges, admin, onNavigate }: { nav: NavGroup[]; badges: Badges; admin: Props['admin']; onNavigate?: () => void }) {
  const path = usePathname();
  const current = activeHref(path, nav.flatMap((g) => g.items.map((i) => i.href)));
  const navRef = useRef<HTMLElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // Keep the current page's link visible when the menu is taller than the screen.
  useEffect(() => { navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' }); }, [current]);
  // The menu slides in, group by group, when the panel opens.
  useGSAP(() => {
    if (reducedMotion()) return;
    gsap.from('[data-nav-anim]', { x: -22, opacity: 0, duration: 0.8, stagger: 0.025, ease: 'expo.out', delay: 0.05, clearProps: 'transform,opacity' });
  }, { scope: root });
  return (
    <div ref={root} className="flex h-full flex-col">
      <Link data-nav-anim href="/admin" onClick={onNavigate} className="flex items-center gap-3 px-5 pb-5 pt-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent font-display text-lg text-ink">N</span>
        <span>
          <span className="block font-display text-xl uppercase leading-none tracking-wide text-white">Never Settle</span>
          <span className="mt-1 block text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/40">Commerce admin</span>
        </span>
      </Link>
      <nav ref={navRef} data-lenis-prevent className="admin-nav-scroll flex-1 space-y-4 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {nav.map((g) => (
          <div key={g.label}>
            <p data-nav-anim className="px-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/30">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.href === current;
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.href} data-nav-anim>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${active ? 'text-ink' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}
                    >
                      {active && <motion.span layoutId="admin-nav-active" className="absolute inset-0 rounded-xl bg-accent" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                      <AdminIcon name={item.icon} className="relative h-[18px] w-[18px] shrink-0" />
                      <span className="relative flex-1 font-medium">{item.label}</span>
                      {count > 0 && (
                        <span className={`relative min-w-[1.4rem] rounded-full px-1.5 py-0.5 text-center text-[0.65rem] font-semibold tabular ${active ? 'bg-ink text-accent' : item.badge === 'lowStock' ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-white'}`}>
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div data-nav-anim className="m-3 mt-0 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-lime-500 text-xs font-bold text-ink">{initials(admin.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{admin.name}</span>
          <span className="block truncate text-xs text-white/45">{admin.roleLabel}</span>
        </span>
      </div>
    </div>
  );
}

function UserMenu({ admin, logout }: { admin: Props['admin']; logout: Props['logout'] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-black/[0.05]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[0.7rem] font-bold text-accent">{initials(admin.name)}</span>
        <AdminIcon name="chevron-down" className={`h-4 w-4 text-ink/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border border-black/[0.06] bg-white p-2 shadow-xl"
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{admin.name}</p>
              <p className="truncate text-xs text-ink/50">{admin.email}</p>
              <p className="mt-2 inline-block rounded-full bg-accent/50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider">{admin.roleLabel}</p>
            </div>
            <div className="my-1 h-px bg-black/[0.06]" />
            <Link role="menuitem" href="/admin/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-black/[0.04]"><AdminIcon name="account" className="h-4 w-4" /> My account</Link>
            <Link role="menuitem" href="/" target="_blank" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-black/[0.04]"><AdminIcon name="external" className="h-4 w-4" /> View store</Link>
            <form action={logout}>
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><AdminIcon name="logout" className="h-4 w-4" /> Log out</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AdminShell({ admin, nav, badges, canSearchOrders, logout, children }: Props) {
  const [drawer, setDrawer] = useState(false);
  const [raised, setRaised] = useState(false);
  const [pageTitle, setPageTitle] = useState<{ text: string; show: boolean }>({ text: '', show: false });
  const path = usePathname();
  const router = useRouter();
  useEffect(() => setDrawer(false), [path]);

  // The top bar lifts off the page once you scroll, and shows the page title when the page's own heading scrolls away.
  useGSAP(() => {
    const lift = ScrollTrigger.create({ start: 6, end: 'max', onToggle: (self) => setRaised(self.isActive) });
    return () => lift.kill();
  });
  useEffect(() => {
    let st: ScrollTrigger | undefined;
    const id = requestAnimationFrame(() => {
      const h = document.querySelector<HTMLElement>('[data-page] [data-page-title]');
      setPageTitle({ text: h?.textContent?.trim() ?? '', show: false });
      if (h) st = ScrollTrigger.create({ trigger: h, start: 'bottom top+=72', end: 'max', onToggle: (self) => setPageTitle((t) => ({ ...t, show: self.isActive })) });
    });
    return () => { cancelAnimationFrame(id); st?.kill(); };
  }, [path]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  return (
    <MotionRoot>
    <div className="min-h-screen bg-[#f4f4f1] text-ink lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 hidden h-screen bg-[#0b0b0c] lg:block">
        <Sidebar nav={nav} badges={badges} admin={admin} />
      </aside>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div data-lenis-prevent className="no-print fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside
              data-lenis-prevent
              className="no-print fixed inset-y-0 left-0 z-50 w-[280px] bg-[#0b0b0c] shadow-2xl lg:hidden"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.35, ease: EASE }}
            >
              <button type="button" onClick={() => setDrawer(false)} className="absolute right-3 top-6 rounded-lg p-2 text-white/60 hover:bg-white/10" aria-label="Close menu"><AdminIcon name="close" /></button>
              <Sidebar nav={nav} badges={badges} admin={admin} onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="min-w-0">
        <header className={`no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-xl transition-[background-color,box-shadow,border-color] duration-500 md:px-8 ${raised ? 'border-black/[0.07] bg-[#f4f4f1]/90 shadow-[0_10px_30px_-20px_rgba(16,16,16,0.35)]' : 'border-transparent bg-[#f4f4f1]/70'}`}>
          <button type="button" onClick={() => setDrawer(true)} className="-ml-1 rounded-xl p-2 hover:bg-black/[0.05] lg:hidden" aria-label="Open menu"><AdminIcon name="menu" /></button>
          <AnimatePresence>
            {pageTitle.show && pageTitle.text && (
              <motion.p
                key={pageTitle.text}
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.35, ease: EASE }}
                className="hidden max-w-[16rem] shrink-0 truncate text-sm font-semibold tracking-tight xl:block"
                aria-hidden="true"
              >
                {pageTitle.text}
              </motion.p>
            )}
          </AnimatePresence>
          {canSearchOrders ? (
            <form
              className="relative max-w-md flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
                router.push(q ? `/admin/orders?q=${encodeURIComponent(q)}` : '/admin/orders');
              }}
            >
              <AdminIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input name="q" placeholder="Search orders by number, phone or name" className="w-full rounded-xl border border-black/[0.06] bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition placeholder:text-ink/35 focus:border-ink/30 focus:ring-4 focus:ring-accent/40" />
            </form>
          ) : <div className="flex-1" />}
          <div className="ml-auto flex items-center gap-1">
            <Link href="/" target="_blank" className="abtn abtn-ghost hidden sm:inline-flex"><AdminIcon name="external" className="h-4 w-4" /> Store</Link>
            <UserMenu admin={admin} logout={logout} />
          </div>
        </header>
        <main className="relative mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
    </MotionRoot>
  );
}
