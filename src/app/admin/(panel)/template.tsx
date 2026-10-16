'use client';

import { PageEnter } from '@/components/admin/motion/PageEnter';

/** Re-mounts on every admin navigation, so each page makes its entrance (see PageEnter). */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <PageEnter>{children}</PageEnter>;
}
