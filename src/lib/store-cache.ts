import 'server-only';
import { revalidatePath } from 'next/cache';

/*
 * Store-side read cache. Product listings, categories, settings and homepage slides are read on
 * nearly every visit but change only when someone edits them in the admin, so each server process
 * keeps the result for a short time (STORE_CACHE_SECONDS, default 30).
 *
 * - Concurrent visitors asking for the same thing share one database query (the promise is cached).
 * - Every admin change that the store can show calls refreshStore(): this process forgets everything
 *   at once and Next.js re-renders the cached store pages. Other server processes (if the host runs
 *   several) catch up within STORE_CACHE_SECONDS.
 * - Failed queries are never cached.
 */

type Entry = { version: number; at: number; value: Promise<unknown> };
const g = globalThis as unknown as { __nsStoreCache?: { version: number; entries: Map<string, Entry> } };
const state = (g.__nsStoreCache ??= { version: 0, entries: new Map() });

const MAX_ENTRIES = 5000;
const ttlMs = () => Math.max(0, Number(process.env.STORE_CACHE_SECONDS ?? 30)) * 1000;

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = state.entries.get(key);
  if (hit && hit.version === state.version && now - hit.at < ttlMs()) return hit.value as Promise<T>;
  const value = load();
  state.entries.set(key, { version: state.version, at: now, value });
  value.catch(() => { if (state.entries.get(key)?.value === value) state.entries.delete(key); });
  if (state.entries.size > MAX_ENTRIES) {
    // Oldest first (Map keeps insertion order)
    let drop = Math.ceil(MAX_ENTRIES / 5);
    for (const k of state.entries.keys()) { if (drop-- <= 0) break; state.entries.delete(k); }
  }
  return value;
}

/** Call after any admin change the store shows (products, stock, prices, settings, slides). */
export function refreshStore() {
  state.version++;
  state.entries.clear();
  try {
    revalidatePath('/', 'layout');
  } catch {
    // Outside a request (scripts, tests): the data cache is cleared, which is all that's needed there.
  }
}

/** For tests and the health check. */
export const storeCacheStats = () => ({ version: state.version, entries: state.entries.size, ttlSeconds: ttlMs() / 1000 });
