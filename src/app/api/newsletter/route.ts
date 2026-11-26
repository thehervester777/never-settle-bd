import { NextResponse } from 'next/server';
import { readJson } from '@/lib/body';
import { z } from 'zod';
import { db, schema } from '@/db';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  if (!rateLimit(req, 'newsletter', 10)) return NextResponse.json({ error: 'Too many attempts. Please try again in a minute.' }, { status: 429 });
  let body: Record<string, unknown>;
  try { body = (await readJson(req, 16 * 1024)) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Request too large.' }, { status: 413 }); }
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(160) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  await db.insert(schema.subscribers).values({ email: parsed.data.email }).onDuplicateKeyUpdate({ set: { email: parsed.data.email } });
  return NextResponse.json({ ok: true });
}
