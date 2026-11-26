'use client';

import { usePathname } from 'next/navigation';
import { PageEnter } from '@/components/admin/motion/PageEnter';

/**
 * Each admin page makes its entrance (see PageEnter). A template alone only re-mounts when the top-level
 * section changes, so moving within one (Products → a product, Orders → an order) would reuse the page that
 * just faded out; keying on the path gives every page a fresh one. Filters (?query) don't re-mount.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <PageEnter key={usePathname()}>{children}</PageEnter>;
}
