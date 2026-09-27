import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/settings';
import { sslcommerzConfigured } from '@/lib/sslcommerz';
import { toPoisha } from '@/lib/money';

export const metadata = { title: 'Settings' };

async function save(formData: FormData) {
  'use server';
  await requireAdmin();
  const n = (k: string) => Math.max(0, toPoisha(Number(formData.get(k) || 0)));
  const t = (k: string) => String(formData.get(k) ?? '').trim().slice(0, 500);
  await saveSettings({
    shippingInsideDhaka: n('shippingInsideDhaka'),
    shippingOutsideDhaka: n('shippingOutsideDhaka'),
    freeShippingThreshold: n('freeShippingThreshold'),
    codEnabled: formData.get('codEnabled') === 'on',
    sslcommerzEnabled: formData.get('sslcommerzEnabled') === 'on',
    announcement: t('announcement'),
    phone: t('phone'), email: t('email'), address: t('address'), hours: t('hours'),
    instagram: t('instagram'), facebook: t('facebook'), tiktok: t('tiktok'),
    paymentLabels: t('paymentLabels'),
  });
  revalidatePath('/', 'layout');
  redirect('/admin/settings?saved=1');
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const s = await getSettings();
  const { saved } = await searchParams;
  const sandbox = process.env.SSLCZ_SANDBOX !== 'false';
  const taka = (p: number) => String(p / 100);
  const input = (name: string, label: string, value: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={value} className="field bg-white" {...props} /></div>
  );

  return (
    <form action={save} className="max-w-3xl space-y-6">
      <h1 className="font-display text-4xl uppercase">Settings</h1>
      {saved && <p className="bg-emerald-100 p-3 text-sm text-emerald-900">Saved. Changes are live in the store.</p>}

      <section className="admin-card space-y-4">
        <h2 className="font-semibold">Payments</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="codEnabled" defaultChecked={s.codEnabled} className="checkbox" /> Accept cash on delivery</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sslcommerzEnabled" defaultChecked={s.sslcommerzEnabled} className="checkbox" /> Accept online payments (SSLCOMMERZ)</label>
        <p className={`p-3 text-xs ${sslcommerzConfigured() ? (sandbox ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900') : 'bg-red-100 text-red-900'}`}>
          {!sslcommerzConfigured()
            ? 'SSLCOMMERZ is not connected. Add SSLCZ_STORE_ID and SSLCZ_STORE_PASSWORD to the server environment.'
            : sandbox
              ? 'SSLCOMMERZ is in TEST (sandbox) mode: no real money is taken. Set SSLCZ_SANDBOX="false" with your live credentials to go live.'
              : 'SSLCOMMERZ is LIVE: real payments are being taken.'}
        </p>
        {input('paymentLabels', 'Payment methods shown to shoppers (comma separated)', s.paymentLabels)}
      </section>

      <section className="admin-card space-y-4">
        <h2 className="font-semibold">Delivery</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {input('shippingInsideDhaka', 'Inside Dhaka (৳)', taka(s.shippingInsideDhaka), { type: 'number', min: 0 })}
          {input('shippingOutsideDhaka', 'Outside Dhaka (৳)', taka(s.shippingOutsideDhaka), { type: 'number', min: 0 })}
          {input('freeShippingThreshold', 'Free delivery over (৳, 0 = off)', taka(s.freeShippingThreshold), { type: 'number', min: 0 })}
        </div>
      </section>

      <section className="admin-card space-y-4">
        <h2 className="font-semibold">Announcement bar</h2>
        {input('announcement', 'Messages (separate with |)', s.announcement)}
      </section>

      <section className="admin-card space-y-4">
        <h2 className="font-semibold">Contact details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {input('phone', 'Phone', s.phone)}
          {input('email', 'Email', s.email, { type: 'email' })}
          {input('address', 'Address', s.address)}
          {input('hours', 'Opening hours', s.hours)}
        </div>
      </section>

      <section className="admin-card space-y-4">
        <h2 className="font-semibold">Social links</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {input('instagram', 'Instagram URL', s.instagram, { type: 'url' })}
          {input('facebook', 'Facebook URL', s.facebook, { type: 'url' })}
          {input('tiktok', 'TikTok URL', s.tiktok, { type: 'url' })}
        </div>
      </section>

      <button className="btn btn-primary">Save settings</button>
    </form>
  );
}
