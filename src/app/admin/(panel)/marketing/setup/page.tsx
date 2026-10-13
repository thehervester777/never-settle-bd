import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requirePermission } from '@/lib/auth';
import { getInternalValue, getSecretSettings, getSettings, secretFromEnv } from '@/lib/settings';
import { couponState } from '@/lib/coupons';
import { feedItems } from '@/lib/feed';
import { siteUrl } from '@/lib/site';
import { timeAgo } from '@/lib/dates';
import { Card, PageHeader } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { CopyField, LinkBuilder, TestCapiButton, TrackingForm } from '@/components/admin/MarketingTools';

export const metadata = { title: 'Pixels & catalog' };

const URL_PARAMS = 'utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}';
const TIKTOK_PARAMS = 'utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__';

function Check({ ok, label, detail, optional }: { ok: boolean; label: string; detail?: React.ReactNode; optional?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${ok ? 'bg-emerald-500 text-white' : optional ? 'border border-dashed border-black/20' : 'border-2 border-amber-400'}`}>
        {ok && <AdminIcon name="check" className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 text-sm">
        <span className="font-medium">{label}</span>{optional && !ok && <span className="ml-1.5 text-xs text-ink/40">optional</span>}
        {detail && <span className="block text-xs text-ink/50">{detail}</span>}
      </span>
    </li>
  );
}

export default async function TrackingSetupPage() {
  await requirePermission('marketing');
  const site = siteUrl();
  const [s, secret, capiLast, items, products, coupons] = await Promise.all([
    getSettings(), getSecretSettings(), getInternalValue<{ ok: boolean; message: string; at: string; event: string }>('_metaCapiLast'),
    feedItems(site).catch(() => []),
    db.select({ title: schema.products.title, slug: schema.products.slug }).from(schema.products).where(eq(schema.products.isActive, true)).orderBy(asc(schema.products.title)).limit(200),
    db.select().from(schema.coupons),
  ]);
  const feedUrl = `${site}/feeds/products.xml`;
  const groups = new Set(items.map((i) => i.groupId)).size;
  const inStock = items.filter((i) => i.availability === 'in stock').length;
  const tokenFromEnv = secretFromEnv('metaCapiToken');
  const capi = !!(s.metaPixelId && secret.metaCapiToken);
  const liveCodes = coupons.filter((c) => couponState(c) === 'active').map((c) => c.code);
  const pages = [
    { label: 'Home page', path: '/' }, { label: 'All products', path: '/collections/all' },
    ...products.map((p) => ({ label: `Product: ${p.title}`, path: `/products/${p.slug}` })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Pixels & catalog" description="Connect your Facebook, Instagram, TikTok and Google ads to the store: tracking, product catalog and campaign links" />

      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 xl:col-span-2">
          <TrackingForm
            values={{
              metaPixelId: s.metaPixelId, tiktokPixelId: s.tiktokPixelId, ga4Id: s.ga4Id, googleAdsId: s.googleAdsId, googleAdsPurchaseLabel: s.googleAdsPurchaseLabel,
              metaDomainVerification: s.metaDomainVerification, googleSiteVerification: s.googleSiteVerification, whatsappNumber: s.whatsappNumber, messengerPage: s.messengerPage,
              metaTestEventCode: tokenFromEnv || secretFromEnv('metaTestEventCode') ? '' : secret.metaTestEventCode,
            }}
            token={{ saved: !!secret.metaCapiToken, hint: secret.metaCapiToken ? `(ends …${secret.metaCapiToken.slice(-4)})` : '', fromEnv: tokenFromEnv }}
          />

          <Card title="Product catalog feed" description="For Instagram & Facebook Shops, Advantage+ catalog ads, TikTok catalog and Google Shopping">
            <CopyField value={feedUrl} />
            <p className="mt-3 text-sm text-ink/60">
              <strong className="text-ink">{items.length}</strong> items ({groups} products, every size and colour separately) · {inStock} in stock. Prices, stock and photos update automatically.
              {' '}<a href="/feeds/products.xml" target="_blank" className="font-medium text-ink underline">Open the feed</a>
            </p>
            <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
              <div className="rounded-xl bg-[#f7f7f4] p-4">
                <p className="mb-2 font-semibold">Meta (Facebook &amp; Instagram)</p>
                <ol className="list-decimal space-y-1 pl-4 text-ink/65">
                  <li>Commerce Manager → Catalog → Data sources</li><li>Add items → Data feed → Scheduled feed</li><li>Paste the link, repeat daily, currency BDT</li><li>Connect the catalog to your Pixel</li>
                </ol>
              </div>
              <div className="rounded-xl bg-[#f7f7f4] p-4">
                <p className="mb-2 font-semibold">TikTok</p>
                <ol className="list-decimal space-y-1 pl-4 text-ink/65">
                  <li>Ads Manager → Assets → Catalogs</li><li>Create catalog → Add products → Data feed</li><li>Paste the link, update daily</li>
                </ol>
              </div>
              <div className="rounded-xl bg-[#f7f7f4] p-4">
                <p className="mb-2 font-semibold">Google Merchant Center</p>
                <ol className="list-decimal space-y-1 pl-4 text-ink/65">
                  <li>Products → Add products → Add from a file</li><li>Enter a link to your file</li><li>Paste the link, fetch daily</li>
                </ol>
              </div>
            </div>
            {products.length > groups && <p className="mt-3 text-xs text-amber-700">{products.length - groups} product{products.length - groups === 1 ? ' has' : 's have'} no photo, so {products.length - groups === 1 ? 'it’s' : 'they’re'} left out: every ad platform rejects items without one.</p>}
          </Card>

          <Card title="Tag your ads" description="So every order shows which campaign and ad it came from (Campaigns & ROAS)">
            <div className="space-y-4">
              <div>
                <CopyField label="Meta Ads Manager: paste into each ad → Destination → URL parameters" value={URL_PARAMS} />
                <p className="ahint">Meta fills in the campaign and ad names itself, and whether it ran on Facebook, Instagram or Messenger.</p>
              </div>
              <CopyField label="TikTok Ads Manager: ad → Destination → URL parameters (or add to the end of the URL after ?)" value={TIKTOK_PARAMS} />
            </div>
          </Card>

          <Card title="Campaign link builder" description="For bio links, stories, posts, influencers and WhatsApp/SMS blasts. Add a discount code and it applies itself.">
            <div id="links" className="scroll-mt-24">
              <LinkBuilder site={site} pages={pages} codes={liveCodes} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Setup checklist">
            <ul className="divide-y divide-black/[0.05]">
              <Check ok={!!s.metaPixelId} label="Meta Pixel" detail={s.metaPixelId ? `Pixel ${s.metaPixelId}` : 'Needed for Facebook & Instagram ads'} />
              <Check ok={capi} label="Conversions API" detail={capi ? (secret.metaTestEventCode ? `Test mode (${secret.metaTestEventCode}): remove the code to go live` : 'Purchases are also sent from the server') : 'Counts sales the browser pixel misses'} />
              <Check ok={!!s.metaDomainVerification} label="Domain verified with Meta" detail="Required to run ads that link to your site" />
              <Check ok={items.length > 0} label="Product catalog" detail={`${items.length} items in the feed`} />
              <Check ok={!!s.tiktokPixelId} label="TikTok Pixel" optional />
              <Check ok={!!s.ga4Id} label="Google Analytics 4" optional />
              <Check ok={!!(s.googleAdsId && s.googleAdsPurchaseLabel)} label="Google Ads purchase conversion" optional />
              <Check ok={!!(s.whatsappNumber || s.messengerPage)} label="WhatsApp / Messenger button" optional />
              <Check ok={liveCodes.length > 0} label="A live discount code" optional detail={liveCodes.length ? liveCodes.slice(0, 4).join(', ') : undefined} />
            </ul>
          </Card>

          <Card title="Conversions API status">
            {capiLast ? (
              <div className={`rounded-xl p-3 text-sm ${capiLast.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>
                <p className="font-medium">{capiLast.ok ? 'Working' : 'Last event failed'}</p>
                <p className="mt-0.5">{capiLast.event}: {capiLast.message}</p>
                <p className="mt-1 text-xs opacity-70">{timeAgo(new Date(capiLast.at))}</p>
              </div>
            ) : <p className="text-sm text-ink/55">Nothing sent yet. New orders are sent automatically once the Pixel ID and token are saved.</p>}
            <div className="mt-4 flex items-center gap-3">
              <TestCapiButton disabled={!capi} />
              {!capi && <span className="text-xs text-ink/45">Save the Pixel ID and token first</span>}
            </div>
            <p className="mt-3 text-xs text-ink/50">With a test event code saved, the test shows up in Events Manager → Test events within a minute.</p>
          </Card>

          <Card title="What gets tracked">
            <ul className="space-y-2 text-sm text-ink/70">
              {[
                ['Page view', 'every page'], ['View content', 'product pages'], ['Add to cart', 'every add, incl. quick add'], ['Initiate checkout', 'checkout opened'],
                ['Purchase', 'order placed, with value and products (browser + server)'], ['Search', 'store search'], ['Lead', 'newsletter sign-up'], ['Contact', 'WhatsApp, Messenger, contact form'],
              ].map(([e, w]) => <li key={e} className="flex gap-2"><AdminIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span><strong className="font-medium text-ink">{e}</strong> · {w}</span></li>)}
            </ul>
            <p className="mt-3 text-xs text-ink/50">Product ids match the catalog, so dynamic ads can show shoppers exactly what they looked at.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
