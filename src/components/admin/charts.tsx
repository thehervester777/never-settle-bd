'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber, type NumberFormat } from './AnimatedNumber';
import { SERIES } from './palette';

const GRID = '#ebeae5';
const AXIS = '#c9c8c0';
const MUTED = '#8a8882';
const EASE = [0.16, 1, 0.3, 1] as const;

/** Compact axis labels: ৳12K, ৳1.2M. Values are poisha for money. */
function compact(v: number, format: NumberFormat) {
  const n = format === 'bdt' ? v / 100 : v;
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${+(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K` : `${Math.round(a)}`;
  return `${sign}${format === 'bdt' ? '৳' : ''}${s}`;
}

/** A round number at or above v, for clean gridlines. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------------------------------------------------------------- Chart / table toggle */

export function ChartFrame({ chart, table, caption }: { chart: React.ReactNode; table: { headers: string[]; rows: (string | number)[][] }; caption?: string }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="seg">
          <button type="button" aria-current={view === 'chart' ? 'true' : undefined} onClick={() => setView('chart')}>Chart</button>
          <button type="button" aria-current={view === 'table' ? 'true' : undefined} onClick={() => setView('table')}>Table</button>
        </div>
      </div>
      {view === 'chart' ? chart : (
        <div className="max-h-[320px] overflow-auto rounded-xl border border-black/[0.06]">
          <table className="admin-table min-w-0">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="sticky top-0"><tr>{table.headers.map((h, i) => <th key={h} className={i ? 'text-right' : ''}>{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'text-right tabular' : ''}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; kind: 'line' | 'rect' }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.kind === 'line'
            ? <span className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: i.color }} />
            : <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ x, width, title, rows }: { x: number; width: number; title: string; rows: { label: string; value: string; color?: string; kind?: 'line' | 'rect' }[] }) {
  const left = Math.min(Math.max(x, 90), width - 90);
  return (
    <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-black/[0.06] bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur" style={{ left }}>
      <p className="mb-1 font-medium text-ink/55">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 whitespace-nowrap">
          {r.color && (r.kind === 'rect' ? <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} /> : <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} />)}
          <span className="font-semibold tabular text-ink">{r.value}</span>
          <span className="text-ink/50">{r.label}</span>
        </p>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Trend (line/area) */

type TrendSeries = { key: string; label: string; color: string; values: number[] };

export function TrendChart({ labels, series, format = 'bdt', height = 260, extra }: {
  labels: string[]; series: TrendSeries[]; format?: NumberFormat; height?: number;
  extra?: { label: string; values: (string | number)[] };
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const gid = useId().replace(/:/g, '');
  const pad = { l: 52, r: 12, t: 12, b: 28 };
  const w = Math.max(width, 200), ih = height - pad.t - pad.b, iw = w - pad.l - pad.r;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (Math.max(v, 0) / max) * ih;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 72))));

  const pick = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - pad.l;
    setHover(Math.min(n - 1, Math.max(0, Math.round((rel / iw) * (n - 1)))));
  };

  return (
    <div>
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, color: s.color, kind: 'line' }))} />}
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg
            width={w} height={height} role="img" tabIndex={0}
            aria-label={`${series.map((s) => s.label).join(' and ')} over time`}
            className="overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
              if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
            }}
            onBlur={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`fill-${gid}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={series[0]?.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={series[0]?.color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular">{compact(t, format)}</text>
              </g>
            ))}
            {labels.map((l, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every / 2) && (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={11} fill={MUTED}>{l}</text>
            ))}
            {series[0] && n > 1 && (
              <motion.path
                d={`${path(series[0].values)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#fill-${gid})`}
                initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }}
              />
            )}
            {series.map((s, si) => (
              <motion.path
                key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: EASE, delay: si * 0.12 }}
              />
            ))}
            {hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={AXIS} strokeWidth={1} />
                {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />)}
              </g>
            )}
          </svg>
        )}
        {hover !== null && (
          <Tooltip
            x={x(hover)} width={w} title={labels[hover]}
            rows={[
              ...series.map((s) => ({ label: s.label, value: formatNumber(s.values[hover], format), color: s.color })),
              ...(extra ? [{ label: extra.label, value: String(extra.values[hover]) }] : []),
            ]}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Grouped columns */

export function ColumnChart({ labels, series, format = 'bdt', height = 280 }: { labels: string[]; series: TrendSeries[]; format?: NumberFormat; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const pad = { l: 52, r: 8, t: 12, b: 28 };
  const w = Math.max(width, 200), ih = height - pad.t - pad.b, iw = w - pad.l - pad.r;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = labels.length, band = iw / Math.max(n, 1);
  const barW = Math.min(24, Math.max(4, (band * 0.7 - 2 * (series.length - 1)) / series.length));
  const groupW = barW * series.length + 2 * (series.length - 1);
  const y = (v: number) => pad.t + ih - (Math.max(v, 0) / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 56))));

  return (
    <div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color, kind: 'rect' }))} />
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={w} height={height} role="img" aria-label={`${series.map((s) => s.label).join(' and ')} by period`} onPointerLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular">{compact(t, format)}</text>
              </g>
            ))}
            {labels.map((l, i) => {
              const gx = pad.l + i * band + (band - groupW) / 2;
              return (
                <g key={i} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} className="outline-none">
                  <rect x={pad.l + i * band} y={pad.t} width={band} height={ih} fill={hover === i ? 'rgba(0,0,0,0.035)' : 'transparent'} rx={6} />
                  {series.map((s, si) => {
                    const v = s.values[i], h = Math.max(0, pad.t + ih - y(v)), bx = gx + si * (barW + 2);
                    const r = Math.min(4, h, barW / 2);
                    const d = h <= 0 ? '' : `M${bx},${pad.t + ih}V${pad.t + ih - h + r}Q${bx},${pad.t + ih - h} ${bx + r},${pad.t + ih - h}H${bx + barW - r}Q${bx + barW},${pad.t + ih - h} ${bx + barW},${pad.t + ih - h + r}V${pad.t + ih}Z`;
                    return d && (
                      <motion.path
                        key={s.key} d={d} fill={s.color} style={{ originY: 1 }}
                        initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.7, ease: EASE, delay: i * 0.03 }}
                      />
                    );
                  })}
                  {(i % every === 0) && <text x={pad.l + i * band + band / 2} y={height - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{l}</text>}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && (
          <Tooltip x={pad.l + hover * band + band / 2} width={w} title={labels[hover]} rows={series.map((s) => ({ label: s.label, value: formatNumber(s.values[hover], format), color: s.color, kind: 'rect' }))} />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Profit/loss columns (diverging around zero) */

export function DivergingColumns({ labels, values, height = 220, label = 'Net profit' }: { labels: string[]; values: number[]; height?: number; label?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const pad = { l: 52, r: 8, t: 12, b: 28 };
  const w = Math.max(width, 200), ih = height - pad.t - pad.b, iw = w - pad.l - pad.r;
  const top = niceMax(Math.max(0, ...values)), bottom = niceMax(Math.max(0, ...values.map((v) => -v)));
  const span = (values.some((v) => v > 0) ? top : 0) + (values.some((v) => v < 0) ? bottom : 0) || 1;
  const zero = pad.t + ((values.some((v) => v > 0) ? top : 0) / span) * ih;
  const scale = ih / span;
  const n = labels.length, band = iw / Math.max(n, 1), barW = Math.min(24, band * 0.6);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 56))));
  const ticks = [values.some((v) => v > 0) ? top : null, 0, values.some((v) => v < 0) ? -bottom : null].filter((t): t is number => t !== null);

  return (
    <div>
      <Legend items={[{ label: 'Profit', color: SERIES.blue, kind: 'rect' }, { label: 'Loss', color: SERIES.red, kind: 'rect' }]} />
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={w} height={height} role="img" aria-label={`${label} by period`} onPointerLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={zero - t * scale} y2={zero - t * scale} stroke={t === 0 ? AXIS : GRID} />
                <text x={pad.l - 8} y={zero - t * scale} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular">{compact(t, 'bdt')}</text>
              </g>
            ))}
            {values.map((v, i) => {
              const h = Math.abs(v) * scale, bx = pad.l + i * band + (band - barW) / 2, r = Math.min(4, h, barW / 2);
              const d = h <= 0 ? '' : v > 0
                ? `M${bx},${zero}V${zero - h + r}Q${bx},${zero - h} ${bx + r},${zero - h}H${bx + barW - r}Q${bx + barW},${zero - h} ${bx + barW},${zero - h + r}V${zero}Z`
                : `M${bx},${zero}V${zero + h - r}Q${bx},${zero + h} ${bx + r},${zero + h}H${bx + barW - r}Q${bx + barW},${zero + h} ${bx + barW},${zero + h - r}V${zero}Z`;
              return (
                <g key={i} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} className="outline-none">
                  <rect x={pad.l + i * band} y={pad.t} width={band} height={ih} fill={hover === i ? 'rgba(0,0,0,0.035)' : 'transparent'} rx={6} />
                  {d && (
                    <motion.path d={d} fill={v >= 0 ? SERIES.blue : SERIES.red} style={{ originY: v >= 0 ? 1 : 0 }}
                      initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.7, ease: EASE, delay: i * 0.03 }} />
                  )}
                  {(i % every === 0) && <text x={pad.l + i * band + band / 2} y={height - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{labels[i]}</text>}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && <Tooltip x={pad.l + hover * band + band / 2} width={w} title={labels[hover]} rows={[{ label, value: formatNumber(values[hover], 'bdt'), color: values[hover] >= 0 ? SERIES.blue : SERIES.red, kind: 'rect' }]} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Horizontal bar list */

export function BarList({ rows, format = 'bdt', color = SERIES.blue, empty = 'No data for this period.' }: {
  rows: { label: string; value: number; sub?: string; href?: string }[]; format?: NumberFormat; color?: string; empty?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-8 text-center text-sm text-ink/45">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const label = r.href ? <Link href={r.href} className="hover:underline">{r.label}</Link> : r.label;
        return (
          <li key={r.label + i}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{label}{r.sub && <span className="ml-2 text-xs text-ink/45">{r.sub}</span>}</span>
              <span className="shrink-0 font-medium tabular">{formatNumber(r.value, format)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.04]">
              <motion.div
                className="h-full rounded-full" style={{ background: color }}
                initial={reduce ? false : { width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.05 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- Sparkline (stat tiles) */

export function Sparkline({ values, height = 36 }: { values: number[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  if (values.length < 2) return <div style={{ height }} />;
  const w = Math.max(width, 60), max = Math.max(...values, 1), min = Math.min(...values, 0);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (w - 6);
  const y = (v: number) => 3 + (1 - (v - min) / (max - min || 1)) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {width > 0 && (
        <svg width={w} height={height} className="overflow-visible">
          <motion.path d={d} fill="none" stroke="#b9b8b0" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: EASE }} />
          <circle cx={x(last)} cy={y(values[last])} r={3.5} fill={SERIES.blue} stroke="#fff" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}
