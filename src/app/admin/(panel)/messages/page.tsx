import Link from 'next/link';
import { count, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { fmtDateTime, timeAgo } from '@/lib/dates';
import { Card, EmptyState, PageHeader, Segmented } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Messages' };

async function toggleRead(formData: FormData) {
  'use server';
  await requirePermission('messages');
  const id = Number(formData.get('id'));
  const read = formData.get('read') === '1';
  await db.update(schema.messages).set({ isRead: read }).where(eq(schema.messages.id, id));
  revalidatePath('/admin', 'layout');
}

async function markAllRead() {
  'use server';
  await requirePermission('messages');
  await db.update(schema.messages).set({ isRead: true }).where(eq(schema.messages.isRead, false));
  revalidatePath('/admin', 'layout');
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requirePermission('messages');
  const { show } = await searchParams;
  const { messages, subscribers } = schema;
  const [rows, subs, [{ unread }]] = await Promise.all([
    db.select().from(messages).where(show === 'unread' ? eq(messages.isRead, false) : undefined).orderBy(desc(messages.createdAt)).limit(200),
    db.select().from(subscribers).orderBy(desc(subscribers.createdAt)).limit(2000),
    db.select({ unread: count() }).from(messages).where(eq(messages.isRead, false)),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description={`${Number(unread)} unread · from the contact form`}
        actions={Number(unread) > 0 ? <form action={markAllRead}><button className="abtn abtn-outline"><AdminIcon name="check" className="h-4 w-4" /> Mark all read</button></form> : undefined}
      />
      <Segmented current={show === 'unread' ? 'unread' : 'all'} items={[{ key: 'all', label: 'All', href: '/admin/messages' }, { key: 'unread', label: `Unread (${Number(unread)})`, href: '/admin/messages?show=unread' }]} />
      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-3 xl:col-span-2">
          {rows.map((m) => (
            <article key={m.id} className={`admin-card transition ${m.isRead ? 'opacity-70' : 'ring-2 ring-accent/70'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f4f4f1] text-sm font-semibold">{m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <div>
                    <p className="font-semibold">{m.name} {!m.isRead && <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">New</span>}</p>
                    <p className="text-xs text-ink/50">
                      <a className="hover:underline" href={`mailto:${m.email}`}>{m.email}</a>
                      {m.phone && <> · <a className="hover:underline" href={`tel:${m.phone}`}>{m.phone}</a></>}
                      {m.orderNo && <> · <Link className="font-medium hover:underline" href={`/admin/orders?q=${encodeURIComponent(m.orderNo)}`}>Order {m.orderNo}</Link></>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink/40" title={fmtDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</span>
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to NEVER SETTLE')}`} className="abtn abtn-sm abtn-outline"><AdminIcon name="mail" className="h-3.5 w-3.5" /> Reply</a>
                  <form action={toggleRead}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="read" value={m.isRead ? '0' : '1'} />
                    <button className="abtn abtn-sm abtn-ghost">{m.isRead ? 'Mark unread' : 'Mark read'}</button>
                  </form>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
            </article>
          ))}
          {!rows.length && <section className="admin-card"><EmptyState icon="messages" title={show === 'unread' ? 'All caught up' : 'No messages yet'} /></section>}
        </div>
        <Card title={`Newsletter sign-ups (${subs.length})`} description="Copy these into your email tool">
          <textarea readOnly className="atextarea font-mono text-xs" rows={Math.min(14, Math.max(4, subs.length))} value={subs.map((s) => s.email).join('\n')} aria-label="Subscriber emails" />
        </Card>
      </div>
    </div>
  );
}
