import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Messages' };

async function toggleRead(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = Number(formData.get('id'));
  const read = formData.get('read') === '1';
  await db.update(schema.messages).set({ isRead: read }).where(eq(schema.messages.id, id));
  revalidatePath('/admin/messages');
}

export default async function MessagesPage() {
  const rows = await db.select().from(schema.messages).orderBy(desc(schema.messages.createdAt)).limit(200);
  const subs = await db.select().from(schema.subscribers).orderBy(desc(schema.subscribers.createdAt)).limit(500);
  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl uppercase">Messages</h1>
      <div className="space-y-3">
        {rows.map((m) => (
          <article key={m.id} className={`admin-card ${m.isRead ? 'opacity-70' : 'border-ink/30'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{m.name} {!m.isRead && <span className="ml-2 bg-accent px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">New</span>}</p>
                <p className="text-xs text-muted">
                  <a className="underline" href={`mailto:${m.email}`}>{m.email}</a>
                  {m.phone && <> · <a className="underline" href={`tel:${m.phone}`}>{m.phone}</a></>}
                  {m.orderNo && <> · Order {m.orderNo}</>}
                  {' · '}{m.createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <form action={toggleRead}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="read" value={m.isRead ? '0' : '1'} />
                <button className="text-xs underline">{m.isRead ? 'Mark unread' : 'Mark read'}</button>
              </form>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{m.body}</p>
          </article>
        ))}
        {!rows.length && <p className="admin-card text-muted">No messages yet.</p>}
      </div>
      <section className="admin-card">
        <h2 className="mb-2 font-semibold">Newsletter sign-ups ({subs.length})</h2>
        <p className="text-sm text-muted">Copy these into your email tool.</p>
        <textarea readOnly className="field-area mt-3 bg-white font-mono text-xs" rows={Math.min(10, Math.max(3, subs.length))} value={subs.map((s) => s.email).join('\n')} aria-label="Subscriber emails" />
      </section>
    </div>
  );
}
