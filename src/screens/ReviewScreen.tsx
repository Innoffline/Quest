import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DayBars, RankBars } from '../components/charts'
import { StatusMark } from '../components/CategoryRow'
import { Button, ErrorNote, Field, Loading, SectionTitle, Tag, inputCls } from '../components/ui'
import { cx } from '../lib/cx'
import { newId } from '../data/repository'
import { useAction } from '../hooks/useAction'
import { useToday } from '../hooks/useClock'
import { useQuery } from '../hooks/useQuery'
import { averageMetric, summarizeWeek, type WeekSummary } from '../lib/aggregate'
import { addDays, formatMinutes, monthDay, shortDay, startOfWeek } from '../lib/dates'
import { clearThreshold } from '../lib/scoring'
import { useApp } from '../state/AppContext'
import type { DailyCompletion, ISODate, MetricType, OutcomeMetric } from '../types'

const JOB_METRICS: { type: MetricType; label: string }[] = [
  { type: 'applications_sent', label: 'Applications sent' },
  { type: 'recruiter_responses', label: 'Recruiter responses' },
  { type: 'referrals', label: 'Referrals' },
  { type: 'networking', label: 'Networking conversations' },
  { type: 'interviews', label: 'Interviews' },
  { type: 'offers', label: 'Offers' },
]

