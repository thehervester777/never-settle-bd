'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ProductCard as Card } from '@/lib/catalog';
import { formatBDT } from '@/lib/money';
import { useCart } from '@/components/cart/CartProvider';
import { Swatch } from './Swatch';

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const { add } = useCart();
  const [adding, setAdding] = useState<number | null>(null);
  const [a, b] = product.images;
  const onSale = product.compareAt != null && product.compareAt > product.price;
  const isNew = product.tags.includes('new');

  const quickAdd = (variantId: number, label: string, stock: number) => {
    setAdding(variantId);
    add({
      variantId, productId: product.id, slug: product.slug, title: product.title,
      options: [product.colors[0], label === 'One size' ? null : label].filter(Boolean).join(' / '),
      image: a?.url ?? null, price: product.price, maxQty: Math.max(1, stock),
    });
    setTimeout(() => setAdding(null), 400);
  };

  return (
    <article className="group relative flex flex-col">
      <div className="relative">
        <Link href={`/products/${product.slug}`} className="relative block overflow-hidden bg-bone" style={{ aspectRatio: '4 / 5' }} aria-label={product.title}>
          {a ? (
            <>
              {b && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-700 ease-expo group-hover:scale-[1.04] group-hover:opacity-100" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.alt} loading={priority ? 'eager' : 'lazy'} className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1.2s] ease-expo group-hover:scale-[1.04] ${b ? 'group-hover:opacity-0' : ''}`} />
            </>
          ) : (
            <span className="absolute inset-0 grid place-items-center text-xs text-muted">No image</span>
          )}
          <span className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {!product.inStock && <span className="bg-ink px-2 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-paper">Sold out</span>}
            {product.inStock && onSale && <span className="bg-sale px-2 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-paper">Sale</span>}
            {isNew && <span className="bg-accent px-2 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-ink">New</span>}
          </span>
        </Link>

        {product.inStock && (
          <div className="absolute inset-x-2 bottom-2 z-10 hidden translate-y-full bg-paper/95 p-3 opacity-0 backdrop-blur transition-all duration-500 ease-expo group-hover:translate-y-0 group-hover:opacity-100 md:block">
            {product.quick ? (
              <>
                <p className="eyebrow mb-2 text-muted">Quick add</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.quick.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      disabled={q.stock <= 0}
                      onClick={() => quickAdd(q.id, q.label, q.stock)}
                      className="option-pill min-w-[2.5rem] px-2.5 py-2"
                      aria-label={`Add ${product.title} ${q.label} to cart`}
                    >
                      {adding === q.id ? '✓' : q.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <Link href={`/products/${product.slug}`} className="btn btn-primary w-full py-3">Choose options</Link>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3.5">
        <h3 className="text-sm font-medium leading-snug">
          <Link href={`/products/${product.slug}`} className="link-underline">{product.title}</Link>
        </h3>
        <p className="flex items-baseline gap-2 text-sm">
          <span className={`font-semibold ${onSale ? 'text-sale' : ''}`}>{formatBDT(product.price)}</span>
          {onSale && <s className="text-muted">{formatBDT(product.compareAt!)}</s>}
        </p>
        {product.colors.length > 1 && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {product.colors.slice(0, 5).map((c) => <Swatch key={c} name={c} className="h-3.5 w-3.5" />)}
            <span className="ml-1 text-xs text-muted">{product.colors.length} colors</span>
          </div>
        )}
      </div>
    </article>
  );
}
