import { Play, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CategoryRow } from '../components/CategoryRow'
import { CategorySheet } from '../components/CategorySheet'
import { Bar, Button, ErrorNote, Loading, ScorePips, SectionTitle, Tag } from '../components/ui'
import { cx } from '../lib/cx'
import { ActiveQuestConflict, startBlock } from '../data/questService'
import { useNow, useToday } from '../hooks/useClock'
import { useDay } from '../hooks/useDay'
import { useQuery } from '../hooks/useQuery'
import { pickNextQuest } from '../lib/blocks'
import { formatClock, formatRange, monthDay, weekdayLong } from '../lib/dates'
import { clearThreshold, dailyScore, isCleared, tierFor, TIER_LABEL } from '../lib/scoring'
import { elapsedSeconds, isReturning } from '../lib/xp'
import { useApp } from '../state/AppContext'

export function TodayScreen() {
  const today = useToday()
  const now = useNow(1000)
  const { categories, activeCategories, level, repo, refresh, notify } = useApp()
  const day = useDay(today)
  const lastActive = useQuery(() => repo.lastActiveDate(today), [today])
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [openCat, setOpenCat] = useState<string | null>(null)

  const data = day.data
  const score = useMemo(() => dailyScore(today, data?.completions ?? [], categories), [today, data, categories])
  const tier = tierFor(score)
  const xpToday = (data?.xpEvents ?? []).reduce((a, e) => a + e.amount, 0)
  const next = data ? pickNextQuest(data.blocks, now) : null
  const cat = (id: string) => categories.find((c) => c.id === id)
  const sheetCat = openCat ? cat(openCat) : undefined
  const returning = score.score === 0 && isReturning(lastActive.data ?? null, today)

  const start = async () => {
    if (!next) return
    if (next.state === 'active') return navigate(`/quest/${next.block.id}`)
    try {
      setStarting(true)
      await startBlock(repo, next.block)
      await refresh()
      navigate(`/quest/${next.block.id}`)
    } catch (e) {
      if (e instanceof ActiveQuestConflict) navigate(`/quest/${e.active.id}`)
      else notify(e instanceof Error ? e.message : 'Could not start the quest.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="px-4 pb-8 pt-4">
      {/* ---------------------------------------------------------------- status header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">{weekdayLong(today)}</p>
          <h1 className="font-display text-5xl leading-none">{monthDay(today)}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Level</p>
          <p className="font-display text-5xl leading-none text-accent">{level.level}</p>
        </div>
      </header>
      <div className="mt-3">
        <Bar value={level.progress} label="Experience to next level" />
        <p className="mt-1.5 text-right text-xs tabular-nums text-muted">
          {level.xpIntoLevel} / {level.xpForNext} EXP
        </p>
      </div>

      {returning && (
        <p className="anim-rise mt-4 border-l-4 border-accent bg-surface px-4 py-3 text-sm">
          <span className="font-display text-lg">Welcome back.</span> One quest is all it takes to be back in it.
        </p>
      )}

      {day.error && <div className="mt-6"><ErrorNote message={day.error} /></div>}
      {!data && day.loading && <Loading />}

      {data && (
        <>
          {/* ---------------------------------------------------------------- next quest (dominant) */}
          <section aria-labelledby="next-quest" className="mt-6">
            <Tag>
              <span id="next-quest">{next?.state === 'active' ? 'Quest in progress' : 'Next quest'}</span>
            </Tag>
            {next ? (
              <div className="cut-2 relative -mt-1 overflow-hidden bg-ink p-5 text-bg">
                <div aria-hidden className="absolute -right-6 top-0 h-full w-24 -skew-x-12 bg-accent/90" />
                <div className="relative pr-16">
                  <p className="text-sm font-semibold tabular-nums opacity-80">
                    {formatRange(next.block.start_time, next.block.end_time)}
                    {next.state === 'now' && ' · now'}
                  </p>
                  <p className="mt-1 font-display text-3xl leading-tight">
                    <span aria-hidden>{cat(next.block.category_id)?.icon} </span>
                    {next.block.title}
                  </p>
                  <p className="mt-1 text-sm opacity-80">
                    {cat(next.block.category_id)?.name} · {next.block.mode === 'minimum' ? 'Minimum Quest' : 'Quest'}
                  </p>
                  {next.state === 'active' && (
                    <p className="mt-2 flex items-center gap-2 font-display text-2xl tabular-nums">
                      <Timer size={20} aria-hidden /> {formatClock(elapsedSeconds(next.block, now))}
                      {next.block.paused_at && <span className="text-sm">· paused</span>}
                    </p>
                  )}
                </div>
                <Button size="lg" slanted className={cx('relative mt-4 w-full', next.state !== 'active' && 'anim-pulse')} onClick={start} disabled={starting}>
                  <Play size={24} fill="currentColor" aria-hidden />
                  {next.state === 'active' ? 'Resume quest' : 'Start quest'}
                </Button>
              </div>
            ) : (
              <div className="cut-2 -mt-1 bg-surface p-5">
                <p className="font-display text-2xl">
                  {data.blocks.length ? 'All planned quests handled' : 'No quests planned yet'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {data.blocks.length ? 'Add another block, or log a category below.' : 'Takes about a minute. Or tap a category below to log it directly.'}
                </p>
                <Link to="/plan" className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-accent font-display text-xl text-accent-ink slant">
                  {data.blocks.length ? 'Add a block' : 'Plan today'}
                </Link>
              </div>
            )}
          </section>

          {/* ---------------------------------------------------------------- daily score */}
          <section aria-labelledby="today-score" className="mt-7">
            <div className="flex items-end justify-between">
              <div>
                <h2 id="today-score" className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Today
                </h2>
                <p className="font-display text-6xl leading-none tabular-nums">
                  {score.score}
                  <span className="text-3xl text-muted"> / {score.total}</span>
                </p>
              </div>
              <div className="pb-1 text-right">
                <p
                  className={cx(
                    'font-display text-2xl',
                    tier === 'perfect' ? 'text-accent' : isCleared(tier) ? 'text-ok' : 'text-muted',
                  )}
                >
                  {TIER_LABEL[tier]}
                  {isCleared(tier) && (tier === 'perfect' ? ' ★' : ' ✓')}
                </p>
                <p className="text-sm tabular-nums text-muted">+{xpToday} EXP today</p>
              </div>
            </div>
            <div className="mt-3">
              <ScorePips score={score.score} total={score.total} clearAt={clearThreshold(score.total)} />
              <p className="mt-1.5 text-xs text-muted">
                {clearThreshold(score.total)} clears the day. Everything above is bonus.
              </p>
            </div>
          </section>

          {/* ---------------------------------------------------------------- categories */}
          <SectionTitle>Quest lines</SectionTitle>
          <div className="border-t border-line">
            {activeCategories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                type={data.completions.find((x) => x.category_id === c.id)?.completion_type}
                deviations={data.deviations.filter((d) => d.category_id === c.id)}
                onClick={() => setOpenCat(c.id)}
              />
            ))}
          </div>
        </>
      )}

      {sheetCat && data && (
        <CategorySheet
          open
          onClose={() => setOpenCat(null)}
          category={sheetCat}
          date={today}
          completion={data.completions.find((x) => x.category_id === sheetCat.id)}
          deviations={data.deviations.filter((d) => d.category_id === sheetCat.id)}
        />
      )}
    </div>
  )
}
