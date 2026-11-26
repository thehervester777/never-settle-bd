import type { Metadata } from 'next';
import { CollectionView, collectionMetadata } from '@/components/product/CollectionView';

type Params = { slug: string };

// Cached like the rest of the store; sorted and filtered views live at ./f/[q].
export const revalidate = 30;
export const generateStaticParams = async (): Promise<Params[]> => [];

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return collectionMetadata((await params).slug);
}

export default async function CollectionPage({ params }: { params: Promise<Params> }) {
  return <CollectionView slug={(await params).slug} sp={{}} />;
}
