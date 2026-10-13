import { feedItems, feedXml } from '@/lib/feed';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * Product catalog feed. Paste https://your-domain/feeds/products.xml into Meta Commerce Manager
 * (Catalog → Data sources → Data feed → Scheduled), TikTok Catalog Manager or Google Merchant Center.
 */
export async function GET(req: Request) {
  const site = siteUrl(req);
  const store = process.env.NEXT_PUBLIC_STORE_NAME || 'NEVER SETTLE';
  try {
    const xml = feedXml(await feedItems(site, store), site, store);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' } });
  } catch (e) {
    console.error('Product feed failed', e);
    return new Response('Feed temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } });
  }
}
