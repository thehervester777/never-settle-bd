import 'server-only';
import { asc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';

/**
 * The product catalog for ad platforms (Meta / Instagram shops and Advantage+ catalog ads,
 * TikTok catalog, Google Merchant Center), one item per size/colour. Ids match the pixel events:
 * `v{variantId}`, grouped under `p{productId}`.
 */

export type FeedItem = {
  id: string; groupId: string; title: string; description: string; link: string; image: string; images: string[];
  availability: 'in stock' | 'out of stock'; price: string; salePrice: string | null; brand: string;
  color: string | null; size: string | null; googleCategory: string; productType: string; stock: number;
};

const CATEGORY_RULES: [RegExp, string][] = [
  [/wallet|money ?clip|card ?holder/i, 'Apparel & Accessories > Handbags, Wallets & Cases > Wallets & Money Clips'],
  [/shoe|sneaker|loafer|sandal|boot|slide|slipper|footwear/i, 'Apparel & Accessories > Shoes'],
  [/punjabi|panjabi|kurta|sherwani|kameez|fatua|traditional/i, 'Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing'],
  [/short(s)?\b/i, 'Apparel & Accessories > Clothing > Shorts'],
  [/pant|trouser|jean|chino|jogger|denim/i, 'Apparel & Accessories > Clothing > Pants'],
  [/t-?shirt|tee|polo|shirt|top|hoodie|sweat/i, 'Apparel & Accessories > Clothing > Shirts & Tops'],
  [/belt/i, 'Apparel & Accessories > Clothing Accessories > Belts'],
  [/\bcap\b|hat/i, 'Apparel & Accessories > Clothing Accessories > Hats'],
];
const googleCategory = (...hints: string[]) => CATEGORY_RULES.find(([re]) => hints.some((h) => re.test(h)))?.[1] ?? 'Apparel & Accessories > Clothing';

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const money = (poisha: number) => `${(poisha / 100).toFixed(2)} BDT`;

export async function feedItems(site: string, brand = 'NEVER SETTLE'): Promise<FeedItem[]> {
  const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${site}${u.startsWith('/') ? '' : '/'}${u}`);
  const rows = await db.select({
    id: schema.products.id, title: schema.products.title, slug: schema.products.slug, description: schema.products.description,
    price: schema.products.price, compareAt: schema.products.compareAt, category: schema.categories.name, categorySlug: schema.categories.slug,
  }).from(schema.products).innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(eq(schema.products.isActive, true)).orderBy(asc(schema.products.id));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [imgs, vars] = await Promise.all([
    db.select().from(schema.productImages).where(inArray(schema.productImages.productId, ids)).orderBy(asc(schema.productImages.sortOrder), asc(schema.productImages.id)),
    db.select().from(schema.variants).where(inArray(schema.variants.productId, ids)).orderBy(asc(schema.variants.id)),
  ]);

  const out: FeedItem[] = [];
  for (const p of rows) {
    const images = imgs.filter((i) => i.productId === p.id).map((i) => abs(i.url));
    if (!images.length) continue; // every ad platform rejects items without a photo
    const onSale = p.compareAt != null && p.compareAt > p.price;
    const description = (plain(p.description) || p.title).slice(0, 5000);
    const category = googleCategory(p.category, p.categorySlug, p.title);
    for (const v of vars.filter((x) => x.productId === p.id)) {
      const options = [v.color, v.size].filter(Boolean).join(' / ');
      out.push({
        id: `v${v.id}`, groupId: `p${p.id}`,
        title: (options ? `${p.title} - ${options}` : p.title).slice(0, 150),
        description, link: `${site}/products/${p.slug}?variant=${v.id}`,
        image: images[0], images: images.slice(1, 11),
        availability: v.stock > 0 ? 'in stock' : 'out of stock',
        price: money(onSale ? p.compareAt! : p.price), salePrice: onSale ? money(p.price) : null,
        brand, color: v.color, size: v.size, googleCategory: category, productType: p.category, stock: Math.max(0, v.stock),
      });
    }
  }
  return out;
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // characters XML 1.0 doesn't allow
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** RSS 2.0 with the Google `g:` namespace: the format Meta, TikTok and Google all accept. */
export function feedXml(items: FeedItem[], site: string, title: string) {
  const tag = (name: string, value: string | null | undefined) => (value ? `<g:${name}>${esc(value)}</g:${name}>` : '');
  const body = items.map((i) => [
    '<item>',
    tag('id', i.id), tag('item_group_id', i.groupId), `<title>${esc(i.title)}</title>`, `<description>${esc(i.description)}</description>`,
    `<link>${esc(i.link)}</link>`, tag('image_link', i.image), ...i.images.map((u) => tag('additional_image_link', u)),
    tag('availability', i.availability), tag('condition', 'new'), tag('price', i.price), tag('sale_price', i.salePrice),
    tag('brand', i.brand), tag('identifier_exists', 'no'), tag('color', i.color), tag('size', i.size),
    tag('google_product_category', i.googleCategory), tag('product_type', i.productType), tag('quantity_to_sell_on_facebook', String(i.stock)),
    '</item>',
  ].join('')).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(title)}</title>
<link>${esc(site)}</link>
<description>${esc(title)} product catalog</description>
${body}
</channel>
</rss>
`;
}
