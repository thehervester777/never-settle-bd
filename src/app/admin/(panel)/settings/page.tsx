import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/settings';
import { toPoisha } from '@/lib/money';
import { logActivity } from '@/lib/activity';
import { Card, PageHeader } from '@/components/admin/ui';

export const metadata = { title: 'Settings' };

async function save(formData: FormData) {
  'use server';
  const admin = await requirePermission('settings');
  const n = (k: string) => Math.max(0, toPoisha(Number(formData.get(k) || 0)));
  const t = (k: string, max = 500) => String(formData.get(k) ?? '').trim().slice(0, max);
  await saveSettings({
    shippingInsideDhaka: n('shippingInsideDhaka'),
    shippingOutsideDhaka: n('shippingOutsideDhaka'),
    freeShippingThreshold: n('freeShippingThreshold'),
    codEnabled: formData.get('codEnabled') === 'on',
    announcement: t('announcement'),
    phone: t('phone'), email: t('email'), address: t('address'), hours: t('hours'),
    instagram: t('instagram'), facebook: t('facebook'), tiktok: t('tiktok'),
    paymentLabels: t('paymentLabels'),
    lowStockThreshold: Math.min(1000, Math.max(0, Math.round(Number(formData.get('lowStockThreshold') || 0)))),
    invoiceNote: t('invoiceNote', 300),
  });
  await logActivity(admin, 'settings.update', 'settings', null, 'Updated store settings');
  revalidatePath('/', 'layout');
  redirect('/admin/settings?flash=saved');
}

export default async function SettingsPage() {
  await requirePermission('settings');
  const s = await getSettings();
  const taka = (p: number) => String(p / 100);
  const input = (name: string, label: string, value: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div><label className="alabel" htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={value} className="ainput" {...props} />{hint && <p className="ahint">{hint}</p>}</div>
  );

  return (
    <form action={save} className="max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Changes go live in the store as soon as you save" actions={<button className="abtn abtn-primary">Save settings</button>} />

      <Card title="Ordering & payments">
        <label className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-[#f7f7f4] px-4 py-3 text-sm">
          <span><span className="font-medium">Accept cash on delivery</span><span className="block text-xs text-ink/50">Turn off to pause all new orders.</span></span>
          <input type="checkbox" name="codEnabled" defaultChecked={s.codEnabled} className="acheck h-5 w-5" />
        </label>
        {input('paymentLabels', 'Payment methods shown to shoppers', s.paymentLabels, {}, 'Comma separated, shown in the footer and cart.')}
      </Card>

      <Card title="Delivery charges">
        <div className="grid gap-4 sm:grid-cols-3">
          {input('shippingInsideDhaka', 'Inside Dhaka (৳)', taka(s.shippingInsideDhaka), { type: 'number', min: 0 })}
          {input('shippingOutsideDhaka', 'Outside Dhaka (৳)', taka(s.shippingOutsideDhaka), { type: 'number', min: 0 })}
          {input('freeShippingThreshold', 'Free delivery over (৳)', taka(s.freeShippingThreshold), { type: 'number', min: 0 }, '0 turns free delivery off.')}
        </div>
      </Card>

      <Card title="Inventory & invoices">
        <div className="grid gap-4 sm:grid-cols-3">
          {input('lowStockThreshold', 'Low stock alert at (units)', String(s.lowStockThreshold), { type: 'number', min: 0, max: 1000 }, 'Sizes with this many or fewer show as low stock.')}
          <div className="sm:col-span-2">{input('invoiceNote', 'Note printed on invoices', s.invoiceNote, { maxLength: 300 }, 'Your exchange policy or a thank-you line.')}</div>
        </div>
      </Card>

      <Card title="Announcement bar">
        {input('announcement', 'Messages', s.announcement, {}, 'Separate messages with | (they rotate at the top of the store).')}
      </Card>

      <Card title="Contact details" description="Shown in the footer, contact page and on invoices">
        <div className="grid gap-4 sm:grid-cols-2">
          {input('phone', 'Phone', s.phone)}
          {input('email', 'Email', s.email, { type: 'email' })}
          {input('address', 'Address', s.address)}
          {input('hours', 'Opening hours', s.hours)}
        </div>
      </Card>

      <Card title="Social links">
        <div className="grid gap-4 sm:grid-cols-3">
          {input('instagram', 'Instagram URL', s.instagram, { type: 'url' })}
          {input('facebook', 'Facebook URL', s.facebook, { type: 'url' })}
          {input('tiktok', 'TikTok URL', s.tiktok, { type: 'url' })}
        </div>
      </Card>

      <div className="flex justify-end"><button className="abtn abtn-primary px-6 py-3">Save settings</button></div>
    </form>
  );
}
