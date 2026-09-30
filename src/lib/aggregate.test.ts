import { describe, expect, it } from 'vitest'
import type { Category, DeviationLog } from '../types'
import { averageMetric, combos, countBy, summarizeWeek } from './aggregate'

const nutrition = { id: 'n', name: 'Nutrition', active: true, log_style: 'food' } as Category
const job = { id: 'j', name: 'Job Search', active: true, log_style: 'reason' } as Category
const dev = (item: string | null, trigger: string | null, context: string | null, date = '2026-09-29', category_id = 'n') =>
  ({ id: Math.random().toString(), date, category_id, item_label: item, trigger, context, note: '', time_block_id: null, created_at: '' }) as DeviationLog

describe('aggregation', () => {
  it('counts labels, skipping blanks', () => {
    expect(countBy(['A', 'B', 'A', null, ' '])).toEqual([{ label: 'A', count: 2 }, { label: 'B', count: 1 }])
  })
  it('finds observed combinations seen twice or more', () => {
    const logs = [dev('Fried chicken', 'Very hungry', 'Delivery'), dev('Fried chicken', 'Very hungry', 'Late night'), dev('Dessert', 'Stress', 'Home')]
    expect(combos(logs, 'trigger')).toEqual([{ from: 'Very hungry', to: 'Fried chicken', count: 2 }])
    expect(combos(logs, 'context')).toEqual([])
  })
  it('summarizes a week', () => {
    const s = summarizeWeek({
      start: '2026-09-28',
      categories: [nutrition, job],
      completions: [
        { id: '1', date: '2026-09-28', category_id: 'n', completion_type: 'normal', completed_at: '', xp_awarded: 20 },
        { id: '2', date: '2026-09-28', category_id: 'j', completion_type: 'minimum', completed_at: '', xp_awarded: 10 },
        { id: '3', date: '2026-09-29', category_id: 'n', completion_type: 'partial', completed_at: '', xp_awarded: 0 },
        { id: '4', date: '2026-10-09', category_id: 'j', completion_type: 'normal', completed_at: '', xp_awarded: 20 },
      ],
      blocks: [],
      xpEvents: [{ id: 'x', date: '2026-09-28', occurred_at: '', amount: 30, source_type: 'category', source_id: '1', description: '' }],
      deviations: [dev('Fried chicken', 'Very hungry', 'Delivery'), dev(null, 'Low energy', null, '2026-09-30', 'j')],
    })
    expect(s.clears).toBe(1) // 2/2 on Monday
    expect(s.days[0].tier).toBe('perfect')
    expect(s.days[1].tier).toBe('empty')
    expect(s.normalCount).toBe(1)
    expect(s.minimumCount).toBe(1)
    expect(s.xp).toBe(30)
    expect(s.deviations.total).toBe(2)
    expect(s.deviations.foods).toEqual([{ label: 'Fried chicken', count: 1 }])
    expect(s.deviations.byCategory.find((b) => b.category.id === 'j')?.top[0].label).toBe('Low energy')
  })
  it('averages metrics in range', () => {
    const m = [70, 71, 72].map((v, i) => ({ id: String(i), date: ["2026-09-28", "2026-09-29", "2026-09-30"][i], metric_type: 'weight' as const, numeric_value: v, text_value: null }))
    expect(averageMetric(m, 'weight', '2026-09-28', '2026-09-30')).toBe(71)
    expect(averageMetric(m, 'weight', '2026-10-01', '2026-10-07')).toBeNull()
  })
})
