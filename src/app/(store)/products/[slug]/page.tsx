import type { Metadata } from 'next';
import { ProductView, productMetadata } from '@/components/product/ProductView';

type Params = { slug: string };

// Built on the first visit and then cached like the rest of the store (see the store layout).
export const revalidate = 30;
export const generateStaticParams = async (): Promise<Params[]> => [];

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return productMetadata((await params).slug);
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  return <ProductView slug={(await params).slug} />;
}
