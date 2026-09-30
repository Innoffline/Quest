import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CategoryRow } from '../components/CategoryRow'
import { ErrorNote, Loading, Sheet } from '../components/ui'
import { cx } from '../lib/cx'
import { useToday } from '../hooks/useClock'
import { useDay } from '../hooks/useDay'
import { useQuery } from '../hooks/useQuery'
import { summarizeDay } from '../lib/aggregate'
import { formatMinutes, formatRange, monthDay, monthGrid, parseISODate, toISODate, weekdayLong } from '../lib/dates'
import { TIER_LABEL, type Tier } from '../lib/scoring'
import { useApp } from '../state/AppContext'
import type { ISODate } from '../types'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Cell style per tier. Each tier also has a text/shape cue, not color alone. */
const CELL: Record<Tier, string> = {
  perfect: 'bg-accent text-accent-ink',
  strong: 'bg-ink text-bg',
  cleared: 'bg-surface border-2 border-ink text-ink',
  partial: 'bg-surface-2 text-ink',
  empty: 'bg-surface text-muted',
}

export function HistoryScreen() {
  const today = useToday()
  const { repo, categories, settings } = useApp()
  const [cursor, setCursor] = useState(() => {
    const d = parseISODate(today)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [selected, setSelected] = useState<ISODate | null>(null)

  const cells = useMemo(() => monthGrid(cursor.y, cursor.m, settings.week_start), [cursor, settings.week_start])
  const from = toISODate(new Date(cursor.y, cursor.m, 1))
  const to = toISODate(new Date(cursor.y, cursor.m + 1, 0))
  const q = useQuery(async () => {
    const [completions, blocks, xpEvents] = await Promise.all([repo.listCompletions(from, to), repo.listBlocks(from, to), repo.listXpEvents(from, to)])
    return { completions, blocks, xpEvents }
  }, [from, to])

  const summaries = useMemo(() => {
    const m = new Map<ISODate, ReturnType<typeof summarizeDay>>()
    if (!q.data) return m
    for (const d of cells) if (d) m.set(d, summarizeDay(d, { categories, ...q.data }))
    return m
  }, [q.data, cells, categories])

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const shift = (n: number) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }))
  const dow = settings.week_start === 1 ? [...DOW.slice(1), DOW[0]] : DOW
  const counts = [...summaries.values()].reduce(
    (a, s) => ({ cleared: a.cleared + (['cleared', 'strong', 'perfect'].includes(s.tier) ? 1 : 0), showed: a.showed + (s.score > 0 ? 1 : 0) }),
    { cleared: 0, showed: 0 },
  )

  return (
    <div className="px-4 pb-8 pt-4">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted">History</p>
      <div className="mt-1 flex items-center justify-between">
        <button aria-label="Previous month" className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink" onClick={() => shift(-1)}>
          <ChevronLeft />
        </button>
        <h1 className="font-display text-4xl">{monthLabel}</h1>
        <button aria-label="Next month" className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink" onClick={() => shift(1)}>
          <ChevronRight />
        </button>
      </div>
      <p className="mt-1 text-center text-sm text-muted">
        {counts.cleared} days cleared · showed up {counts.showed} days
      </p>

      {q.error && <ErrorNote message={q.error} />}
      {!q.data && q.loading && <Loading />}

      <div className="mt-5 grid grid-cols-7 gap-1.5" role="grid" aria-label={monthLabel}>
        {dow.map((d, i) => (
          <div key={i} className="pb-1 text-center text-xs font-semibold text-muted" aria-hidden>
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />
          const s = summaries.get(d)
          const tier = s?.tier ?? 'empty'
          const future = d > today
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => setSelected(d)}
              aria-label={`${monthDay(d)}: ${s ? `${s.score} of ${s.total}, ${TIER_LABEL[tier]}` : 'no data'}`}
              className={cx(
                'relative flex aspect-square -skew-x-6 flex-col items-center justify-center text-sm transition hover:brightness-110 disabled:opacity-30',
                CELL[tier],
                d === today && 'outline-2 outline-offset-2 outline-accent',
              )}
            >
              <span className="skew-x-6 font-semibold tabular-nums">{parseISODate(d).getDate()}</span>
              {s && s.score > 0 && (
                <span className="skew-x-6 text-[10px] font-bold leading-none tabular-nums">
                  {tier === 'perfect' ? '★' : `${s.score}/${s.total}`}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-2 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-2"><span className="h-4 w-4 -skew-x-6 bg-accent" /> Perfect clear ★</li>
        <li className="flex items-center gap-2"><span className="h-4 w-4 -skew-x-6 bg-ink" /> Strong day</li>
        <li className="flex items-center gap-2"><span className="h-4 w-4 -skew-x-6 border-2 border-ink" /> Day cleared</li>
        <li className="flex items-center gap-2"><span className="h-4 w-4 -skew-x-6 bg-surface-2" /> Partial (e.g. 2/5)</li>
      </ul>

      {selected && <DaySheet date={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function DaySheet({ date, onClose }: { date: ISODate; onClose: () => void }) {
  const { categories } = useApp()
  const day = useDay(date)
  const d = day.data
  const s = d ? summarizeDay(date, { categories, completions: d.completions, blocks: d.blocks, xpEvents: d.xpEvents }) : null
  return (
    <Sheet open onClose={onClose} title={`${weekdayLong(date)}, ${monthDay(date)}`}>
      {!d || !s ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <p className="font-display text-5xl tabular-nums">
              {s.score}
              <span className="text-2xl text-muted"> / {s.total}</span>
            </p>
            <div className="text-right">
              <p className="font-display text-xl">{TIER_LABEL[s.tier]}</p>
              <p className="text-sm text-muted">
                +{s.xp} EXP · {formatMinutes(s.minutes)} focused
              </p>
            </div>
          </div>

          <div className="border-t border-line">
            {categories
              .filter((c) => c.active || d.completions.some((x) => x.category_id === c.id))
              .map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  type={d.completions.find((x) => x.category_id === c.id)?.completion_type}
                  deviations={d.deviations.filter((x) => x.category_id === c.id)}
                />
              ))}
          </div>

          {d.blocks.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Blocks</h3>
              <ul className="space-y-1 text-sm">
                {d.blocks.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2">
                    <span>
                      {categories.find((c) => c.id === b.category_id)?.icon} {b.title}
                      <span className="text-muted"> · {formatRange(b.start_time, b.end_time)}</span>
                    </span>
                    <span className="shrink-0 text-muted">{b.status === 'completed' || b.status === 'partial' ? formatMinutes(b.actual_minutes ?? 0) : b.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.deviations.some((x) => x.note) && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Log notes</h3>
              <ul className="space-y-1 text-sm">
                {d.deviations.filter((x) => x.note).map((x) => (
                  <li key={x.id}>{x.note}</li>
                ))}
              </ul>
            </div>
          )}

          {d.note && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Day note</h3>
              <p className="whitespace-pre-wrap text-sm">{d.note}</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
