import { z } from 'zod';

/** Bangladeshi mobile numbers: 01XXXXXXXXX, optionally prefixed with +88 / 88. */
export const bdPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(?:\+?88)?01[3-9]\d{8}$/.test(v), 'Enter a valid Bangladeshi mobile number, e.g. 01712345678')
  .transform((v) => v.replace(/^\+?88/, ''));

export const checkoutSchema = z.object({
  items: z
    .array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().min(1).max(20) }))
    .min(1, 'Your cart is empty')
    .max(50),
  customerName: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: bdPhone,
  email: z.string().trim().email('Enter a valid email').max(160).optional().or(z.literal('')),
  address: z.string().trim().min(8, 'Enter your full delivery address').max(500),
  city: z.string().trim().min(2, 'Enter your city or district').max(80),
  area: z.string().trim().max(80).optional().or(z.literal('')),
  zone: z.enum(['inside_dhaka', 'outside_dhaka']),
  paymentMethod: z.literal('COD').default('COD'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().email('Enter a valid email').max(160),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  orderNo: z.string().trim().max(20).optional().or(z.literal('')),
  body: z.string().trim().min(5, 'Write a short message').max(3000),
});

export const trackSchema = z.object({
  number: z.string().trim().toUpperCase().regex(/^NS-?\d{4,}$/, 'Order numbers look like NS-10001'),
  phone: bdPhone,
});

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
