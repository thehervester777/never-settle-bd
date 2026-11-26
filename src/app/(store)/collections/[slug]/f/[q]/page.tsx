import type { Metadata } from 'next';
import { CollectionView, collectionMetadata, filtersFrom } from '@/components/product/CollectionView';

type Params = { slug: string; q: string };

/**
 * A sorted or filtered collection, e.g. /collections/all/f/sort=price-asc&size=M (see collectionPath).
 * Each combination is cached once instead of rendered for every visit.
 */
export const revalidate = 30;
export const generateStaticParams = async (): Promise<Params[]> => [];

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return { ...(await collectionMetadata((await params).slug)), robots: { index: false, follow: true } };
}

export default async function FilteredCollectionPage({ params }: { params: Promise<Params> }) {
  const { slug, q } = await params;
  // Depending on the host, the segment arrives encoded once or already decoded.
  let query = q;
  if (!query.includes('=')) { try { query = decodeURIComponent(query); } catch { query = ''; } }
  return <CollectionView slug={slug} sp={filtersFrom(query)} />;
}
