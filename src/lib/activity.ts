import 'server-only';
import { db, schema } from '@/db';
import type { AdminSession } from '@/lib/auth';

/** Records who did what. Never blocks or fails the action it describes. */
export async function logActivity(admin: AdminSession | null, action: string, entity: string, entityId: string | number | null, summary: string) {
  try {
    await db.insert(schema.activityLog).values({
      adminId: admin?.id ?? null,
      adminName: admin?.name ?? 'System',
      action: action.slice(0, 60),
      entity: entity.slice(0, 30),
      entityId: entityId === null ? null : String(entityId).slice(0, 40),
      summary: summary.slice(0, 255),
    });
  } catch (e) {
    console.error('Could not write activity log', e);
  }
}
