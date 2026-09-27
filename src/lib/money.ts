/** Prices are stored as integers in poisha (1 taka = 100 poisha) to avoid rounding errors. */
export function formatBDT(poisha: number): string {
  const taka = Math.round(poisha / 100);
  return `৳${taka.toLocaleString('en-US')}`;
}

export const toPoisha = (taka: number | string) => Math.round(Number(taka) * 100);
export const toTaka = (poisha: number) => (poisha / 100).toFixed(2);
