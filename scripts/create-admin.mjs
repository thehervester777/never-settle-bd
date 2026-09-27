#!/usr/bin/env node
/**
 * Creates (or resets the password of) an admin account.
 *   npm run admin:create -- you@example.com "Your Name"
 * You'll be asked for the password, so it never appears in your shell history.
 */
import readline from 'readline';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { loadEnv } from './load-env.mjs';

loadEnv();
const [email, ...nameParts] = process.argv.slice(2);
if (!email || !email.includes('@')) {
  console.error('Usage: npm run admin:create -- you@example.com "Your Name"');
  process.exit(1);
}
const name = nameParts.join(' ') || 'Admin';

function ask(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.stdoutMuted = true;
    rl._writeToOutput = function (s) { if (!this.stdoutMuted || s.includes(q)) this.output.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

const password = process.env.ADMIN_PASSWORD || (await ask('Password (min 10 characters): '));
if (!password || password.length < 10) { console.error('Password must be at least 10 characters.'); process.exit(1); }

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const hash = await bcrypt.hash(password, 12);
await conn.execute(
  'INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)',
  [email.toLowerCase().trim(), name, hash],
);
await conn.end();
console.log(`Admin ready: ${email} — sign in at /admin/login`);
