import type { Permission } from '@/lib/permissions';

export type NavItem = { href: string; label: string; icon: string; perm: Permission | null; badge?: 'toConfirm' | 'unread' | 'lowStock' };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { label: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: 'dashboard', perm: null }] },
  {
    label: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: 'orders', perm: 'orders.view', badge: 'toConfirm' },
      { href: '/admin/invoices', label: 'Invoices', icon: 'invoice', perm: 'invoices' },
      { href: '/admin/customers', label: 'Customers', icon: 'customers', perm: 'customers' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/admin/products', label: 'Products', icon: 'products', perm: 'products' },
      { href: '/admin/inventory', label: 'Inventory', icon: 'inventory', perm: 'inventory', badge: 'lowStock' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/admin/marketing', label: 'Campaigns & ROAS', icon: 'megaphone', perm: 'marketing' },
      { href: '/admin/marketing/coupons', label: 'Discount codes', icon: 'ticket', perm: 'marketing' },
      { href: '/admin/marketing/setup', label: 'Pixels & catalog', icon: 'target', perm: 'marketing' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/finance', label: 'Profit & loss', icon: 'pnl', perm: 'finance' },
      { href: '/admin/finance/expenses', label: 'Expenses', icon: 'expenses', perm: 'finance' },
      { href: '/admin/finance/transactions', label: 'Transactions', icon: 'transactions', perm: 'finance' },
    ],
  },
  {
    label: 'Store',
    items: [
      { href: '/admin/messages', label: 'Messages', icon: 'messages', perm: 'messages', badge: 'unread' },
      { href: '/admin/settings', label: 'Settings', icon: 'settings', perm: 'settings' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/admin/team', label: 'Team & roles', icon: 'team', perm: 'users' },
      { href: '/admin/activity', label: 'Activity log', icon: 'activity', perm: 'activity' },
    ],
  },
];

/** The nav item a path belongs to: the longest matching href wins (so /admin/finance/expenses isn't "Profit & loss"). */
export function activeHref(path: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => (h === '/admin' ? path === '/admin' : path === h || path.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
}
