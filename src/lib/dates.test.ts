import { describe, expect, it } from 'vitest'
import { addDays, durationMinutes, formatMinutes, formatTime, monthGrid, startOfWeek } from './dates'

describe('dates', () => {
  it('finds week start (Mon / Sun)', () => {
    expect(startOfWeek('2026-09-30', 1)).toBe('2026-09-28') // Wed → Mon
    expect(startOfWeek('2026-09-30', 0)).toBe('2026-09-27') // Wed → Sun
    expect(startOfWeek('2026-09-28', 1)).toBe('2026-09-28')
  })
  it('crosses month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  })
  it('formats', () => {
    expect(formatTime('16:00')).toBe('4:00 PM')
    expect(formatTime('00:30')).toBe('12:30 AM')
    expect(formatMinutes(250)).toBe('4h 10m')
    expect(durationMinutes('09:30', '10:20')).toBe(50)
  })
  it('pads month grid', () => {
    const g = monthGrid(2026, 8, 1) // Sept 2026 starts Tuesday
    expect(g[0]).toBeNull()
    expect(g[1]).toBe('2026-09-01')
    expect(g.filter(Boolean)).toHaveLength(30)
  })
})
