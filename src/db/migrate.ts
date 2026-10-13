import type { Pool } from 'mysql2/promise';

/**
 * Brings an existing database up to date the first time the app touches it, so a store set up from an
 * older install.sql keeps working after an upgrade without anyone importing SQL by hand.
 * Every step is additive and checked first (no data is changed or removed), and the same code runs on
 * MySQL 8 and MariaDB. A brand-new empty database is left alone: install.sql creates everything.
 */

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

const COLUMNS: [table: string, column: string, definition: string][] = [
  ['admins', 'role', "`role` varchar(20) NOT NULL DEFAULT 'OWNER'"],
  ['admins', 'is_active', '`is_active` boolean NOT NULL DEFAULT true'],
  ['admins', 'last_login_at', '`last_login_at` datetime NULL'],
  ['variants', 'cost', '`cost` int NOT NULL DEFAULT 0'],
  ['order_items', 'unit_cost', '`unit_cost` int NOT NULL DEFAULT 0'],
  ['orders', 'delivered_at', '`delivered_at` datetime NULL'],
  ['orders', 'paid_at', '`paid_at` datetime NULL'],
];

export const NEW_TABLES: Record<string, string> = {
  stock_movements: `CREATE TABLE IF NOT EXISTS \`stock_movements\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`variant_id\` int NOT NULL,
  \`product_id\` int NOT NULL,
  \`change\` int NOT NULL,
  \`balance_after\` int NOT NULL,
  \`reason\` varchar(20) NOT NULL,
  \`unit_cost\` int,
  \`order_id\` int,
  \`note\` varchar(255),
  \`admin_id\` int,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`stock_movements_id\` PRIMARY KEY(\`id\`),
  INDEX \`stock_movements_variant_idx\` (\`variant_id\`),
  INDEX \`stock_movements_created_idx\` (\`created_at\`)
) ${TABLE_OPTIONS}`,
  expenses: `CREATE TABLE IF NOT EXISTS \`expenses\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`spent_on\` date NOT NULL,
  \`category\` varchar(40) NOT NULL,
  \`description\` varchar(255) NOT NULL DEFAULT '',
  \`amount\` int NOT NULL,
  \`admin_id\` int,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`expenses_id\` PRIMARY KEY(\`id\`),
  INDEX \`expenses_spent_idx\` (\`spent_on\`)
) ${TABLE_OPTIONS}`,
  order_events: `CREATE TABLE IF NOT EXISTS \`order_events\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`order_id\` int NOT NULL,
  \`type\` varchar(20) NOT NULL,
  \`message\` varchar(255) NOT NULL,
  \`admin_id\` int,
  \`admin_name\` varchar(120),
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`order_events_id\` PRIMARY KEY(\`id\`),
  INDEX \`order_events_order_idx\` (\`order_id\`)
) ${TABLE_OPTIONS}`,
  activity_log: `CREATE TABLE IF NOT EXISTS \`activity_log\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`admin_id\` int,
  \`admin_name\` varchar(120) NOT NULL,
  \`action\` varchar(60) NOT NULL,
  \`entity\` varchar(30) NOT NULL,
  \`entity_id\` varchar(40),
  \`summary\` varchar(255) NOT NULL,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`activity_log_id\` PRIMARY KEY(\`id\`),
  INDEX \`activity_log_created_idx\` (\`created_at\`)
) ${TABLE_OPTIONS}`,
};

const DUPLICATE_COLUMN = 1060; // another server process added it a moment ago

export type MigrationStatus = { state: 'ok' | 'empty-database' | 'failed'; applied: string[]; error?: string };

export async function migrate(pool: Pool): Promise<MigrationStatus> {
  const [rows] = await pool.query('SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
  const existing = new Set((rows as { t: string; c: string }[]).map((r) => `${r.t}.${r.c}`.toLowerCase()));
  const tables = new Set([...existing].map((k) => k.split('.')[0]));
  if (!tables.has('admins')) return { state: 'empty-database', applied: [] };

  const applied: string[] = [];
  for (const [table, ddl] of Object.entries(NEW_TABLES)) {
    if (tables.has(table)) continue;
    await pool.query(ddl);
    applied.push(`table ${table}`);
  }
  for (const [table, column, definition] of COLUMNS) {
    if (!tables.has(table) || existing.has(`${table}.${column}`)) continue;
    try {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
      applied.push(`${table}.${column}`);
    } catch (e) {
      if ((e as { errno?: number }).errno !== DUPLICATE_COLUMN) throw e;
    }
  }
  if (applied.length) console.log(`[db] database updated: ${applied.join(', ')}`);
  return { state: 'ok', applied };
}
