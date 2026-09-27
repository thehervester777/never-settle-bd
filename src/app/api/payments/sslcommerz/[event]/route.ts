import { NextResponse } from 'next/server';
import { abandonPayment, confirmPayment, readForm } from '@/lib/payments';
import { orderToken } from '@/lib/orders';

/**
 * SSLCOMMERZ calls these URLs:
 *   success / fail / cancel — the shopper's browser is POSTed back here after the payment page
 *   ipn                     — server-to-server notification (set this URL in your SSLCOMMERZ merchant panel too)
 */
export async function POST(req: Request, { params }: { params: Promise<{ event: string }> }) {
  const { event } = await params;
  const fields = await readForm(req);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');

  if (event === 'ipn') {
    if (fields.status === 'VALID' || fields.status === 'VALIDATED') {
      const r = await confirmPayment(fields);
      return new NextResponse(r.ok ? 'OK' : `IGNORED: ${r.reason}`, { status: 200 });
    }
    if (fields.tran_id && (fields.status === 'FAILED' || fields.status === 'CANCELLED')) await abandonPayment(fields.tran_id, fields.status);
    return new NextResponse('OK', { status: 200 });
  }

  if (event === 'success') {
    const r = await confirmPayment(fields);
    if (r.ok) return NextResponse.redirect(`${site}/order/${r.order.number}?t=${orderToken(r.order.number)}&paid=1`, 303);
    const order = fields.tran_id ? await abandonPayment(fields.tran_id, 'FAILED') : null;
    return NextResponse.redirect(`${site}/checkout?payment=failed${order ? `&order=${order.number}` : ''}`, 303);
  }

  if (event === 'fail' || event === 'cancel') {
    const order = fields.tran_id ? await abandonPayment(fields.tran_id, event === 'fail' ? 'FAILED' : 'CANCELLED') : null;
    return NextResponse.redirect(`${site}/checkout?payment=${event === 'fail' ? 'failed' : 'cancelled'}${order ? `&order=${order.number}` : ''}`, 303);
  }

  return new NextResponse('Not found', { status: 404 });
}

// SSLCOMMERZ always POSTs. A plain GET (e.g. someone reopening an old link) just goes back to the store.
export async function GET(req: Request) {
  return NextResponse.redirect(new URL('/cart', process.env.NEXT_PUBLIC_SITE_URL || req.url), 303);
}
