import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { mockGatewayEnabled } from '@/lib/payments';
import { formatBDT } from '@/lib/money';

/**
 * Stand-in payment page for local testing only (SSLCZ_SANDBOX=true and SSLCZ_MOCK=true).
 * It posts to the same callback URLs SSLCOMMERZ uses, so the whole order flow can be tested offline.
 */
export default async function MockGateway({ searchParams }: { searchParams: Promise<{ tran_id?: string; amount?: string }> }) {
  if (!mockGatewayEnabled()) notFound();
  const { tran_id = '', amount = '0' } = await searchParams;
  const valId = `MOCK-${tran_id}`;
  return (
    <main className="grid min-h-screen place-items-center bg-[#0f5132] p-6 font-body text-white">
      <div className="w-full max-w-md bg-white p-8 text-ink shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sale">Test mode · no real money</p>
        <h1 className="mt-2 text-2xl font-bold">Payment gateway (stand-in)</h1>
        <p className="mt-2 text-sm text-muted">Transaction {tran_id}</p>
        <p className="mt-6 text-4xl font-bold">{formatBDT(Number(amount))}</p>
        <div className="mt-8 grid gap-3">
          <form method="post" action="/api/payments/sslcommerz/success">
            <input type="hidden" name="tran_id" value={tran_id} />
            <input type="hidden" name="val_id" value={valId} />
            <input type="hidden" name="status" value="VALID" />
            <button className="btn btn-primary w-full" data-testid="mock-pay">Pay {formatBDT(Number(amount))}</button>
          </form>
          <form method="post" action="/api/payments/sslcommerz/fail">
            <input type="hidden" name="tran_id" value={tran_id} />
            <input type="hidden" name="status" value="FAILED" />
            <button className="btn btn-outline w-full" data-testid="mock-fail">Simulate failed payment</button>
          </form>
          <form method="post" action="/api/payments/sslcommerz/cancel">
            <input type="hidden" name="tran_id" value={tran_id} />
            <input type="hidden" name="status" value="CANCELLED" />
            <button className="w-full py-3 text-sm underline" data-testid="mock-cancel">Cancel and return to store</button>
          </form>
        </div>
      </div>
    </main>
  );
}
