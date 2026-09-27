import 'server-only';
import nodemailer from 'nodemailer';
import { formatBDT } from './money';

/** Order emails are optional: nothing is sent unless SMTP_HOST is configured. */
function transport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

type MailOrder = {
  number: string; customerName: string; email: string | null; phone: string; total: number;
  paymentMethod: string; items: { title: string; options: string; quantity: number; unitPrice: number }[];
};

export async function sendOrderEmails(o: MailOrder) {
  const t = transport();
  if (!t) return;
  const store = process.env.NEXT_PUBLIC_STORE_NAME || 'NEVER SETTLE';
  const lines = o.items.map((i) => `${i.quantity} × ${i.title}${i.options ? ` (${i.options})` : ''} — ${formatBDT(i.unitPrice * i.quantity)}`).join('\n');
  const text = `Order ${o.number}\n\n${lines}\n\nTotal: ${formatBDT(o.total)}\nPayment: ${o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online (SSLCOMMERZ)'}\nPhone: ${o.phone}`;
  const from = process.env.MAIL_FROM || `${store} <no-reply@localhost>`;
  try {
    if (o.email) {
      await t.sendMail({ from, to: o.email, subject: `${store}: we received order ${o.number}`, text: `Hi ${o.customerName},\n\nThanks for your order. We'll call you to confirm before dispatch.\n\n${text}` });
    }
    if (process.env.ORDER_NOTIFY_EMAIL) {
      await t.sendMail({ from, to: process.env.ORDER_NOTIFY_EMAIL, subject: `New order ${o.number} — ${formatBDT(o.total)}`, text: `${o.customerName}\n${text}` });
    }
  } catch (e) {
    console.error('Order email failed', e);
  }
}
