import type { Metadata } from 'next';
import { ProductView, productMetadata } from '@/components/product/ProductView';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return productMetadata((await params).slug);
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  return <ProductView slug={(await params).slug} />;
}
