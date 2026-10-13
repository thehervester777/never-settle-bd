import { AnimatedNumber, type NumberFormat } from './AnimatedNumber';
import { AdminIcon } from './AdminIcon';
import { Sparkline } from './charts';
import { Delta } from './ui';

export function StatTile({ label, value, format = 'int', delta, goodWhenUp = true, trend, icon, hint, tone }: {
  label: string; value: number; format?: NumberFormat; delta?: number | null; goodWhenUp?: boolean; trend?: number[]; icon?: string; hint?: React.ReactNode; tone?: 'accent';
}) {
  return (
    <div className={`admin-card relative overflow-hidden ${tone === 'accent' ? 'bg-ink text-white' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm ${tone === 'accent' ? 'text-white/60' : 'text-ink/55'}`}>{label}</p>
        {icon && <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone === 'accent' ? 'bg-accent text-ink' : 'bg-[#f4f4f1] text-ink/60'}`}><AdminIcon name={icon} className="h-4 w-4" /></span>}
      </div>
      <AnimatedNumber value={value} format={format} className="mt-2 block text-[1.85rem] font-semibold leading-tight tracking-tight" />
      <div className="mt-2 min-h-[1.25rem]">
        {delta !== undefined ? <Delta value={delta} goodWhenUp={goodWhenUp} /> : hint && <span className={`text-xs ${tone === 'accent' ? 'text-white/50' : 'text-ink/45'}`}>{hint}</span>}
      </div>
      {trend && trend.length > 1 && <div className="mt-3"><Sparkline values={trend} /></div>}
    </div>
  );
}
