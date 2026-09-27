import { readFile, stat } from 'fs/promises';
import path from 'path';
import { uploadDir } from '@/lib/uploads';

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Serves product photos uploaded from the admin panel. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const name = parts.join('/');
  if (!/^[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(name)) return new Response('Not found', { status: 404 });
  const file = path.join(uploadDir(), name);
  try {
    const [buf, info] = await Promise.all([readFile(file), stat(file)]);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': String(info.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
