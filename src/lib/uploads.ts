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

/* ---------------------------------------------------------------- Large media (homepage slider) */

export const MEDIA_TYPES = {
  'image/jpeg': { ext: 'jpg', kind: 'image', max: 10 * 1024 * 1024 },
  'image/png': { ext: 'png', kind: 'image', max: 10 * 1024 * 1024 },
  'image/webp': { ext: 'webp', kind: 'image', max: 10 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', kind: 'video', max: 60 * 1024 * 1024 },
  'video/webm': { ext: 'webm', kind: 'video', max: 60 * 1024 * 1024 },
} as const;
export type MediaType = keyof typeof MEDIA_TYPES;

/** Checks the first bytes of a file, so a renamed file can't pass as a picture or video. */
export function looksLike(type: MediaType, head: Buffer) {
  switch (type) {
    case 'image/jpeg': return head[0] === 0xff && head[1] === 0xd8;
    case 'image/png': return head.toString('hex', 0, 8) === '89504e470d0a1a0a';
    case 'image/webp': return head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP';
    case 'video/mp4': return head.toString('ascii', 4, 8) === 'ftyp';
    case 'video/webm': return head.toString('hex', 0, 4) === '1a45dfa3';
  }
}

export class UploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/**
 * Saves a picture or video sent as the raw request body, writing it to disk as it arrives
 * (videos can be tens of MB, too big to hold in memory). Returns the public URL.
 */
export async function storeMediaStream(body: ReadableStream<Uint8Array>, type: MediaType, folder: string): Promise<string> {
  const { ext, max } = MEDIA_TYPES[type];
  const { randomBytes } = await import('crypto');
  const name = `${folder}-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL) {
    // Vercel accepts request bodies up to 4.5 MB, so on Vercel larger files never arrive here.
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > max) throw new UploadError('This file is too big.', 413);
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);
    if (!looksLike(type, buf.subarray(0, 16))) throw new UploadError('That file is not a valid picture or video.');
    return storeUpload(name, buf, type);
  }

  const { createWriteStream } = await import('fs');
  const { rename, rm } = await import('fs/promises');
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const final = path.join(dir, name);
  const temp = `${final}.part`;
  const out = createWriteStream(temp);
  let size = 0;
  let head = Buffer.alloc(0);
  try {
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > max) throw new UploadError(`This file is too big (the limit is ${Math.round(max / 1024 / 1024)} MB).`, 413);
      if (head.length < 16) {
        head = Buffer.concat([head, Buffer.from(chunk)]).subarray(0, 16);
        if (head.length >= 16 && !looksLike(type, head)) throw new UploadError('That file is not a valid picture or video.');
      }
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
    }
    if (size === 0) throw new UploadError('The file is empty.');
    if (head.length < 16 && !looksLike(type, head)) throw new UploadError('That file is not a valid picture or video.');
    await new Promise<void>((resolve, reject) => out.end((e?: Error | null) => (e ? reject(e) : resolve())));
    await rename(temp, final);
    return `/uploads/${name}`;
  } catch (e) {
    out.destroy();
    await rm(temp, { force: true });
    throw e;
  }
}