export default function ReviewScreen() {
  const today = useToday()
  const { repo, categories, settings } = useApp()
  const [offset, setOffset] = useState(0) // weeks relative to the current one
  const weekStart = addDays(startOfWeek(today, settings.week_start), offset * 7)
  const weekEnd = addDays(weekStart, 6)
  const prevStart = addDays(weekStart, -7)

  const q = useQuery(async () => {
    const [completions, blocks, xpEvents, deviations, metrics, review] = await Promise.all([
      repo.listCompletions(weekStart, weekEnd),
      repo.listBlocks(weekStart, weekEnd),
      repo.listXpEvents(weekStart, weekEnd),
      repo.listDeviations(weekStart, weekEnd),
      repo.listMetrics(prevStart, weekEnd),
      repo.getWeeklyReview(weekStart),
    ])
    return { completions, blocks, xpEvents, deviations, metrics, review }
  }, [weekStart])

  const summary = useMemo(
    () => (q.data ? summarizeWeek({ start: weekStart, categories, ...q.data }) : null),
    [q.data, weekStart, categories],
  )
  const isCurrent = offset === 0

  return (
    <div className="px-4 pb-10 pt-4">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted">Weekly review</p>
      <div className="mt-1 flex items-center justify-between">
        <button aria-label="Previous week" className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink" onClick={() => setOffset(offset - 1)}>
          <ChevronLeft />
        </button>
        <h1 className="text-center font-display text-3xl leading-tight">
          {monthDay(weekStart)} – {monthDay(weekEnd)}
          {isCurrent && <span className="block text-sm font-sans normal-case tracking-normal text-muted">This week · in progress</span>}
        </h1>
        <button
          aria-label="Next week"
          disabled={isCurrent}
          className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink disabled:opacity-30"
          onClick={() => setOffset(offset + 1)}
        >
          <ChevronRight />
        </button>
      </div>

      {q.error && <ErrorNote message={q.error} />}
      {!summary && q.loading && <Loading />}
      {summary && q.data && (
        <>
          <Results s={summary} />
          <Consistency s={summary} weekStart={weekStart} completions={q.data.completions} />
          <Focus s={summary} />
          <JobOutcomes key={`job-${weekStart}`} s={summary} weekStart={weekStart} metrics={q.data.metrics} />
          <Health key={`health-${weekStart}`} weekStart={weekStart} metrics={q.data.metrics} today={today} s={summary} />
          <Patterns s={summary} />
          <Reflection key={`refl-${weekStart}`} weekStart={weekStart} initial={q.data.review} />
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ sections

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="cut bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={cx('mt-1 font-display text-4xl leading-none tabular-nums', accent && 'text-accent')}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function Results({ s }: { s: WeekSummary }) {
  const total = s.days[0]?.total ?? 5
  return (
    <section aria-labelledby="results" className="mt-6">
      <Tag>
        <span id="results">Weekly result</span>
      </Tag>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Days cleared" value={`${s.clears} / 7`} accent sub={`${clearThreshold(total)}/${total} clears a day`} />
        <Stat label="EXP earned" value={`+${s.xp}`} />
        <Stat label="Focus time" value={formatMinutes(s.totalMinutes)} sub="Timed quest blocks" />
        <Stat label="Showed up" value={`${s.showedUp} / 7`} sub="Days with a cleared quest" />
      </div>
      <SectionTitle>Daily score</SectionTitle>
      <DayBars
        ariaLabel="Daily score for each day of the week"
        data={s.days.map((d) => ({ label: shortDay(d.date), value: d.score }))}
        max={total}
        reference={clearThreshold(total)}
        unit={`/ ${total}`}
      />
      <SectionTitle>EXP by day</SectionTitle>
      <DayBars ariaLabel="EXP earned each day" data={s.days.map((d) => ({ label: shortDay(d.date), value: d.xp }))} unit="EXP" />
    </section>
  )
}

function Consistency({ s, weekStart, completions }: { s: WeekSummary; weekStart: ISODate; completions: DailyCompletion[] }) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  return (
    <section aria-labelledby="consistency">
      <SectionTitle>
        <span id="consistency">Behavior</span>
      </SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-2 text-left font-semibold">Quest line</th>
              {dates.map((d) => (
                <th key={d} className="pb-2 font-semibold">
                  {shortDay(d).slice(0, 2)}
                </th>
              ))}
              <th className="pb-2 text-right font-semibold">Days</th>
            </tr>
          </thead>
          <tbody>
            {s.perCategory.map((c) => (
              <tr key={c.category.id} className="border-t border-line">
                <td className="py-2 pr-2">
                  <span aria-hidden>{c.category.icon}</span> {c.category.name}
                </td>
                {dates.map((d) => {
                  const t = completions.find((x) => x.date === d && x.category_id === c.category.id)?.completion_type
                  return (
                    <td key={d} className="py-2 text-center">
                      <span className="inline-flex scale-75" title={t ?? 'open'}>
                        <StatusMark type={t} />
                      </span>
                    </td>
                  )
                })}
                <td className="py-2 text-right font-semibold tabular-nums">
                  {c.daysCleared}/7
                  {c.plannedDays > 0 && (
                    <span className="block text-xs font-normal text-muted">
                      {c.plannedDaysCleared}/{c.plannedDays} planned
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">✓ green = Quest · ✓ yellow = Minimum · ~ = Partial · • = Logged</p>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="bg-surface p-3">
          <p className="font-display text-3xl tabular-nums">{s.normalCount}</p>
          <p className="text-xs text-muted">Normal quests</p>
        </div>
        <div className="bg-surface p-3">
          <p className="font-display text-3xl tabular-nums">{s.minimumCount}</p>
          <p className="text-xs text-muted">Minimum quests</p>
        </div>
        <div className="bg-surface p-3">
          <p className="font-display text-3xl tabular-nums">{s.partialDays}</p>
          <p className="text-xs text-muted">Partial days</p>
        </div>
      </div>
      {s.minimumCount > 0 && (
        <p className="mt-2 text-sm text-muted">{s.minimumCount} Minimum Quest{s.minimumCount > 1 ? 's' : ''} kept progress going on lower-capacity days.</p>
      )}
    </section>
  )
}

function Focus({ s }: { s: WeekSummary }) {
  const items = s.perCategory.filter((c) => c.minutes > 0).map((c) => ({ label: `${c.category.icon} ${c.category.name}`, count: c.minutes }))
  return (
    <section aria-labelledby="focus">
      <SectionTitle>
        <span id="focus">Focus time</span>
      </SectionTitle>
      {items.length ? (
        <RankBars items={items} format={formatMinutes} />
      ) : (
        <p className="text-sm text-muted">No timed blocks this week. Start a quest from the plan to track focus time.</p>
      )}
    </section>
  )
}

function useMetricSaver(date: ISODate, metrics: OutcomeMetric[]) {
  const { repo } = useApp()
  const { run } = useAction()
  return (type: MetricType, patch: { numeric_value?: number | null; text_value?: string | null }) => {
    const existing = metrics.find((m) => m.date === date && m.metric_type === type)
    const empty = (patch.numeric_value == null || Number.isNaN(patch.numeric_value)) && !patch.text_value
    if (empty) return existing ? run(() => repo.deleteMetric(existing.id)) : Promise.resolve()
    return run(() =>
      repo.saveMetric({
        id: existing?.id ?? newId(),
        date,
        metric_type: type,
        numeric_value: patch.numeric_value ?? null,
        text_value: patch.text_value ?? null,
      }),
    )
  }
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <button aria-label={`Decrease ${label}`} className="flex h-10 w-10 items-center justify-center bg-surface disabled:opacity-30" disabled={value <= 0} onClick={() => onChange(value - 1)}>
          <Minus size={16} />
        </button>
        <span className="w-10 text-center font-display text-2xl tabular-nums" aria-live="polite">
          {value}
        </span>
        <button aria-label={`Increase ${label}`} className="flex h-10 w-10 items-center justify-center bg-surface" onClick={() => onChange(value + 1)}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

function JobOutcomes({ s, weekStart, metrics }: { s: WeekSummary; weekStart: ISODate; metrics: OutcomeMetric[] }) {
  const save = useMetricSaver(weekStart, metrics)
  const job = s.perCategory.find((c) => /job|career/i.test(c.category.name))
  const val = (t: MetricType) => metrics.find((m) => m.date === weekStart && m.metric_type === t)
  const stageInit = val('interview_stages')?.text_value ?? ''
  const [stage, setStage] = useState(stageInit)

  return (
    <section aria-labelledby="job">
      <SectionTitle>
        <span id="job">Job search</span>
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <div className="border-l-4 border-ink bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Behavior</p>
          <p className="mt-1 font-display text-2xl">{job ? formatMinutes(job.minutes) : '—'}</p>
          <p className="text-xs text-muted">{job ? `${job.daysCleared} days on it` : 'No job-search quest line'}</p>
        </div>
        <div className="border-l-4 border-accent bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Outcomes</p>
          <p className="mt-1 font-display text-2xl">{(val('recruiter_responses')?.numeric_value ?? 0) + (val('interviews')?.numeric_value ?? 0)}</p>
          <p className="text-xs text-muted">responses + interviews</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Outcomes lag behavior by weeks. Judge the week by the behavior column.</p>
      <div className="mt-3">
        {JOB_METRICS.map((m) => (
          <Stepper key={m.type} label={m.label} value={val(m.type)?.numeric_value ?? 0} onChange={(v) => save(m.type, { numeric_value: v || null })} />
        ))}
      </div>
      <div className="mt-3">
        <Field label="Interview stages (optional)">
          <input
            className={inputCls}
            value={stage}
            maxLength={200}
            placeholder="e.g. Company A — onsite; Company B — recruiter screen"
            onChange={(e) => setStage(e.target.value)}
            onBlur={() => stage !== stageInit && save('interview_stages', { text_value: stage.trim() || null })}
          />
        </Field>
      </div>
    </section>
  )
}

function Health({ weekStart, metrics, today, s }: { weekStart: ISODate; metrics: OutcomeMetric[]; today: ISODate; s: WeekSummary }) {
  const { settings } = useApp()
  const weekEnd = addDays(weekStart, 6)
  const logDate = today >= weekStart && today <= weekEnd ? today : weekEnd
  const saveDaily = useMetricSaver(logDate, metrics)
  const saveWeekly = useMetricSaver(weekStart, metrics)
  const todayWeight = metrics.find((m) => m.date === logDate && m.metric_type === 'weight')?.numeric_value
  const [w, setW] = useState(todayWeight != null ? String(Math.round(todayWeight * 10) / 10) : '')
  const waist = metrics.find((m) => m.date === weekStart && m.metric_type === 'waist')?.numeric_value
  const [waistText, setWaistText] = useState(waist != null ? String(waist) : '')
  const note = metrics.find((m) => m.date === weekStart && m.metric_type === 'health_note')?.text_value ?? ''
  const [noteText, setNoteText] = useState(note)

  const avg = averageMetric(metrics, 'weight', weekStart, weekEnd)
  const prevAvg = averageMetric(metrics, 'weight', addDays(weekStart, -7), addDays(weekStart, -1))
  const entries = metrics.filter((m) => m.metric_type === 'weight' && m.date >= weekStart && m.date <= weekEnd).length
  const exercise = s.perCategory.find((c) => c.category.log_style === 'reason' && /exercise|workout|gym|move/i.test(c.category.name))
  const unit = settings.weight_unit

  return (
    <section aria-labelledby="health">
      <SectionTitle>
        <span id="health">Health outcomes</span>
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="7-day avg weight" value={avg != null ? `${avg.toFixed(1)}` : '—'} sub={avg != null ? `${unit} · ${entries} weigh-in${entries === 1 ? '' : 's'}` : 'Log weight to see the average'} />
        <Stat
          label="vs last week"
          value={avg != null && prevAvg != null ? `${avg - prevAvg > 0 ? '+' : ''}${(avg - prevAvg).toFixed(1)}` : '—'}
          sub={avg != null && prevAvg != null ? `${unit} · weekly averages` : 'Needs two weeks of data'}
        />
      </div>
      {exercise && (
        <p className="mt-2 text-sm text-muted">
          {exercise.category.icon} Workouts completed: <span className="font-semibold text-ink">{exercise.daysCleared}</span>
          {exercise.plannedDays > 0 && ` · ${exercise.plannedDaysCleared} of ${exercise.plannedDays} planned sessions`}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label={`Weight · ${monthDay(logDate)}`}>
          <input
            className={inputCls}
            inputMode="decimal"
            value={w}
            placeholder={unit}
            onChange={(e) => setW(e.target.value.replace(/[^\d.]/g, ''))}
            onBlur={() => w !== (todayWeight != null ? String(Math.round(todayWeight * 10) / 10) : '') && saveDaily('weight', { numeric_value: w ? Number(w) : null })}
          />
        </Field>
        <Field label="Waist (optional)">
          <input
            className={inputCls}
            inputMode="decimal"
            value={waistText}
            placeholder={unit === 'kg' ? 'cm' : 'in'}
            onChange={(e) => setWaistText(e.target.value.replace(/[^\d.]/g, ''))}
            onBlur={() => waistText !== (waist != null ? String(waist) : '') && saveWeekly('waist', { numeric_value: waistText ? Number(waistText) : null })}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Health note (optional)">
          <input
            className={inputCls}
            value={noteText}
            maxLength={280}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={() => noteText !== note && saveWeekly('health_note', { text_value: noteText.trim() || null })}
          />
        </Field>
      </div>
      <p className="mt-2 text-xs text-muted">Daily weight swings with water and salt. The weekly average is the signal.</p>
    </section>
  )
}

function Patterns({ s }: { s: WeekSummary }) {
  const d = s.deviations
  const nutrition = d.byCategory.find((b) => b.category.log_style === 'food')
  const others = d.byCategory.filter((b) => b.category.log_style !== 'food')
  const combos = [...d.triggerCombos, ...d.contextCombos].sort((a, b) => b.count - a.count).slice(0, 4)
  return (
    <section aria-labelledby="patterns">
      <SectionTitle>
        <span id="patterns">Observed patterns</span>
      </SectionTitle>
      {d.total === 0 ? (
        <p className="text-sm text-muted">No “What happened?” logs this week. When plans change, a 20-second log here turns into useful patterns.</p>
      ) : (
        <div className="space-y-6">
          {nutrition && (
            <div>
              <p className="mb-3 text-sm">
                <span aria-hidden>{nutrition.category.icon}</span> {nutrition.category.name} logs: <span className="font-display text-xl">{nutrition.count}</span>
              </p>
              {d.foods.length > 0 && <SubList title="Food / event" items={d.foods} />}
              {d.triggers.length > 0 && <SubList title="Triggers" items={d.triggers} />}
              {d.contexts.length > 0 && <SubList title="Contexts" items={d.contexts} />}
            </div>
          )}
          {combos.length > 0 && (
            <div className="cut stripes border-2 border-ink p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Observed together</p>
              <ul className="mt-2 space-y-1.5">
                {combos.map((c) => (
                  <li key={c.from + c.to} className="flex justify-between gap-3">
                    <span className="font-semibold">
                      {c.from} → {c.to}
                    </span>
                    <span className="tabular-nums text-muted">{c.count} times</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">These appeared together — a pattern to notice, not a proven cause.</p>
            </div>
          )}
          {others.map((o) => (
            <SubList key={o.category.id} title={`${o.category.icon} ${o.category.name} — what got in the way`} items={o.top} />
          ))}
        </div>
      )}
    </section>
  )
}

function SubList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      <RankBars items={items.slice(0, 5)} />
    </div>
  )
}

function Reflection({ weekStart, initial }: { weekStart: ISODate; initial: { what_worked: string; next_adjustment: string } | null }) {
  const { repo, notify } = useApp()
  const { run, pending } = useAction()
  const [worked, setWorked] = useState(initial?.what_worked ?? '')
  const [adjust, setAdjust] = useState(initial?.next_adjustment ?? '')
  const dirty = worked !== (initial?.what_worked ?? '') || adjust !== (initial?.next_adjustment ?? '')

  return (
    <section aria-labelledby="reflection">
      <SectionTitle>
        <span id="reflection">Reflection</span>
      </SectionTitle>
      <div className="space-y-4">
        <Field label="What worked this week?">
          <textarea className={inputCls + ' min-h-20 py-2'} value={worked} maxLength={1000} onChange={(e) => setWorked(e.target.value)} />
        </Field>
        <Field label="ONE thing to adjust next week" hint="One useful adjustment beats ten ambitious changes.">
          <input className={inputCls} value={adjust} maxLength={200} onChange={(e) => setAdjust(e.target.value)} />
        </Field>
        <Button
          className="w-full"
          size="lg"
          disabled={!dirty || pending}
          onClick={async () => {
            await run(() => repo.saveWeeklyReview({ week_start: weekStart, what_worked: worked.trim(), next_adjustment: adjust.trim() }))
            notify('Review saved.')
          }}
        >
          Save review
        </Button>
      </div>
    </section>
  )
}
