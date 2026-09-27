'use server';

import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, ne, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { toPoisha } from '@/lib/money';
import { MAX_UPLOAD_BYTES, storeUpload } from '@/lib/uploads';


const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200) || 'product';

const productSchema = z.object({
  title: z.string().trim().min(2, 'Enter a product name').max(200),
  slug: z.string().trim().max(220).optional(),
  categoryId: z.coerce.number().int().positive('Choose a category'),
  price: z.coerce.number().positive('Enter a price'),
  compareAt: z.union([z.coerce.number().positive(), z.literal('')]).optional(),
  description: z.string().trim().min(1, 'Add a description').max(20000),
  details: z.string().trim().max(20000).optional(),
  tags: z.string().trim().max(300).optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  variants: z.array(z.object({
    id: z.number().int().optional(),
    color: z.string().trim().max(60).optional(),
    size: z.string().trim().max(30).optional(),
    sku: z.string().trim().max(80).optional(),
    stock: z.coerce.number().int().min(0).max(100000),
  })).min(1, 'Add at least one variant (use one row with no color/size for single items)'),
  images: z.array(z.object({ url: z.string().min(1).max(500), alt: z.string().max(200).optional() })).max(12),
});

export type ProductFormState = { error?: string } | undefined;

/** Accepts JPEG, PNG or WebP up to 4 MB; returns the public URL. */
export async function uploadImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image to upload.' };
  const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const ext = types[file.type];
  if (!ext) return { error: 'Use a JPG, PNG or WebP image.' };
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'Images must be 4 MB or smaller.' };
  const buf = Buffer.from(await file.arrayBuffer());
  // Check the file really is an image (magic bytes), not just named like one.
  const sig = buf.subarray(0, 12);
  const isJpg = sig[0] === 0xff && sig[1] === 0xd8;
  const isPng = sig.toString('hex', 0, 8) === '89504e470d0a1a0a';
  const isWebp = sig.toString('ascii', 0, 4) === 'RIFF' && sig.toString('ascii', 8, 12) === 'WEBP';
  if (!(isJpg || isPng || isWebp)) return { error: 'That file is not a valid image.' };
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    return { error: 'Photo storage is not set up. In Vercel, go to Storage, create a Blob store, connect it to this project and redeploy.' };
  }
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;
  try {
    return { url: await storeUpload(name, buf, file.type) };
  } catch (e) {
    console.error('Image upload failed', e);
    return { error: 'Could not save the image. Please try again.' };
  }
}

export async function saveProduct(id: number | null, payload: unknown): Promise<ProductFormState> {
  await requireAdmin();
  const parsed = productSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  let slug = slugify(d.slug || d.title);
  const clash = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.slug, slug), id ? ne(schema.products.id, id) : undefined)).limit(1);
  if (clash.length) slug = `${slug}-${randomBytes(2).toString('hex')}`;

  const values = {
    title: d.title, slug, categoryId: d.categoryId, price: toPoisha(d.price),
    compareAt: d.compareAt ? toPoisha(d.compareAt) : null,
    description: d.description, details: d.details || null, tags: d.tags ?? '', isActive: d.isActive, isFeatured: d.isFeatured,
  };

  let productId = id;
  await db.transaction(async (tx) => {
    if (productId) {
      await tx.update(schema.products).set(values).where(eq(schema.products.id, productId));
    } else {
      const [r] = await tx.insert(schema.products).values(values);
      productId = Number(r.insertId);
    }
    const pid = productId!;
    // Images: replace the list in order.
    await tx.delete(schema.productImages).where(eq(schema.productImages.productId, pid));
    if (d.images.length) await tx.insert(schema.productImages).values(d.images.map((im, i) => ({ productId: pid, url: im.url, alt: im.alt ?? '', sortOrder: i })));
    // Variants: update existing rows (keeps order history links), add new ones, remove deleted ones.
    const keepIds = d.variants.filter((v) => v.id).map((v) => v.id!);
    await tx.delete(schema.variants).where(and(eq(schema.variants.productId, pid), keepIds.length ? notInArray(schema.variants.id, keepIds) : undefined));
    for (const v of d.variants) {
      const row = { productId: pid, color: v.color || null, size: v.size || null, sku: v.sku || null, stock: v.stock };
      if (v.id) await tx.update(schema.variants).set(row).where(and(eq(schema.variants.id, v.id), eq(schema.variants.productId, pid)));
      else await tx.insert(schema.variants).values(row);
    }
  });

  revalidatePath('/', 'layout');
  redirect(`/admin/products/${productId}?saved=1`);
}

export async function deleteProduct(id: number) {
  await requireAdmin();
  // Hide rather than delete when the product has orders, so order history stays intact.
  const used = await db.select({ id: schema.orderItems.id }).from(schema.orderItems).where(eq(schema.orderItems.productId, id)).limit(1);
  if (used.length) {
    await db.update(schema.products).set({ isActive: false }).where(eq(schema.products.id, id));
  } else {
    await db.delete(schema.productImages).where(eq(schema.productImages.productId, id));
    await db.delete(schema.variants).where(eq(schema.variants.productId, id));
    await db.delete(schema.products).where(eq(schema.products.id, id));
  }
  revalidatePath('/', 'layout');
  redirect('/admin/products');
}
