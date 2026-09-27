'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export function ContactForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending'); setErrors({}); setError('');
    const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setState('sent'); return; }
    setState('idle');
    if (d.errors) setErrors(d.errors); else setError(d.error || 'Something went wrong. Please try again.');
  }

  if (state === 'sent') {
    return (
      <div className="grid place-items-start gap-3 bg-bone p-8 md:p-10" role="status">
        <p className="flex items-center gap-2 bg-accent px-4 py-3 text-sm font-semibold"><Icon name="check" className="h-4 w-4" /> Message sent</p>
        <p className="text-sm text-muted">Thanks for getting in touch. We&apos;ll reply within one working day.</p>
      </div>
    );
  }

  const f = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`c-${name}`} className="label">{label}{props.required && <span aria-hidden="true"> *</span>}</label>
      <input id={`c-${name}`} name={name} className={`field bg-paper ${errors[name] ? 'border-sale' : ''}`} aria-invalid={!!errors[name]} {...props} />
      {errors[name] && <p className="mt-1.5 text-xs text-sale">{errors[name]}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4 bg-bone p-6 md:p-10" noValidate>
      {error && <p className="bg-sale px-4 py-3 text-sm text-paper" role="alert">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {f('name', 'Name', { required: true, autoComplete: 'name' })}
        {f('phone', 'Phone number', { type: 'tel', autoComplete: 'tel' })}
      </div>
      {f('email', 'Email', { required: true, type: 'email', autoComplete: 'email' })}
      {f('orderNo', 'Order number', { placeholder: 'NS-10001' })}
      <div>
        <label htmlFor="c-body" className="label">Message <span aria-hidden="true">*</span></label>
        <textarea id="c-body" name="body" rows={6} required className={`field-area bg-paper ${errors.body ? 'border-sale' : ''}`} />
        {errors.body && <p className="mt-1.5 text-xs text-sale">{errors.body}</p>}
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <button className="btn btn-primary justify-self-start" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'} <Icon name="arrow-right" className="h-4 w-4" /></button>
    </form>
  );
}
