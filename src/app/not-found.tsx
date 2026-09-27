import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center py-24 text-center">
      <p className="font-display text-[clamp(8rem,30vw,22rem)] uppercase leading-[0.8]">404</p>
      <h1 className="mt-6 font-display text-display-sm uppercase">Page not found</h1>
      <p className="mt-3 max-w-md text-muted">This page took a different route. Let&apos;s get you back on track.</p>
      <Link href="/collections/all" className="btn btn-primary mt-8">Continue shopping</Link>
    </main>
  );
}
