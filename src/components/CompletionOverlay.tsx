import { useEffect, useRef, useState } from 'react'
import { clearThreshold, isCleared, tierFor } from '../lib/scoring'
import type { QuestResult } from '../data/questService'
import { useApp } from '../state/AppContext'
import { formatMinutes } from '../lib/dates'
import { Button, ScorePips } from './ui'
import { cx } from '../lib/cx'

/**
 * The payoff moment. ~1.2s of motion: title slams in, EXP stamps, score pips fill,
 * then DAY CLEARED / PERFECT CLEAR if a threshold was crossed. Tap anywhere to continue.
 */
export function CompletionOverlay() {
  const { result } = useApp()
  return result ? <Overlay result={result} /> : null
}

function Overlay({ result }: { result: QuestResult }) {
  const { showResult } = useApp()
  const [stage, setStage] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const t1 = window.setTimeout(() => setStage(1), 450) // score moves
    const t2 = window.setTimeout(() => setStage(2), 900) // day state stamp
    btn.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && showResult(null)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      document.removeEventListener('keydown', onKey)
    }
  }, [result, showResult])

  const r = result
  const cleared = r.type === 'normal' || r.type === 'minimum'
  const score = stage >= 1 ? r.after : r.before
  const clearAt = clearThreshold(r.after.total)
  const tierAfter = tierFor(r.after)
  const crossedClear = !isCleared(tierFor(r.before)) && isCleared(tierAfter)
  const perfectNow = tierAfter === 'perfect' && tierFor(r.before) !== 'perfect'
  const levelUp = r.levelAfter.level > r.levelBefore.level
  const headline = r.type === 'normal' ? 'Quest completed' : r.type === 'minimum' ? 'Minimum quest cleared' : 'Progress logged'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-bg/95 backdrop-blur-sm"
      onClick={() => showResult(null)}
    >
      {/* diagonal red slash backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[18%] h-48 -skew-y-6 bg-accent anim-wipe" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[18%] h-48 -skew-y-6 stripes opacity-60" />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 safe-top">
        {r.welcomeBack && <p className="anim-rise mb-3 font-display text-xl text-accent">Welcome back.</p>}

        <div className="anim-slam relative -skew-x-12 self-start bg-ink px-5 py-2 text-bg">
          <h2 className="skew-x-12 font-display text-4xl sm:text-5xl">{headline}</h2>
        </div>

        <div className="anim-rise relative mt-5 text-accent-ink" style={{ animationDelay: '120ms' }}>
          <p className="font-display text-2xl">
            {r.category.icon} {r.category.name}
          </p>
          <p className="mt-1 text-base font-semibold opacity-90">
            {r.title !== r.category.name && `${r.title} · `}
            {r.minutes != null ? `${formatMinutes(r.minutes)} focused` : cleared ? (r.type === 'minimum' ? 'Reduced scope. Quest still cleared.' : 'Target met') : 'Recorded. Useful data.'}
          </p>
        </div>

        {(r.xpGained > 0 || r.bonusXp > 0) && (
          <div className="relative mt-10 flex items-end gap-4">
            <p className="anim-stamp font-display text-7xl text-ink" style={{ animationDelay: '220ms' }}>
              +{r.xpGained + r.bonusXp}
              <span className="ml-2 text-3xl">EXP</span>
            </p>
            {r.bonusXp > 0 && (
              <p className="anim-rise mb-2 text-sm font-semibold text-muted" style={{ animationDelay: '400ms' }}>
                incl. +{r.bonusXp} on schedule
              </p>
            )}
          </div>
        )}
        {r.type === 'minimum' && r.minutes != null && <p className="mt-2 text-sm text-muted">Reduced scope. Quest still cleared.</p>}

        <div className={cx('relative mt-8', !(r.xpGained > 0 || r.bonusXp > 0) && 'mt-16')}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">Daily progress</span>
            <span className="font-display text-2xl tabular-nums" aria-live="polite">
              {r.before.score} / {r.before.total} → {r.after.score} / {r.after.total}
            </span>
          </div>
          <ScorePips score={score.score} total={score.total} clearAt={clearAt} />
        </div>

        <div className="relative mt-6 min-h-16">
          {stage >= 2 && perfectNow && <p className="anim-stamp inline-block border-4 border-accent px-4 py-1 font-display text-4xl text-accent">Perfect clear ★</p>}
          {stage >= 2 && !perfectNow && crossedClear && <p className="anim-stamp inline-block border-4 border-ok px-4 py-1 font-display text-4xl text-ok">Day cleared ✓</p>}
          {stage >= 2 && levelUp && (
            <p className="anim-rise mt-3 font-display text-2xl">
              Level up → <span className="text-accent">Lv {r.levelAfter.level}</span>
            </p>
          )}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-md px-6 pb-8 safe-bottom">
        <Button ref={btn} size="lg" variant="secondary" className="w-full" onClick={() => showResult(null)}>
          Continue
        </Button>
      </div>
    </div>
  )
}
