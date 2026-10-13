import type { Metadata } from 'next';
import { ProductView, productMetadata } from '@/components/product/ProductView';
import { OverlayTitle } from '@/components/product/ProductOverlay';
import { getProduct } from '@/lib/catalog';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return productMetadata((await params).slug);
}

/** A product clicked in the store opens here, over the current page (see ProductOverlay). */
export default async function ProductInOverlay({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  return (
    <>
      {product && <OverlayTitle title={`${product.title} — ${process.env.NEXT_PUBLIC_STORE_NAME || 'NEVER SETTLE'}`} />}
      <ProductView slug={slug} />
    </>
  );
}
