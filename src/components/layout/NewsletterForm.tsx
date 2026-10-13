'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export function NewsletterForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    setState('sending');
    const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setState('done');
    else { setState('error'); setMsg(data.error || 'Something went wrong. Please try again.'); }
  }

  if (state === 'done') return <p className="flex items-center gap-2 text-sm font-semibold" role="status"><Icon name="check" className="h-4 w-4" /> You&apos;re in. Welcome to the crew.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row" noValidate>
      <label htmlFor="newsletter-email" className="sr-only">Email address</label>
      <input id="newsletter-email" name="email" type="email" required autoComplete="email" placeholder="Email address" className="field flex-1 border-ink placeholder:text-ink/50" />
      <button className="btn btn-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Subscribing…' : 'Subscribe'} <Icon name="arrow-right" className="h-4 w-4" /></button>
      {state === 'error' && <p className="text-sm text-sale sm:basis-full" role="alert">{msg}</p>}
    </form>
  );
}
