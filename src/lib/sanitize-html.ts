/*
 * Product descriptions are written in the admin and may contain simple HTML (<p>, <strong>, lists, links).
 * This keeps only those tags and rebuilds each one from scratch, so nothing else (scripts, event handlers,
 * styles, iframes, javascript: links) can reach a shopper's browser. Plain text without tags becomes paragraphs.
 */

const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a', 'hr', 'small', 'span']);
const VOID = new Set(['br', 'hr']);
/** Their content is dropped too, not shown as text. */
const DROP_CONTENT = /<(script|style|iframe|object|embed|noscript|template|textarea|svg|math|title|select)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Text between tags: escape it, but keep entities the writer typed (&amp; &nbsp; &#8211;). */
const escapeText = (s: string) => s.replace(/&(?!(?:[a-z][a-z0-9]{1,31}|#\d{1,7}|#x[0-9a-f]{1,6});)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function safeHref(raw: string): string | null {
  const v = raw.replace(/&amp;/g, '&').replace(/[\u0000- \u007f]/g, '');
  if (/^(https?:|mailto:|tel:)/i.test(v) || /^\/(?!\/)/.test(v) || /^#/.test(v)) return v;
  return null;
}

function attr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input).replace(/\r/g, '');
  if (!/<[a-z!/]/i.test(s)) {
    // Plain text: blank lines start a new paragraph, single line breaks stay.
    return s.trim().split(/\n{2,}/).map((p) => `<p>${escapeText(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  }
  s = s.replace(/<!--[\s\S]*?(-->|$)/g, '').replace(DROP_CONTENT, '');
  const out: string[] = [];
  const open: string[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    out.push(escapeText(s.slice(last, m.index)));
    last = re.lastIndex;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (!ALLOWED.has(tag)) continue;
    if (VOID.has(tag)) { if (!closing) out.push(`<${tag}>`); continue; }
    if (closing) {
      const at = open.lastIndexOf(tag);
      if (at < 0) continue;
      while (open.length > at) out.push(`</${open.pop()}>`);
      continue;
    }
    if (tag === 'a') {
      const href = safeHref(attr(m[3], 'href') ?? '');
      out.push(href ? `<a href="${escapeHtml(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}>` : '<a>');
    } else out.push(`<${tag}>`);
    open.push(tag);
  }
  out.push(escapeText(s.slice(last)));
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join('').trim();
}
