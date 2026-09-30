import type { Category, CompletionType, DailyCompletion, ISODate } from '../types'

/** Normal and Minimum both clear a category. Partial is logged progress, not a point. */
export const countsAsPoint = (t: CompletionType | undefined) => t === 'normal' || t === 'minimum'

export interface DayScore {
  score: number
  total: number
}

export function dailyScore(date: ISODate, completions: DailyCompletion[], categories: Category[]): DayScore {
  const active = categories.filter((c) => c.active)
  const ids = new Set(active.map((c) => c.id))
  const cleared = new Set(
    completions.filter((c) => c.date === date && ids.has(c.category_id) && countsAsPoint(c.completion_type)).map((c) => c.category_id),
  )
  return { score: cleared.size, total: active.length }
}

export type Tier = 'empty' | 'partial' | 'cleared' | 'strong' | 'perfect'

/**
 * Thresholds scale with the number of active categories.
 * With 5 categories: 3 = cleared, 4 = strong, 5 = perfect. 3/5 is the success line — not 5/5.
 */
export function clearThreshold(total: number): number {
  if (total <= 0) return 1
  return Math.min(total, Math.max(1, Math.ceil(total * 0.6)))
}

export function tierFor({ score, total }: DayScore): Tier {
  if (total <= 0 || score <= 0) return 'empty'
  if (score >= total) return 'perfect'
  const clear = clearThreshold(total)
  if (score < clear) return 'partial'
  if (score >= total - 1 && total - 1 > clear) return 'strong'
  return 'cleared'
}

export const TIER_LABEL: Record<Tier, string> = {
  empty: 'Ready to start',
  partial: 'Partial progress',
  cleared: 'Day cleared',
  strong: 'Strong day',
  perfect: 'Perfect clear',
}

export const isCleared = (t: Tier) => t === 'cleared' || t === 'strong' || t === 'perfect'

export const COMPLETION_LABEL: Record<CompletionType, string> = {
  normal: 'Quest cleared',
  minimum: 'Minimum cleared',
  partial: 'Partial',
  incomplete: 'Logged',
}
