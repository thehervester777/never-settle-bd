'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useCart } from '@/components/cart/CartProvider';
import { QtyControl } from '@/components/cart/CartDrawer';
import { Icon } from '@/components/ui/Icon';
import { formatBDT } from '@/lib/money';
import { Swatch } from './Swatch';

type V = { id: number; color: string | null; size: string | null; stock: number };
type P = { id: number; slug: string; title: string; price: number; compareAt: number | null; image: string | null; variants: V[] };

export function ProductBuy({ product, deliveryNote }: { product: P; deliveryNote: string }) {
  const { add } = useCart();
  const colors = useMemo(() => [...new Set(product.variants.map((v) => v.color).filter(Boolean))] as string[], [product.variants]);
  const sizes = useMemo(() => [...new Set(product.variants.map((v) => v.size).filter(Boolean))] as string[], [product.variants]);
  const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [color, setColor] = useState<string | null>(firstInStock?.color ?? null);
  const [size, setSize] = useState<string | null>(sizes.length ? null : firstInStock?.size ?? null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  const find = (c: string | null, s: string | null) => product.variants.find((v) => (colors.length ? v.color === c : true) && (sizes.length ? v.size === s : true));
  const variant = find(color, size);
  const onSale = product.compareAt != null && product.compareAt > product.price;
  const soldOut = product.variants.every((v) => v.stock <= 0);

  const onAdd = () => {
    if (sizes.length && !size) { setError('Please choose a size'); return; }
    if (!variant || variant.stock <= 0) { setError('This option is sold out'); return; }
    setError('');
    add({
      variantId: variant.id, productId: product.id, slug: product.slug, title: product.title,
      options: [variant.color, variant.size].filter(Boolean).join(' / '), image: product.image,
      price: product.price, maxQty: variant.stock,
    }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div>
      <p className="mt-4 flex flex-wrap items-baseline gap-3 text-xl">
        <span className={`font-semibold ${onSale ? 'text-sale' : ''}`}>{formatBDT(product.price)}</span>
        {onSale && <>
          <s className="text-muted">{formatBDT(product.compareAt!)}</s>
          <span className="bg-sale px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-paper">Save {formatBDT(product.compareAt! - product.price)}</span>
        </>}
      </p>

      {colors.length > 0 && (
        <fieldset className="mt-8">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]">Color: <span className="font-normal normal-case tracking-normal text-muted">{color}</span></legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const any = product.variants.some((v) => v.color === c && v.stock > 0);
              return (
                <button key={c} type="button" className="swatch" aria-pressed={color === c} disabled={!any} title={c} onClick={() => { setColor(c); setError(''); }}>
                  <Swatch name={c} className="h-8 w-8" /><span className="sr-only">{c}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset className="mt-6">
          <legend className="mb-3 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-[0.18em]">
            <span>Size: <span className="font-normal normal-case tracking-normal text-muted">{size ?? 'Choose'}</span></span>
            <Link href="/size-guide" target="_blank" className="link-underline text-xs normal-case tracking-normal">Size guide</Link>
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const v = find(color, s);
              return (
                <button key={s} type="button" className="option-pill" aria-pressed={size === s} disabled={!v || v.stock <= 0} onClick={() => { setSize(s); setQty(1); setError(''); }}>{s}</button>
              );
            })}
          </div>
        </fieldset>
      )}

      {!soldOut && (
        <div className="mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]">Quantity</p>
          <QtyControl value={qty} max={variant?.stock ?? 1} onChange={(n) => setQty(Math.max(1, n))} />
        </div>
      )}

      <div className="mt-8">
        <button type="button" onClick={onAdd} disabled={soldOut} className="btn btn-primary w-full py-5 text-sm">
          <motion.span key={String(added)} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-flex items-center gap-2">
            {soldOut ? 'Sold out' : added ? <><Icon name="check" className="h-4 w-4" /> Added to cart</> : 'Add to cart'}
          </motion.span>
        </button>
        {error && <p className="mt-3 text-sm text-sale" role="alert">{error}</p>}
        {variant && variant.stock > 0 && variant.stock <= 5 && (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sale"><span className="h-2 w-2 animate-pulse rounded-full bg-sale" />Only {variant.stock} left</p>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Icon name="truck" className="mt-px h-4 w-4 shrink-0" /><span>{deliveryNote}</span></p>
      </div>
    </div>
  );
}
