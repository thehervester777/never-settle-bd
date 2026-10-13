import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ADMIN_ROLES } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { can, ROLE_INFO, type Permission } from '@/lib/permissions';
import { fmtDate, timeAgo } from '@/lib/dates';
import { Card, PageHeader } from '@/components/admin/ui';
import { TeamManager } from '@/components/admin/TeamManager';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata = { title: 'Team & roles' };

const AREAS: [Permission, string][] = [
  ['orders.view', 'See orders'], ['orders.manage', 'Confirm, ship, cancel orders & record cash'], ['invoices', 'Print invoices & packing slips'],
  ['customers', 'Customers'], ['products', 'Add & edit products'], ['inventory', 'Inventory & restocking'], ['costs', 'See purchase costs & margins'],
  ['sales', 'See sales figures'], ['finance', 'Profit & loss, expenses, transactions'], ['messages', 'Customer messages'],
  ['settings', 'Store settings'], ['activity', 'Activity log'], ['users', 'Manage team & roles'],
];

export default async function TeamPage() {
  const me = await requirePermission('users');
  const admins = await db.select().from(schema.admins).orderBy(asc(schema.admins.createdAt));
  const order = (r: string) => ADMIN_ROLES.indexOf(r as never);

  return (
    <div className="space-y-6">
      <PageHeader title="Team & roles" description="Who can sign in to the admin panel, and what each person can see and do" />
      <TeamManager
        roles={ROLE_INFO}
        members={admins.sort((a, b) => order(a.role) - order(b.role) || a.id - b.id).map((a) => ({
          id: a.id, name: a.name, email: a.email, role: a.role, isActive: a.isActive, isMe: a.id === me.id,
          lastLogin: a.lastLoginAt ? timeAgo(a.lastLoginAt) : 'Never', joined: fmtDate(a.createdAt),
        }))}
      />
      <Card title="What each role can do" padded={false}>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Area</th>{ADMIN_ROLES.map((r) => <th key={r} className="text-center">{ROLE_INFO[r].label}</th>)}</tr></thead>
            <tbody>
              {AREAS.map(([perm, label]) => (
                <tr key={perm}>
                  <td>{label}</td>
                  {ADMIN_ROLES.map((r) => (
                    <td key={r} className="text-center">
                      {can(r, perm)
                        ? <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-emerald-50 text-emerald-700"><AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} /></span>
                        : <span className="text-ink/20">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
