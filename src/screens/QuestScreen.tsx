import { ChevronLeft, Pause, Play, Square, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DeviationSheet } from '../components/DeviationSheet'
import { Bar, Button, Empty, ErrorNote, Loading, Sheet, Tag } from '../components/ui'
import { ActiveQuestConflict, cancelBlock, completeBlock, pauseBlock, resumeBlock, startBlock } from '../data/questService'
import { useAction } from '../hooks/useAction'
import { useNow } from '../hooks/useClock'
import { useQuery } from '../hooks/useQuery'
import { formatClock, formatMinutes, formatRange } from '../lib/dates'
import { elapsedSeconds } from '../lib/xp'
import { useApp } from '../state/AppContext'
import type { CompletionType, TimeBlock } from '../types'

/** Focus mode. Minimal chrome: quest, timer, progress, one big action. */
export function QuestScreen() {
  const { id } = useParams()
  const { repo, categories, settings, showResult, notify } = useApp()
  const navigate = useNavigate()
  const now = useNow(1000)
  const { run, pending } = useAction()
  const [endEarly, setEndEarly] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  // Blocks are fetched by id across a wide window (quests are usually today's).
  const q = useQuery<TimeBlock | null>(async () => {
    const active = await repo.getActiveBlock()
    if (active?.id === id) return active
    const today = new Date()
    const from = new Date(today.getTime() - 14 * 86_400_000).toISOString().slice(0, 10)
    const to = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10)
    return (await repo.listBlocks(from, to)).find((b) => b.id === id) ?? null
  }, [id])

  if (q.error) return <div className="p-4"><ErrorNote message={q.error} /></div>
  if (q.loading && !q.data) return <div className="p-4"><Loading /></div>
  const block = q.data
  if (!block)
    return (
      <div className="p-4">
        <Empty title="Quest not found">
          <Link className="underline" to="/">Back to Today</Link>
        </Empty>
      </div>
    )

  const category = categories.find((c) => c.id === block.category_id)
  if (!category) return null
  const elapsed = elapsedSeconds(block, now)
  const plannedSec = Math.max(60, block.planned_minutes * 60)
  const paused = Boolean(block.paused_at)
  const isActive = block.status === 'active'
  const finished = block.status === 'completed' || block.status === 'partial'

  const finish = async (outcome: CompletionType) => {
    const r = await run(() => completeBlock(repo, { block, outcome, category, categories, settings }))
    if (r) {
      setEndEarly(false)
      navigate('/', { replace: true })
      showResult(r)
    }
  }

  const begin = async () => {
    try {
      await run(() => startBlock(repo, block))
    } catch (e) {
      if (e instanceof ActiveQuestConflict) navigate(`/quest/${e.active.id}`)
    }
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col overflow-hidden px-5 pb-6 pt-4">
      <div aria-hidden className="pointer-events-none absolute -right-20 top-24 h-72 w-40 -skew-x-12 bg-accent/15" />
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft size={18} /> Today
        </Link>
        <span className="text-sm tabular-nums text-muted">{formatRange(block.start_time, block.end_time)}</span>
      </div>

      <div className="mt-6">
        <Tag>{isActive ? (paused ? 'Paused' : 'Quest active') : finished ? 'Quest completed' : 'Ready'}</Tag>
        <h1 className="mt-3 font-display text-5xl leading-[0.95]">{block.title}</h1>
        <p className="mt-2 text-muted">
          <span aria-hidden>{category.icon}</span> {category.name} ·{' '}
          {block.mode === 'minimum' ? `Minimum: ${category.minimum_target}` : category.normal_target}
        </p>
        {block.notes && <p className="mt-2 border-l-2 border-line pl-3 text-sm text-muted">{block.notes}</p>}
      </div>

      <div className="mt-auto pt-10">
        <p
          className={'font-display text-[5.5rem] leading-none tabular-nums ' + (paused ? 'text-muted' : '')}
          role="timer"
          aria-live="off"
        >
          {formatClock(finished ? (block.actual_minutes ?? 0) * 60 : elapsed)}
        </p>
        <p className="mb-3 mt-1 text-sm text-muted">of {formatMinutes(block.planned_minutes)} planned</p>
        <Bar value={elapsed / plannedSec} tone={elapsed >= plannedSec ? 'ok' : 'accent'} label="Time against plan" />
      </div>

      <div className="mt-8 space-y-3">
        {!isActive && !finished && (
          <Button size="lg" slanted className="w-full" onClick={begin} disabled={pending}>
            <Play size={24} fill="currentColor" aria-hidden /> Start quest
          </Button>
        )}
        {isActive && (
          <>
            <Button size="lg" slanted className="w-full" disabled={pending} onClick={() => finish(block.mode)}>
              Complete
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => (paused ? resumeBlock(repo, block) : pauseBlock(repo, block)))}
              >
                {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setEndEarly(true)}>
                <Square size={16} aria-hidden /> End early
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={async () => {
                  await run(() => cancelBlock(repo, block))
                  notify('Quest returned to plan.')
                  navigate('/')
                }}
              >
                <X size={18} aria-hidden /> Cancel
              </Button>
            </div>
          </>
        )}
        {finished && (
          <Button variant="secondary" size="lg" className="w-full" onClick={() => navigate('/')}>
            Back to Today
          </Button>
        )}
      </div>

      <Sheet open={endEarly} onClose={() => setEndEarly(false)} title="End early">
        <p className="mb-4 text-sm text-muted">
          {formatMinutes(Math.round(elapsed / 60))} done. Reduce scope — don’t abandon the system.
        </p>
        <div className="space-y-3">
          <Button variant="min" className="w-full justify-between" disabled={pending} onClick={() => finish('minimum')}>
            <span>Minimum Quest cleared</span>
            <span className="font-display text-xl">+{category.minimum_xp}</span>
          </Button>
          <Button variant="ghost" className="w-full justify-between" disabled={pending} onClick={() => finish('partial')}>
            <span>Partial progress</span>
            <span className="text-sm text-muted">logs time</span>
          </Button>
          <button
            type="button"
            className="min-h-11 w-full text-sm text-muted underline underline-offset-4"
            onClick={() => {
              setEndEarly(false)
              setLogOpen(true)
            }}
          >
            What happened? (log it)
          </button>
        </div>
      </Sheet>
      <DeviationSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        category={category}
        date={block.date}
        blockId={block.id}
        defaultPartial={false}
      />
    </div>
  )
}
