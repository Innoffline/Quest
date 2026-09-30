import { describe, expect, it } from 'vitest'
import type { Category, DailyCompletion } from '../types'
import { clearThreshold, dailyScore, tierFor } from './scoring'

const cat = (id: string, active = true) => ({ id, active }) as Category
const done = (category_id: string, completion_type: DailyCompletion['completion_type'], date = '2026-09-30') =>
  ({ id: category_id + date, date, category_id, completion_type, completed_at: '', xp_awarded: 0 }) as DailyCompletion

describe('daily score', () => {
  const cats = ['a', 'b', 'c', 'd', 'e'].map((id) => cat(id))
  it('counts normal and minimum, not partial', () => {
    const s = dailyScore('2026-09-30', [done('a', 'normal'), done('b', 'minimum'), done('c', 'partial'), done('d', 'incomplete')], cats)
    expect(s).toEqual({ score: 2, total: 5 })
  })
  it('ignores inactive categories and other dates', () => {
    const s = dailyScore('2026-09-30', [done('a', 'normal'), done('x', 'normal'), done('b', 'normal', '2026-09-29')], [...cats, cat('x', false)])
    expect(s).toEqual({ score: 1, total: 5 })
  })
  it('makes 3/5 a clear, 4/5 strong, 5/5 perfect', () => {
    expect(clearThreshold(5)).toBe(3)
    expect(tierFor({ score: 0, total: 5 })).toBe('empty')
    expect(tierFor({ score: 2, total: 5 })).toBe('partial')
    expect(tierFor({ score: 3, total: 5 })).toBe('cleared')
    expect(tierFor({ score: 4, total: 5 })).toBe('strong')
    expect(tierFor({ score: 5, total: 5 })).toBe('perfect')
  })
  it('scales with fewer categories', () => {
    expect(tierFor({ score: 2, total: 3 })).toBe('cleared')
    expect(tierFor({ score: 3, total: 3 })).toBe('perfect')
    expect(tierFor({ score: 1, total: 1 })).toBe('perfect')
  })
})
