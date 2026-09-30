import type { Category, DailyCompletion, DeviationLog, ISODate, OutcomeMetric, TimeBlock, XPEvent } from '../types'
import { addDays } from './dates'
import { dailyScore, isCleared, tierFor, type Tier } from './scoring'

export interface LabelCount {
  label: string
  count: number
}

export interface Combo {
  from: string
  to: string
  count: number
}

export function countBy(values: (string | null | undefined)[]): LabelCount[] {
  const map = new Map<string, number>()
  for (const v of values) {
    const k = v?.trim()
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** Co-occurrence pairs (e.g. trigger → food). Only pairs seen at least `min` times are returned. */
export function combos(logs: DeviationLog[], from: 'trigger' | 'context', min = 2): Combo[] {
  const map = new Map<string, Combo>()
  for (const l of logs) {
    const a = l[from]?.trim()
    const b = l.item_label?.trim()
    if (!a || !b) continue
    const key = `${a}\u0000${b}`
    const c = map.get(key) ?? { from: a, to: b, count: 0 }
    c.count++
    map.set(key, c)
  }
  return [...map.values()].filter((c) => c.count >= min).sort((a, b) => b.count - a.count || a.from.localeCompare(b.from))
}

export interface DaySummary {
  date: ISODate
  score: number
  total: number
  tier: Tier
  xp: number
  minutes: number
}

export interface CategoryWeek {
  category: Category
  daysCleared: number
  normal: number
  minimum: number
  partial: number
  plannedDays: number
  plannedDaysCleared: number
  minutes: number
}

export interface DeviationSummary {
  total: number
  byCategory: { category: Category; count: number; top: LabelCount[] }[]
  foods: LabelCount[]
  triggers: LabelCount[]
  contexts: LabelCount[]
  triggerCombos: Combo[]
  contextCombos: Combo[]
}

export interface WeekSummary {
  days: DaySummary[]
  clears: number
  showedUp: number
  partialDays: number
  perCategory: CategoryWeek[]
  totalMinutes: number
  normalCount: number
  minimumCount: number
  xp: number
  deviations: DeviationSummary
}

export interface WeekInput {
  start: ISODate
  categories: Category[]
  completions: DailyCompletion[]
  blocks: TimeBlock[]
  xpEvents: XPEvent[]
  deviations: DeviationLog[]
}

const focusMinutes = (b: TimeBlock) => (b.status === 'completed' || b.status === 'partial' ? (b.actual_minutes ?? 0) : 0)

export function summarizeDay(date: ISODate, input: Omit<WeekInput, 'start' | 'deviations'>): DaySummary {
  const s = dailyScore(date, input.completions, input.categories)
  return {
    date,
    ...s,
    tier: tierFor(s),
    xp: input.xpEvents.filter((e) => e.date === date).reduce((a, e) => a + e.amount, 0),
    minutes: input.blocks.filter((b) => b.date === date).reduce((a, b) => a + focusMinutes(b), 0),
  }
}

export function summarizeWeek(input: WeekInput): WeekSummary {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(input.start, i))
  const inWeek = new Set(dates)
  const completions = input.completions.filter((c) => inWeek.has(c.date))
  const blocks = input.blocks.filter((b) => inWeek.has(b.date))
  const xpEvents = input.xpEvents.filter((e) => inWeek.has(e.date))
  const deviations = input.deviations.filter((d) => inWeek.has(d.date))
  const active = input.categories.filter((c) => c.active)

  const days = dates.map((d) => summarizeDay(d, { categories: input.categories, completions, blocks, xpEvents }))

  const perCategory: CategoryWeek[] = active.map((category) => {
    const mine = completions.filter((c) => c.category_id === category.id)
    const clearedDates = new Set(mine.filter((c) => c.completion_type === 'normal' || c.completion_type === 'minimum').map((c) => c.date))
    const plannedDates = new Set(blocks.filter((b) => b.category_id === category.id).map((b) => b.date))
    return {
      category,
      daysCleared: clearedDates.size,
      normal: mine.filter((c) => c.completion_type === 'normal').length,
      minimum: mine.filter((c) => c.completion_type === 'minimum').length,
      partial: mine.filter((c) => c.completion_type === 'partial').length,
      plannedDays: plannedDates.size,
      plannedDaysCleared: [...plannedDates].filter((d) => clearedDates.has(d)).length,
      minutes: blocks.filter((b) => b.category_id === category.id).reduce((a, b) => a + focusMinutes(b), 0),
    }
  })

  const catById = new Map(input.categories.map((c) => [c.id, c]))
  const foodLogs = deviations.filter((d) => catById.get(d.category_id)?.log_style === 'food')
  const byCategory = active
    .map((category) => {
      const logs = deviations.filter((d) => d.category_id === category.id)
      const top = category.log_style === 'food' ? countBy(logs.map((l) => l.item_label)) : countBy(logs.map((l) => l.trigger))
      return { category, count: logs.length, top }
    })
    .filter((x) => x.count > 0)

  return {
    days,
    clears: days.filter((d) => isCleared(d.tier)).length,
    showedUp: new Set(completions.map((c) => c.date)).size,
    partialDays: days.filter((d) => d.tier === 'partial').length,
    perCategory,
    totalMinutes: perCategory.reduce((a, c) => a + c.minutes, 0),
    normalCount: perCategory.reduce((a, c) => a + c.normal, 0),
    minimumCount: perCategory.reduce((a, c) => a + c.minimum, 0),
    xp: xpEvents.reduce((a, e) => a + e.amount, 0),
    deviations: {
      total: deviations.length,
      byCategory,
      foods: countBy(foodLogs.map((l) => l.item_label)),
      triggers: countBy(foodLogs.map((l) => l.trigger)),
      contexts: countBy(foodLogs.map((l) => l.context)),
      triggerCombos: combos(foodLogs, 'trigger'),
      contextCombos: combos(foodLogs, 'context'),
    },
  }
}

/** Mean of numeric metric values of one type within [from, to]. Null when no data. */
export function averageMetric(metrics: OutcomeMetric[], type: OutcomeMetric['metric_type'], from: ISODate, to: ISODate): number | null {
  const vals = metrics
    .filter((m) => m.metric_type === type && m.date >= from && m.date <= to && m.numeric_value != null)
    .map((m) => m.numeric_value as number)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function sumMetric(metrics: OutcomeMetric[], type: OutcomeMetric['metric_type'], from: ISODate, to: ISODate): number {
  return metrics
    .filter((m) => m.metric_type === type && m.date >= from && m.date <= to)
    .reduce((a, m) => a + (m.numeric_value ?? 0), 0)
}
