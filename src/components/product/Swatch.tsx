const COLORS: Record<string, string> = {
  black: '#141414', white: '#FFFFFF', 'off-white': '#EFE9DC', ivory: '#EFE9DC', cream: '#EFE9DC',
  navy: '#1F2A48', blue: '#2E5AAC', olive: '#5C6246', sage: '#96A88C', green: '#2F6B3F',
  maroon: '#74202A', red: '#B3261E', khaki: '#C4B08C', beige: '#C4B08C', sand: '#C4B08C',
  brown: '#6E4526', tan: '#AA7646', grey: '#6B6B6B', gray: '#6B6B6B', charcoal: '#3A3A3A',
  yellow: '#D4A51C', mustard: '#C99A1E', pink: '#E3A7B5', purple: '#5B3A7A',
};

export const colorHex = (name: string) => COLORS[name.trim().toLowerCase()] ?? name.trim().toLowerCase().replace(/\s/g, '');

export function Swatch({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full border border-ink/15 ${className}`} style={{ background: colorHex(name) }} aria-hidden="true" />;
}
