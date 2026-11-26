import { getSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { MEDIA_TYPES, UploadError, storeMediaStream, type MediaType } from '@/lib/uploads';

/** What each upload is for: who may send it, which files it takes, and the file name prefix. */
const PURPOSES = {
  slider: { perm: 'settings', kinds: ['image', 'video'], folder: 'slide' },
  category: { perm: 'products', kinds: ['image'], folder: 'category' },
} as const;

/**
 * Uploads a picture or video for the homepage slider or a category. The file is the raw request body
 * (the admin page sends it with upload progress); the custom header keeps other sites from posting here.
 */
export async function POST(req: Request) {
  const key = req.headers.get('x-upload') ?? '';
  if (!Object.hasOwn(PURPOSES, key)) return Response.json({ error: 'Bad request.' }, { status: 400 });
  const purpose = PURPOSES[key as keyof typeof PURPOSES];
  const admin = await getSession();
  if (!admin || !can(admin.role, purpose.perm)) return Response.json({ error: 'Please log in again.' }, { status: 403 });

  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!(type in MEDIA_TYPES)) return Response.json({ error: 'Use a JPG, PNG or WebP picture, or an MP4 or WebM video.' }, { status: 415 });
  const info = MEDIA_TYPES[type as MediaType];
  if (!(purpose.kinds as readonly string[]).includes(info.kind)) return Response.json({ error: 'Use a JPG, PNG or WebP picture.' }, { status: 415 });
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > info.max) return Response.json({ error: `This ${info.kind} is too big: the limit is ${Math.round(info.max / 1024 / 1024)} MB.` }, { status: 413 });
  if (!req.body) return Response.json({ error: 'The file is empty.' }, { status: 400 });

  try {
    const url = await storeMediaStream(req.body, type as MediaType, purpose.folder);
    return Response.json({ url, kind: info.kind });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: e.status });
    console.error('Upload failed', e);
    return Response.json({ error: 'Could not save the file. Please try again.' }, { status: 500 });
  }
}
