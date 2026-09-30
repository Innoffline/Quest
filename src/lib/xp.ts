import type { Category, CompletionType, DailyCompletion, ISODate, TimeBlock } from '../types'
import { daysBetween, timeToMinutes } from './dates'

export function xpForCompletion(category: Pick<Category, 'normal_xp' | 'minimum_xp'>, type: CompletionType): number {
  if (type === 'normal') return category.normal_xp
  if (type === 'minimum') return category.minimum_xp
  return 0
}

/**
 * EXP is never deducted. Re-recording a category the same day only pays the
 * difference when it's an upgrade (Minimum → Normal = +10 by default).
 */
export function xpDelta(existing: DailyCompletion | undefined, category: Category, next: CompletionType): number {
  const already = existing?.xp_awarded ?? 0
  return Math.max(0, xpForCompletion(category, next) - already)
}

export const SCHEDULE_TOLERANCE_MIN = 20

/** A block counts as "on schedule" if it started near its planned start and finished near its planned end. */
export function isOnSchedule(block: Pick<TimeBlock, 'start_time' | 'end_time' | 'date'>, startedAt: Date, completedAt: Date): boolean {
  const toLocalMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes()
  const sameDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === block.date
  if (!sameDay(startedAt) || !sameDay(completedAt)) return false
  const start = timeToMinutes(block.start_time)
  const end = timeToMinutes(block.end_time)
  const s = toLocalMinutes(startedAt)
  const c = toLocalMinutes(completedAt)
  return Math.abs(s - start) <= SCHEDULE_TOLERANCE_MIN && c <= end + SCHEDULE_TOLERANCE_MIN
}

/** "Welcome back" when the last active day is 2+ days before today. Returning is rewarded, never penalized. */
export function isReturning(lastActiveDate: ISODate | null, today: ISODate): boolean {
  if (!lastActiveDate) return false
  return daysBetween(lastActiveDate, today) >= 2
}

/** Elapsed focused seconds for an active/paused block. */
export function elapsedSeconds(block: Pick<TimeBlock, 'started_at' | 'paused_at' | 'paused_seconds'>, now = new Date()): number {
  if (!block.started_at) return 0
  const end = block.paused_at ? new Date(block.paused_at) : now
  return Math.max(0, (end.getTime() - new Date(block.started_at).getTime()) / 1000 - block.paused_seconds)
}
