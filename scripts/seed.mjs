#!/usr/bin/env node
/**
 * Adds the six categories and a set of sample products so the store isn't empty on day one.
 *   npm run db:seed              -> categories + sample products (skips if products already exist)
 *   npm run db:seed -- --categories-only
 * Replace or delete the sample products from the admin panel before launch.
 */
import mysql from 'mysql2/promise';
import { loadEnv } from './load-env.mjs';

loadEnv();
const onlyCategories = process.argv.includes('--categories-only');
const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, charset: 'utf8mb4' });

const CATEGORIES = [
  ['T-shirts', 'tshirts', 'Heavyweight and oversized tees for every day.'],
  ['Pants', 'pants', 'Cargos and chinos that hold their shape.'],
  ['Punjabis', 'punjabis', 'Festive and everyday punjabis in cotton and linen.'],
  ['Kurtas', 'kurtas', 'Short and classic kurtas for easy, polished days.'],
  ['Shoes', 'shoes', 'Sneakers and leather shoes built for miles.'],
  ['Wallets', 'wallets', 'Leather wallets and card holders.'],
];

for (const [i, [name, slug, description]] of CATEGORIES.entries()) {
  await conn.execute(
    'INSERT INTO categories (name, slug, description, image, sort_order) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
    [name, slug, description, `/images/categories/${slug}.jpg`, i],
  );
}
console.log('Categories ready.');

const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM products');
if (onlyCategories || n > 0) {
  console.log(n > 0 ? 'Products already exist, skipping sample products.' : 'Skipped sample products.');
  await conn.end();
  process.exit(0);
}

const [cats] = await conn.query('SELECT id, slug FROM categories');
const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
const TEE = ['S', 'M', 'L', 'XL', 'XXL'];
const PANTS = ['28', '30', '32', '34', '36'];
const SHOES = ['39', '40', '41', '42', '43', '44'];

// title, category, image key, price ৳, was ৳, colors, sizes, tags, featured, description
const PRODUCTS = [
  ['Core Heavyweight Tee', 'tshirts', 'tee1', 990, null, ['Black', 'Off-white', 'Olive', 'Navy'], TEE, 'new', true, '220gsm combed cotton with a relaxed body and a ribbed collar that keeps its shape wash after wash.'],
  ['Signature Oversized Tee', 'tshirts', 'tee2', 1190, null, ['Off-white'], TEE, '', true, 'Boxy, drop-shoulder fit in 240gsm cotton jersey. Made to be worn loose.'],
  ['Motion Cargo Pants', 'pants', 'pant1', 2450, null, ['Olive'], PANTS, 'new', true, 'Twill cargo pants with a tapered leg, six pockets and a soft brushed waistband.'],
  ['Everyday Chino Pants', 'pants', 'pant2', 2190, 2590, ['Khaki'], PANTS, '', true, 'Stretch cotton chinos with a clean straight cut for office days and weekends.'],
  ['Eid Cotton Punjabi', 'punjabis', 'punj1', 3490, null, ['Off-white'], TEE, 'new', false, 'Fine cotton punjabi with tonal embroidery along the placket and concealed side pockets.'],
  ['Embroidered Linen Punjabi', 'punjabis', 'punj2', 4290, 4990, ['Maroon'], TEE, '', false, 'Linen-blend punjabi with gold thread embroidery and a mandarin collar. Breathable for long festive days.'],
  ['Short Linen Kurta', 'kurtas', 'kurt1', 2290, null, ['Sage'], TEE, '', false, 'Hip-length kurta in washed linen with side slits. Pairs with chinos or jeans.'],
  ['Classic Cotton Kurta', 'kurtas', 'kurt2', 2590, null, ['Navy'], TEE, 'new', false, 'Mid-length cotton kurta with a button placket and a comfortable regular fit.'],
  ['Street Runner Sneakers', 'shoes', 'shoe1', 4990, null, ['White'], SHOES, '', false, 'Low-top sneakers with a cushioned EVA midsole and a grippy rubber outsole.'],
  ['Leather Penny Loafers', 'shoes', 'shoe2', 5490, 5990, ['Brown'], SHOES, '', false, 'Full-grain leather loafers with a padded insole and stitched leather sole.'],
  ['Slim Leather Bifold', 'wallets', 'wal1', 1290, null, [], [], '', false, 'Genuine leather bifold with six card slots, a note pocket and hand-finished edges.'],
  ['Card Holder Wallet', 'wallets', 'wal2', 890, null, [], [], 'new', false, 'Minimal card holder with four slots and a centre pocket. Fits front pockets easily.'],
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let offset = 0;
for (const [title, cat, img, price, was, colors, sizes, tags, featured, description] of PRODUCTS) {
  const created = new Date(Date.now() - (offset++) * 3600 * 1000);
  const [r] = await conn.execute(
    'INSERT INTO products (title, slug, description, details, category_id, price, compare_at, tags, is_active, is_featured, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [title, slugify(title), `<p>${description}</p>`, '<p>Wash cold, inside out. Dry in the shade.</p>', catId[cat], price * 100, was ? was * 100 : null, tags, featured ? 1 : 0, created],
  );
  const pid = r.insertId;
  await conn.execute('INSERT INTO product_images (product_id, url, alt, sort_order) VALUES (?, ?, ?, 0), (?, ?, ?, 1)', [pid, `/images/products/${img}a.jpg`, title, pid, `/images/products/${img}b.jpg`, title]);
  const colorList = colors.length ? colors : [null];
  const sizeList = sizes.length ? sizes : [null];
  for (const c of colorList) for (const [si, s] of sizeList.entries()) {
    const stock = sizes.length ? (si === 1 ? 3 : si === sizeList.length - 1 ? 0 : 12) : 20;
    await conn.execute('INSERT INTO variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)', [pid, c, s, stock]);
  }
}
console.log(`Added ${PRODUCTS.length} sample products.`);
await conn.end();
