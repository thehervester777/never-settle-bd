import { getSession } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { MEDIA_TYPES, UploadError, storeMediaStream, type MediaType } from '@/lib/uploads';

/**
 * Uploads a picture or video for the homepage slider. The file is the raw request body (the admin
 * page sends it with upload progress); the custom header keeps other sites from posting here.
 */
export async function POST(req: Request) {
  const admin = await getSession();
  if (!admin || !can(admin.role, 'settings')) return Response.json({ error: 'Please log in again.' }, { status: 403 });
  if (req.headers.get('x-upload') !== 'slider') return Response.json({ error: 'Bad request.' }, { status: 400 });

  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!(type in MEDIA_TYPES)) return Response.json({ error: 'Use a JPG, PNG or WebP picture, or an MP4 or WebM video.' }, { status: 415 });
  const info = MEDIA_TYPES[type as MediaType];
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > info.max) return Response.json({ error: `This ${info.kind} is too big: the limit is ${Math.round(info.max / 1024 / 1024)} MB.` }, { status: 413 });
  if (!req.body) return Response.json({ error: 'The file is empty.' }, { status: 400 });

  try {
    const url = await storeMediaStream(req.body, type as MediaType, 'slide');
    return Response.json({ url, kind: info.kind });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: e.status });
    console.error('Slider upload failed', e);
    return Response.json({ error: 'Could not save the file. Please try again.' }, { status: 500 });
  }
}
