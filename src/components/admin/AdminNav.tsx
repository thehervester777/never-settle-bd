'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/admin', 'Dashboard'],
  ['/admin/orders', 'Orders'],
  ['/admin/products', 'Products'],
  ['/admin/messages', 'Messages'],
  ['/admin/settings', 'Settings'],
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:px-3">
      {LINKS.map(([href, label]) => {
        const active = href === '/admin' ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`block whitespace-nowrap px-3 py-2 text-sm ${active ? 'bg-accent text-ink' : 'text-paper/80 hover:bg-paper/10'}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
