/** Values shared by server and client code (no database imports here). */
export const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
] as const;

export const FILTER_KEYS = ['sort', 'size', 'color', 'min', 'max'] as const;

/**
 * The address of a filtered collection: /collections/all/f/sort=price-asc&size=M. Filters live in the
 * path (not after "?") so every combination can be cached like any other store page. Keys and values
 * always come out in the same order, so the same choice always lands on the same cached page.
 */
export function collectionPath(base: string, f: { sort?: string; sizes?: string[]; colors?: string[]; min?: string; max?: string }) {
  const q = new URLSearchParams();
  if (f.sort && f.sort !== 'featured') q.set('sort', f.sort);
  [...(f.sizes ?? [])].sort().forEach((s) => q.append('size', s));
  [...(f.colors ?? [])].sort().forEach((c) => q.append('color', c));
  const num = (v?: string) => (v && Number(v) > 0 ? String(Math.round(Number(v))) : '');
  if (num(f.min)) q.set('min', num(f.min));
  if (num(f.max)) q.set('max', num(f.max));
  const s = q.toString();
  return s ? `${base}/f/${s}` : base;
}
