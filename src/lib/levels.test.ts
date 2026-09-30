import { describe, expect, it } from 'vitest'
import { levelFromXp, xpToAdvance } from './levels'

const curve = { base: 100, step: 20 }

describe('levels', () => {
  it('uses 100, 120, 140… thresholds', () => {
    expect(xpToAdvance(1, curve)).toBe(100)
    expect(xpToAdvance(2, curve)).toBe(120)
    expect(xpToAdvance(3, curve)).toBe(140)
  })
  it('computes level and progress', () => {
    expect(levelFromXp(0, curve)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNext: 100 })
    expect(levelFromXp(99, curve).level).toBe(1)
    expect(levelFromXp(100, curve)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNext: 120 })
    expect(levelFromXp(230, curve)).toMatchObject({ level: 3, xpIntoLevel: 10, xpForNext: 140 })
  })
  it('never goes below level 1', () => {
    expect(levelFromXp(-50, curve).level).toBe(1)
  })
})
