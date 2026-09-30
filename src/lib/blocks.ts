import type { ISODate, TimeBlock } from '../types'
import { minutesToTime, nowMinutes, timeToMinutes, todayISO } from './dates'

const byStart = (a: TimeBlock, b: TimeBlock) => a.start_time.localeCompare(b.start_time)

/** What should I do next? Active quest first; then the next planned block that hasn't ended; then any open one. */
export function pickNextQuest(blocks: TimeBlock[], now = new Date()): { block: TimeBlock; state: 'active' | 'upcoming' | 'now' | 'open' } | null {
  const active = blocks.find((b) => b.status === 'active')
  if (active) return { block: active, state: 'active' }
  const planned = blocks.filter((b) => b.status === 'planned').sort(byStart)
  const m = nowMinutes(now)
  const current = planned.find((b) => timeToMinutes(b.start_time) <= m && timeToMinutes(b.end_time) > m)
  if (current) return { block: current, state: 'now' }
  const upcoming = planned.find((b) => timeToMinutes(b.start_time) > m)
  if (upcoming) return { block: upcoming, state: 'upcoming' }
  return planned[0] ? { block: planned[0], state: 'open' } : null
}

/** Suggested start for a new block: after the last block, else the next quarter hour (today) or 09:00. */
export function nextSlot(blocks: TimeBlock[], date: ISODate, now = new Date()): string {
  const last = [...blocks].sort(byStart).at(-1)
  let start: number
  if (last) start = Math.max(timeToMinutes(last.end_time), timeToMinutes(last.start_time)) + 10
  else if (date === todayISO()) start = Math.max(8 * 60, Math.ceil((nowMinutes(now) + 5) / 15) * 15)
  else start = 9 * 60
  start = Math.ceil(start / 5) * 5
  return minutesToTime(Math.min(start, 22 * 60 + 30))
}

export function endFor(start: string, minutes: number): string {
  return minutesToTime(Math.min(timeToMinutes(start) + minutes, 23 * 60 + 59))
}
