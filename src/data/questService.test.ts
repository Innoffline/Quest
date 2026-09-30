import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../types'
import { LocalRepository, memoryStore } from './localRepository'
import { clearCategory, completeBlock, copyPlan, ensureSeeded, logDeviation, makeBlock, recordCategory, startBlock, ActiveQuestConflict } from './questService'

let repo: LocalRepository
const settings = DEFAULT_SETTINGS
const date = '2026-09-30'

beforeEach(async () => {
  repo = new LocalRepository(memoryStore())
  await ensureSeeded(repo)
})

describe('quest service', () => {
  it('seeds five categories and tags once', async () => {
    await ensureSeeded(repo)
    expect(await repo.listCategories()).toHaveLength(5)
    const tags = await repo.listTags()
    expect(tags.some((t) => t.kind === 'food' && t.label === 'Fried chicken')).toBe(true)
    expect(tags.some((t) => t.kind === 'reason')).toBe(true)
  })

  it('clears a day at 3/5 and never deducts EXP', async () => {
    const cats = await repo.listCategories()
    for (const c of cats.slice(0, 2)) await recordCategory(repo, { date, category: c, categories: cats, settings, type: 'normal', allowDowngrade: false })
    const r = await recordCategory(repo, { date, category: cats[2], categories: cats, settings, type: 'minimum', allowDowngrade: false })
    expect(r.before.score).toBe(2)
    expect(r.after.score).toBe(3)
    expect(r.xpGained).toBe(10)
    expect(await repo.totalXp()).toBe(50)
    // downgrade path via block: keeps the better result, no EXP change
    const again = await recordCategory(repo, { date, category: cats[0], categories: cats, settings, type: 'minimum', allowDowngrade: false })
    expect(again.type).toBe('normal')
    expect(await repo.totalXp()).toBe(50)
    // upgrade pays only the difference
    await recordCategory(repo, { date, category: cats[2], categories: cats, settings, type: 'normal', allowDowngrade: false })
    expect(await repo.totalXp()).toBe(60)
  })

  it('runs a timed block with schedule bonus', async () => {
    const cats = await repo.listCategories()
    const job = cats.find((c) => c.name === 'Job Search')!
    const block = makeBlock({ date, category: job, start: '16:00', end: '17:00' })
    await repo.saveBlock(block)
    const active = await startBlock(repo, block, new Date(2026, 8, 30, 16, 2))
    const other = makeBlock({ date, category: cats[0], start: '18:00', end: '19:00' })
    await expect(startBlock(repo, other)).rejects.toBeInstanceOf(ActiveQuestConflict)
    const r = await completeBlock(repo, { block: active, outcome: 'normal', category: job, categories: cats, settings, now: new Date(2026, 8, 30, 17, 1) })
    expect(r.minutes).toBe(59)
    expect(r.xpGained).toBe(20)
    expect(r.bonusXp).toBe(5)
    expect(await repo.getActiveBlock()).toBeNull()
  })

  it('logs a nutrition deviation as partial', async () => {
    const cats = await repo.listCategories()
    const n = cats.find((c) => c.log_style === 'food')!
    await logDeviation(repo, { date, category: n, categories: cats, settings, item_label: 'Fried chicken', trigger: 'Very hungry', context: 'Delivery', note: 'Skipped lunch', markPartial: true })
    const [c] = await repo.listCompletions(date, date)
    expect(c.completion_type).toBe('partial')
    expect(await repo.totalXp()).toBe(0)
    // recover with a minimum quest (next meal on plan)
    await recordCategory(repo, { date, category: n, categories: cats, settings, type: 'minimum', allowDowngrade: false })
    expect((await repo.listCompletions(date, date))[0].completion_type).toBe('minimum')
    expect(await repo.listDeviations(date, date)).toHaveLength(1)
  })

  it('clears a mistaken entry and its EXP', async () => {
    const cats = await repo.listCategories()
    await recordCategory(repo, { date, category: cats[0], categories: cats, settings, type: 'normal', allowDowngrade: false })
    const [c] = await repo.listCompletions(date, date)
    await clearCategory(repo, c)
    expect(await repo.listCompletions(date, date)).toHaveLength(0)
    expect(await repo.totalXp()).toBe(0)
  })

  it('copies a plan to another day', async () => {
    const cats = await repo.listCategories()
    await repo.saveBlock(makeBlock({ date: '2026-09-29', category: cats[1], start: '09:30', end: '10:20' }))
    expect(await copyPlan(repo, '2026-09-29', date)).toBe(1)
    const [b] = await repo.listBlocks(date, date)
    expect(b.status).toBe('planned')
    expect(b.planned_minutes).toBe(50)
  })

  it('welcomes back after a gap', async () => {
    const cats = await repo.listCategories()
    await recordCategory(repo, { date: '2026-09-25', category: cats[0], categories: cats, settings, type: 'normal', allowDowngrade: false })
    const r = await recordCategory(repo, { date, category: cats[1], categories: cats, settings, type: 'minimum', allowDowngrade: false })
    expect(r.welcomeBack).toBe(true)
  })
})
