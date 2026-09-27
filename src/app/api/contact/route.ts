import { NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { contactSchema, fieldErrors } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  if (!rateLimit(req, 'contact', 5)) return NextResponse.json({ error: 'Too many messages. Please try again in a minute.' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  if (body.website) return NextResponse.json({ ok: true }); // honeypot field filled by bots
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  const d = parsed.data;
  await db.insert(schema.messages).values({ name: d.name, email: d.email, phone: d.phone || null, orderNo: d.orderNo || null, body: d.body });
  return NextResponse.json({ ok: true });
}
