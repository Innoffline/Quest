import { ChevronLeft, ChevronRight, Copy, Play, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BlockEditor } from '../components/BlockEditor'
import { Empty, ErrorNote, Loading, SectionTitle, inputCls } from '../components/ui'
import { cx } from '../lib/cx'
import { ActiveQuestConflict, copyPlan, makeBlock, startBlock } from '../data/questService'
import { useAction } from '../hooks/useAction'
import { useToday } from '../hooks/useClock'
import { useDay } from '../hooks/useDay'
import { useQuery } from '../hooks/useQuery'
import { endFor, nextSlot } from '../lib/blocks'
import { addDays, formatMinutes, formatTime, monthDay, weekdayLong } from '../lib/dates'
import { useApp } from '../state/AppContext'
import type { BlockStatus, Category, TimeBlock } from '../types'

const STATUS_BADGE: Record<BlockStatus, { text: string; cls: string }> = {
  planned: { text: 'Planned', cls: 'text-muted border-line' },
  active: { text: 'Active', cls: 'text-accent border-accent' },
  completed: { text: 'Cleared ✓', cls: 'text-ok border-ok' },
  partial: { text: 'Partial', cls: 'text-min border-min' },
  skipped: { text: 'Skipped', cls: 'text-muted border-line' },
}

export function PlanScreen() {
  const today = useToday()
  const [date, setDate] = useState(today)
  const { repo, activeCategories, categories, notify } = useApp()
  const day = useDay(date)
  const prev = useQuery(() => repo.listBlocks(addDays(date, -1), addDays(date, -1)), [date])
  const { run, pending } = useAction()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<TimeBlock | null>(null)

  const blocks = day.data?.blocks ?? []
  const label = date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : date === addDays(today, -1) ? 'Yesterday' : weekdayLong(date)
  const cat = (id: string) => categories.find((c) => c.id === id)

  const quickAdd = async (c: Category) => {
    const start = nextSlot(blocks, date)
    const b = makeBlock({ date, category: c, start, end: endFor(start, c.default_minutes) })
    const ok = await run(async () => {
      await repo.saveBlock(b)
      return true
    })
    if (ok) setEditing(b)
  }

  const start = async (b: TimeBlock) => {
    try {
      await startBlock(repo, b)
      navigate(`/quest/${b.id}`)
    } catch (e) {
      if (e instanceof ActiveQuestConflict) {
        notify('Finish or pause the active quest first.')
        navigate(`/quest/${e.active.id}`)
      }
    }
  }

  const plannedByCat = activeCategories
    .map((c) => ({ c, min: blocks.filter((b) => b.category_id === c.id).reduce((a, b) => a + b.planned_minutes, 0) }))
    .filter((x) => x.min > 0)

  return (
    <div className="px-4 pb-8 pt-4">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-muted">Mission planning</p>
        <div className="mt-1 flex items-center justify-between">
          <button aria-label="Previous day" className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft />
          </button>
          <button className="text-center" onClick={() => setDate(today)} aria-label="Jump to today">
            <span className="block font-display text-4xl leading-none">{label}</span>
            <span className="text-sm text-muted">{monthDay(date)}</span>
          </button>
          <button aria-label="Next day" className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight />
          </button>
        </div>
      </header>

      {/* quick add */}
      <section aria-label="Add a quest block" className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Tap to add a block</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {activeCategories.map((c) => (
            <button
              key={c.id}
              disabled={pending}
              onClick={() => quickAdd(c)}
              className="slant flex min-h-14 shrink-0 items-center gap-2 bg-surface px-5 font-semibold transition hover:bg-surface-2 active:bg-accent active:text-accent-ink"
            >
              <Plus size={16} aria-hidden />
              <span aria-hidden>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      </section>

      {day.error && <div className="mt-4"><ErrorNote message={day.error} /></div>}
      {!day.data && day.loading && <Loading />}

      {day.data && (
        <>
          <SectionTitle right={blocks.length > 0 && <span className="text-sm text-muted">{formatMinutes(blocks.reduce((a, b) => a + b.planned_minutes, 0))} planned</span>}>
            Timeline
          </SectionTitle>

          {blocks.length === 0 ? (
            <div className="space-y-3">
              <Empty title="No blocks yet">Add 2–4 blocks. That’s a full day — you only need to clear the next one.</Empty>
              {(prev.data?.length ?? 0) > 0 && (
                <button
                  onClick={() => run(() => copyPlan(repo, addDays(date, -1), date))}
                  className="flex min-h-12 w-full items-center justify-center gap-2 border-2 border-ink font-semibold hover:bg-ink hover:text-bg"
                >
                  <Copy size={18} aria-hidden /> Copy previous day ({prev.data?.length} blocks)
                </button>
              )}
            </div>
          ) : (
            <ol className="space-y-3">
              {blocks.map((b, i) => {
                const c = cat(b.category_id)
                const badge = STATUS_BADGE[b.status]
                const done = b.status === 'completed' || b.status === 'partial' || b.status === 'skipped'
                return (
                  <li key={b.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}>
                    <div className={cx('cut-2 flex items-stretch bg-surface', done && 'opacity-70', b.status === 'active' && 'ring-2 ring-accent')}>
                      <div className={cx('w-2 shrink-0', b.mode === 'minimum' ? 'bg-min' : 'bg-accent')} aria-hidden />
                      <button className="min-w-0 flex-1 px-4 py-3 text-left" onClick={() => setEditing(b)} aria-label={`Edit ${b.title}`}>
                        <p className="font-display text-2xl leading-none tabular-nums">
                          {formatTime(b.start_time).replace(' ', '')}
                          <span className="text-muted"> – {formatTime(b.end_time).replace(' ', '')}</span>
                        </p>
                        <p className="mt-1.5 truncate font-semibold">
                          <span aria-hidden>{c?.icon} </span>
                          {b.title}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className={cx('border px-1.5 py-0.5 font-semibold uppercase tracking-wide', badge.cls)}>{badge.text}</span>
                          <span className="text-muted">
                            {b.mode === 'minimum' ? 'Minimum' : 'Quest'} · {formatMinutes(b.actual_minutes ?? b.planned_minutes)}
                          </span>
                        </p>
                      </button>
                      {date === today && (b.status === 'planned' || b.status === 'active') && (
                        <button
                          onClick={() => (b.status === 'active' ? navigate(`/quest/${b.id}`) : start(b))}
                          className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 bg-accent text-accent-ink font-display text-sm"
                          aria-label={`${b.status === 'active' ? 'Resume' : 'Start'} ${b.title}`}
                        >
                          <Play size={22} fill="currentColor" aria-hidden />
                          {b.status === 'active' ? 'Resume' : 'Start'}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {plannedByCat.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              {plannedByCat.map(({ c, min }) => `${c.icon} ${formatMinutes(min)}`).join('   ')}
            </p>
          )}

          <SectionTitle>Day note</SectionTitle>
          <DayNoteField key={`${date}:${day.data.note}`} date={date} initial={day.data.note} />
        </>
      )}

      <BlockEditor block={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function DayNoteField({ date, initial }: { date: string; initial: string }) {
  const { repo } = useApp()
  const { run } = useAction()
  const [note, setNote] = useState(initial)
  return (
    <textarea
      className={inputCls + ' min-h-20 py-2'}
      placeholder="Anything to remember about today (optional)"
      value={note}
      maxLength={1000}
      onChange={(e) => setNote(e.target.value)}
      onBlur={() => note !== initial && run(() => repo.saveDayNote({ date, note }))}
      aria-label="Day note"
    />
  )
}
