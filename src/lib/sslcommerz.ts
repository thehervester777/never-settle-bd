import 'server-only';
import crypto from 'crypto';

/**
 * SSLCOMMERZ v4 integration.
 *  1. initSession()  -> POST order details, receive GatewayPageURL, redirect the shopper there.
 *  2. Shopper pays; SSLCOMMERZ POSTs to our success/fail/cancel URLs and to the IPN listener.
 *  3. validate()     -> we ask SSLCOMMERZ's validation API whether val_id is genuine before marking the order paid.
 */

const sandbox = () => process.env.SSLCZ_SANDBOX !== 'false';
const base = () => (sandbox() ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com');

export function sslcommerzConfigured() {
  return Boolean(process.env.SSLCZ_STORE_ID && process.env.SSLCZ_STORE_PASSWORD);
}

export type InitInput = {
  tranId: string;
  amount: number; // poisha
  orderNumber: string;
  customer: { name: string; email?: string | null; phone: string; address: string; city: string };
  itemCount: number;
  productNames: string;
  siteUrl: string;
};

export async function initSession(i: InitInput): Promise<{ ok: true; url: string; sessionKey: string } | { ok: false; error: string }> {
  const cb = (s: string) => `${i.siteUrl}/api/payments/sslcommerz/${s}`;
  const body = new URLSearchParams({
    store_id: process.env.SSLCZ_STORE_ID!,
    store_passwd: process.env.SSLCZ_STORE_PASSWORD!,
    total_amount: (i.amount / 100).toFixed(2),
    currency: 'BDT',
    tran_id: i.tranId,
    success_url: cb('success'),
    fail_url: cb('fail'),
    cancel_url: cb('cancel'),
    ipn_url: cb('ipn'),
    value_a: i.orderNumber,
    cus_name: i.customer.name,
    cus_email: i.customer.email || 'no-email@customer.local',
    cus_phone: i.customer.phone,
    cus_add1: i.customer.address.slice(0, 200),
    cus_city: i.customer.city,
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    shipping_method: 'Courier',
    ship_name: i.customer.name,
    ship_add1: i.customer.address.slice(0, 200),
    ship_city: i.customer.city,
    ship_postcode: '1000',
    ship_country: 'Bangladesh',
    num_of_item: String(i.itemCount),
    product_name: i.productNames.slice(0, 250) || 'Clothing',
    product_category: 'Clothing',
    product_profile: 'physical-goods',
  });
  try {
    const res = await fetch(`${base()}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    const data = await res.json();
    if (data?.status === 'SUCCESS' && data?.GatewayPageURL) {
      return { ok: true, url: data.GatewayPageURL, sessionKey: data.sessionkey };
    }
    return { ok: false, error: data?.failedreason || 'Payment gateway did not accept the request.' };
  } catch (e) {
    return { ok: false, error: 'Could not reach the payment gateway. Please try again.' };
  }
}

export type Validation = {
  valid: boolean;
  status: string;
  tranId?: string;
  amount?: number; // poisha
  currency?: string;
  cardType?: string;
  bankTranId?: string;
  raw: unknown;
};

/** Order Validation API: the only trustworthy confirmation that a payment succeeded. */
export async function validate(valId: string): Promise<Validation> {
  const url = new URL(`${base()}/validator/api/validationserverAPI.php`);
  url.searchParams.set('val_id', valId);
  url.searchParams.set('store_id', process.env.SSLCZ_STORE_ID!);
  url.searchParams.set('store_passwd', process.env.SSLCZ_STORE_PASSWORD!);
  url.searchParams.set('v', '1');
  url.searchParams.set('format', 'json');
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const d = await res.json();
    const status = String(d?.status ?? 'UNKNOWN');
    return {
      valid: status === 'VALID' || status === 'VALIDATED',
      status,
      tranId: d?.tran_id,
      amount: d?.amount != null ? Math.round(parseFloat(d.amount) * 100) : undefined,
      currency: d?.currency_type || d?.currency,
      cardType: d?.card_type,
      bankTranId: d?.bank_tran_id,
      raw: d,
    };
  } catch {
    return { valid: false, status: 'UNREACHABLE', raw: null };
  }
}

/**
 * IPN/redirect hash check (verify_sign). SSLCOMMERZ signs the fields listed in verify_key with md5(store_passwd).
 * We still call validate() afterwards; this only rejects obviously forged posts early.
 */
export function verifySign(fields: Record<string, string>): boolean {
  const keys = fields.verify_key?.split(',');
  if (!keys?.length || !fields.verify_sign) return false;
  const data: Record<string, string> = { store_passwd: crypto.createHash('md5').update(process.env.SSLCZ_STORE_PASSWORD || '').digest('hex') };
  for (const k of keys) data[k] = fields[k] ?? '';
  const str = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('&');
  return crypto.createHash('md5').update(str).digest('hex') === fields.verify_sign;
}

/** Unguessable transaction id (max 30 chars for SSLCOMMERZ), e.g. NS-10001-9F3A61C2D4. */
export const newTranId = (orderNumber: string) => `${orderNumber}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
