'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

export type CartLine = {
  variantId: number;
  productId: number;
  slug: string;
  title: string;
  options: string; // "Black / L"
  image: string | null;
  price: number; // poisha, display only — the server re-prices at checkout
  quantity: number;
  maxQty: number;
};

type CartCtx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  ready: boolean;
  open: () => void;
  close: () => void;
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  setQty: (variantId: number, qty: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'ns_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the page changes (including the browser's back button).
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch { /* storage unavailable */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines, ready]);

  useEffect(() => {
    document.body.classList.toggle('scroll-locked', isOpen);
  }, [isOpen]);

  const add = useCallback<CartCtx['add']>((line, qty = 1) => {
    setLines((cur) => {
      const found = cur.find((l) => l.variantId === line.variantId);
      if (found) return cur.map((l) => (l.variantId === line.variantId ? { ...l, ...line, quantity: Math.min(l.quantity + qty, line.maxQty) } : l));
      return [...cur, { ...line, quantity: Math.min(qty, line.maxQty) }];
    });
    setOpen(true);
  }, []);

  const setQty = useCallback((variantId: number, qty: number) => {
    setLines((cur) => (qty <= 0 ? cur.filter((l) => l.variantId !== variantId) : cur.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(qty, l.maxQty) } : l))));
  }, []);

  const value = useMemo<CartCtx>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    isOpen,
    ready,
    open: () => setOpen(true),
    close: () => setOpen(false),
    add,
    setQty,
    remove: (id) => setQty(id, 0),
    clear: () => setLines([]),
  }), [lines, isOpen, ready, add, setQty]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}
