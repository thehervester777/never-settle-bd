import 'server-only';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

/** Stays under Vercel's 4.5 MB request body limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Where uploaded product images are stored on disk (outside the build, so uploads survive redeploys). */
export const uploadDir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

/**
 * Saves an uploaded image and returns its public URL.
 * With BLOB_READ_WRITE_TOKEN set (Vercel Blob), files go to Blob storage, since Vercel's disk is
 * read-only and wiped between requests. Otherwise they are written to uploadDir() and served by /uploads/[...path].
 */
export async function storeUpload(name: string, data: Buffer, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`products/${name}`, data, { access: 'public', contentType, addRandomSuffix: false });
    return blob.url;
  }
  if (process.env.VERCEL) throw new Error('On Vercel, connect a Blob store so BLOB_READ_WRITE_TOKEN is set.');
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), data);
  return `/uploads/${name}`;
}
