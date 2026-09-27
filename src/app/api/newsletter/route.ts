import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  if (!rateLimit(req, 'newsletter', 10)) return NextResponse.json({ error: 'Too many attempts. Please try again in a minute.' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(160) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  await db.insert(schema.subscribers).values({ email: parsed.data.email }).onDuplicateKeyUpdate({ set: { email: parsed.data.email } });
  return NextResponse.json({ ok: true });
}
