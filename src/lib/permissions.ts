import type { AdminRole } from '@/db/schema';

/** What each part of the admin panel needs. Checked on the server for every page and action. */
export type Permission =
  | 'orders.view' | 'orders.manage' | 'invoices' | 'customers'
  | 'products' | 'inventory' | 'costs'
  | 'sales' | 'finance'
  | 'messages' | 'settings' | 'users' | 'activity';

const ALL: Permission[] = ['orders.view', 'orders.manage', 'invoices', 'customers', 'products', 'inventory', 'costs', 'sales', 'finance', 'messages', 'settings', 'users', 'activity'];

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  OWNER: ALL,
  MANAGER: ['orders.view', 'orders.manage', 'invoices', 'customers', 'products', 'inventory', 'costs', 'sales', 'messages', 'settings', 'activity'],
  ACCOUNTANT: ['orders.view', 'invoices', 'customers', 'costs', 'sales', 'finance'],
  STAFF: ['orders.view', 'orders.manage', 'invoices', 'customers', 'inventory', 'messages'],
};

export const ROLE_INFO: Record<AdminRole, { label: string; summary: string }> = {
  OWNER: { label: 'Owner', summary: 'Everything, including team members, profit and settings.' },
  MANAGER: { label: 'Manager', summary: 'Runs the store: orders, products, inventory, customers and settings. No profit reports or team.' },
  ACCOUNTANT: { label: 'Accountant', summary: 'Profit & loss, expenses, transactions, invoices and sales figures. Read-only orders.' },
  STAFF: { label: 'Staff', summary: 'Day-to-day: confirm and ship orders, print invoices, restock, answer messages. No money figures.' },
};

export const can = (role: AdminRole | undefined | null, permission: Permission) => !!role && (ROLE_PERMISSIONS[role] ?? []).includes(permission);
