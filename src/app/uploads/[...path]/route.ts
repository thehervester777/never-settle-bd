import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { uploadDir } from '@/lib/uploads';

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

/**
 * Serves photos and videos uploaded from the admin panel. Videos are sent in parts on request
 * (HTTP range requests), which iPhones need before they play a video and which lets visitors skip ahead.
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const name = (await params).path.join('/');
  if (!/^[a-z0-9-]+\.(jpg|jpeg|png|webp|mp4|webm)$/i.test(name)) return new Response('Not found', { status: 404 });
  const file = path.join(uploadDir(), name);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const headers: Record<string, string> = {
    'Content-Type': TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  };
  const body = (start: number, end: number) => Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;

  const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    // "bytes=100-199", "bytes=100-" or the last N bytes "bytes=-500"
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    }
    start = Math.max(0, start);
    return new Response(body(start, end), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(body(0, Math.max(0, size - 1)), { headers: { ...headers, 'Content-Length': String(size) } });
}
