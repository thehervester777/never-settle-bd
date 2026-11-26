'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { beginTwoStep, confirmTwoStep, disableTwoStep, renewRecoveryCodes } from '@/app/admin/(panel)/account/two-step';
import { toast } from './toast';

type Setup = { qr: string; key: string };

function Codes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join('\n');
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Save these recovery codes somewhere safe (a password manager, or printed). Each works once if you lose your phone. They won’t be shown again.</p>
      <ul className="grid grid-cols-2 gap-2 rounded-xl bg-[#f7f7f4] p-4 font-mono text-sm sm:grid-cols-5" data-recovery-codes>
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="abtn abtn-outline abtn-sm" onClick={() => navigator.clipboard.writeText(text).then(() => toast('Copied'), () => toast('Copy them by hand', 'warn'))}>Copy</button>
        <a className="abtn abtn-outline abtn-sm" download="never-settle-recovery-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(`NEVER SETTLE admin recovery codes\n\n${text}\n`)}`}>Download</a>
        <button type="button" className="abtn abtn-primary abtn-sm" onClick={onDone}>I’ve saved them</button>
      </div>
    </div>
  );
}

export function TwoStepCard({ enabled, codesLeft }: { enabled: boolean; codesLeft: number }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'off' | 'renew' | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  const reset = () => { setSetup(null); setMode(null); setCode(''); setPassword(''); setError(''); };

  if (codes) return <Codes codes={codes} onDone={() => { setCodes(null); reset(); router.refresh(); }} />;

  if (setup) {
    return (
      <form className="grid gap-5 sm:grid-cols-[180px_1fr]" onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await confirmTwoStep(code);
        if (!r.ok) { setError(r.message); return; }
        toast(r.message);
        if ('codes' in r) setCodes(r.codes);
      }); }}>
        <div className="aspect-square w-full rounded-xl bg-white p-2 ring-1 ring-black/10 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: setup.qr }} aria-label="QR code to scan" />
        <div className="space-y-3 text-sm">
          <ol className="list-decimal space-y-1 pl-4 text-ink/70">
            <li>Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
            <li>Scan this QR code. Can’t scan? Type this key: <code className="select-all rounded bg-[#f7f7f4] px-1.5 py-0.5 font-mono text-ink" data-totp-key>{setup.key}</code></li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <div className="flex gap-2">
            <input aria-label="6-digit code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="ainput w-36 text-center font-mono tracking-[0.25em]" placeholder="123456" id="totp-confirm" />
            <button className="abtn abtn-primary" disabled={pending}>{pending ? 'Checking…' : 'Turn on'}</button>
            <button type="button" className="abtn abtn-ghost" onClick={reset}>Cancel</button>
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>
      </form>
    );
  }

  if (mode) {
    return (
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = mode === 'off' ? await disableTwoStep(password, code) : await renewRecoveryCodes(password, code);
        if (!r.ok) { setError(r.message); return; }
        toast(r.message);
        if ('codes' in r) setCodes(r.codes as string[]); else { reset(); router.refresh(); }
      }); }}>
        <p className="text-sm text-ink/70">{mode === 'off' ? 'To turn off two-step sign-in, enter your password and a code from the app.' : 'To make new recovery codes, enter your password and a code from the app. The old codes stop working.'}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <div><label className="alabel" htmlFor="tf-pw">Password</label><input id="tf-pw" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="ainput" /></div>
          <div><label className="alabel" htmlFor="tf-code">Code</label><input id="tf-code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="ainput text-center font-mono tracking-[0.2em]" /></div>
          <div className="flex gap-2">
            <button className={`abtn ${mode === 'off' ? 'bg-red-600 text-white hover:bg-red-700' : 'abtn-primary'}`} disabled={pending}>{mode === 'off' ? 'Turn off' : 'Make new codes'}</button>
            <button type="button" className="abtn abtn-ghost" onClick={reset}>Cancel</button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>
    );
  }

  return enabled ? (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">● On</span>
      <span className={`text-sm ${codesLeft <= 2 ? 'text-amber-700' : 'text-ink/55'}`}>{codesLeft} recovery code{codesLeft === 1 ? '' : 's'} left</span>
      <div className="ml-auto flex gap-2">
        <button type="button" className="abtn abtn-outline abtn-sm" onClick={() => setMode('renew')}>New recovery codes</button>
        <button type="button" className="abtn abtn-ghost abtn-sm text-red-600" onClick={() => setMode('off')}>Turn off</button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-ink/60">Off. Anyone with your password can sign in.</p>
      <button type="button" className="abtn abtn-primary ml-auto" disabled={pending} onClick={() => start(async () => {
        const r = await beginTwoStep();
        if (!r.ok) { toast((r as { message: string }).message, 'warn'); return; }
        if ('qr' in r) { setError(''); setCode(''); setSetup({ qr: r.qr, key: r.key }); }
      })}>Turn on two-step sign-in</button>
    </div>
  );
}
