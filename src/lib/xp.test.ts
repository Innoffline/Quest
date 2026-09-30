import { describe, expect, it } from 'vitest'
import type { Category, DailyCompletion } from '../types'
import { elapsedSeconds, isOnSchedule, isReturning, xpDelta } from './xp'

const cat = { normal_xp: 20, minimum_xp: 10 } as Category
const existing = (type: DailyCompletion['completion_type'], xp: number) =>
  ({ completion_type: type, xp_awarded: xp }) as DailyCompletion

describe('xp', () => {
  it('awards normal/minimum and pays only upgrades', () => {
    expect(xpDelta(undefined, cat, 'normal')).toBe(20)
    expect(xpDelta(undefined, cat, 'minimum')).toBe(10)
    expect(xpDelta(existing('minimum', 10), cat, 'normal')).toBe(10)
    expect(xpDelta(existing('normal', 20), cat, 'minimum')).toBe(0)
    expect(xpDelta(undefined, cat, 'partial')).toBe(0)
  })
  it('never returns negative EXP', () => {
    expect(xpDelta(existing('normal', 20), cat, 'partial')).toBe(0)
  })
  it('detects on-schedule completion', () => {
    const block = { date: '2026-09-30', start_time: '16:00', end_time: '17:00' }
    expect(isOnSchedule(block, new Date(2026, 8, 30, 16, 5), new Date(2026, 8, 30, 17, 2))).toBe(true)
    expect(isOnSchedule(block, new Date(2026, 8, 30, 17, 0), new Date(2026, 8, 30, 18, 0))).toBe(false)
    expect(isOnSchedule(block, new Date(2026, 8, 29, 16, 0), new Date(2026, 8, 29, 17, 0))).toBe(false)
  })
  it('welcomes back after a gap', () => {
    expect(isReturning('2026-09-29', '2026-09-30')).toBe(false)
    expect(isReturning('2026-09-27', '2026-09-30')).toBe(true)
    expect(isReturning(null, '2026-09-30')).toBe(false)
  })
  it('subtracts paused time', () => {
    const start = new Date(2026, 8, 30, 10, 0)
    const now = new Date(2026, 8, 30, 11, 0)
    expect(elapsedSeconds({ started_at: start.toISOString(), paused_at: null, paused_seconds: 600 }, now)).toBe(3000)
    expect(elapsedSeconds({ started_at: null, paused_at: null, paused_seconds: 0 }, now)).toBe(0)
  })
})
