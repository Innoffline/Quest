import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LabelCount } from '../lib/aggregate'
import { cx } from '../lib/cx'

/**
 * Minimal single-series charts. One hue (the accent) carries the data; text stays in ink tokens.
 * Every chart has a text equivalent nearby (numbers or a list), so color is never the only cue.
 */

const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const

function TooltipBox({ active, label, value, unit }: { active?: boolean; label?: string; value?: number; unit: string }) {
  if (!active || value == null) return null
  return (
    <div className="border-2 border-ink bg-bg px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="tabular-nums text-muted">
        {value} {unit}
      </p>
    </div>
  )
}

export interface DayBar {
  label: string
  value: number
  highlight?: boolean
}

export function DayBars({ data, max, reference, unit, ariaLabel }: { data: DayBar[]; max?: number; reference?: number; unit: string; ariaLabel: string }) {
  return (
    <figure aria-label={ariaLabel} className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} allowDecimals={false} domain={[0, max ?? 'auto']} ticks={max != null ? Array.from({ length: max + 1 }, (_, i) => i) : undefined} width={48} />
          {reference != null && (
            <ReferenceLine
              y={reference}
              stroke="var(--ink)"
              strokeDasharray="4 3"
              label={{ value: 'clear', position: 'insideTopRight', fill: 'var(--muted)', fontSize: 11 }}
            />
          )}
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload, label }) => (
              <TooltipBox active={active} label={String(label ?? '')} value={payload?.[0]?.value as number | undefined} unit={unit} />
            )}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.highlight === false ? 'var(--muted)' : 'var(--accent)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  )
}

/** Ranked list with inline bars — direct labels, no legend needed. */
export function RankBars({ items, unit = '×', format }: { items: LabelCount[]; unit?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{i.label}</span>
          <span className="h-2.5 bg-surface-2" aria-hidden>
            <span className="block h-full rounded-r bg-accent" style={{ width: `${(i.count / max) * 100}%` }} />
          </span>
          <span className={cx('text-right font-semibold tabular-nums')}>{format ? format(i.count) : `${unit}${i.count}`}</span>
        </li>
      ))}
    </ul>
  )
}
