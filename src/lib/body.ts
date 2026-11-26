/** Thrown when a request body is larger than the route accepts. */
export class BodyTooLarge extends Error {}

/**
 * Reads a JSON request body, refusing anything over `maxBytes` before it is buffered in memory.
 * Returns {} for an empty or malformed body (the route's validation then reports what's missing).
 */
export async function readJson(req: Request, maxBytes = 32 * 1024): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new BodyTooLarge();
  if (!req.body) return {};
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel().catch(() => {}); throw new BodyTooLarge(); }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}
