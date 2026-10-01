import { buildSeedTags, DEFAULT_CATEGORIES } from '../lib/defaults'
import { addDays, durationMinutes } from '../lib/dates'
import { levelFromXp, type LevelInfo } from '../lib/levels'
import { dailyScore, type DayScore } from '../lib/scoring'
import { elapsedSeconds, isOnSchedule, isReturning, xpDelta, xpForCompletion } from '../lib/xp'
import type {
  Category,
  CompletionType,
  DailyCompletion,
  DeviationLog,
  ISODate,
  QuestMode,
  Settings,
  Tag,
  TimeBlock,
  XPEvent,
} from '../types'
import { newId, type QuestRepository } from './repository'

/** Business operations. Pure orchestration over the repository — no UI here. */

const seeding = new WeakMap<QuestRepository, Promise<void>>()

/**
 * Seed default categories + tags on first run. Concurrent calls share one promise,
 * so React StrictMode's double effect (dev) can't seed twice.
 */
export function ensureSeeded(repo: QuestRepository): Promise<void> {
  let p = seeding.get(repo)
  if (!p) {
    p = seed(repo).catch((e: unknown) => {
      seeding.delete(repo)
      throw e
    })
    seeding.set(repo, p)
  }
  return p
}

async function seed(repo: QuestRepository): Promise<void> {
  const existing = await repo.listCategories()
  if (existing.length) return
  const now = new Date().toISOString()
  const idByKey: Record<string, string> = {}
  const cats: Category[] = DEFAULT_CATEGORIES.map(({ key, ...c }) => {
    const id = newId()
    idByKey[key] = id
    return { ...c, id, created_at: now }
  })
  await repo.saveCategories(cats)
  const tags: Tag[] = buildSeedTags(idByKey).map((t) => ({ ...t, id: newId() }))
  await repo.saveTags(tags)
}

export interface QuestResult {
  category: Category
  type: CompletionType
  title: string
  minutes: number | null
  xpGained: number
  bonusXp: number
  before: DayScore
  after: DayScore
  levelBefore: LevelInfo
  levelAfter: LevelInfo
  welcomeBack: boolean
}

const RANK: Record<CompletionType, number> = { incomplete: 0, partial: 1, minimum: 2, normal: 3 }

interface RecordArgs {
  date: ISODate
  category: Category
  categories: Category[]
  settings: Settings
  type: CompletionType
  /** Block completions never downgrade an existing better result; manual edits can. */
  allowDowngrade: boolean
  title?: string
  minutes?: number | null
  extraXp?: XPEvent[]
}

export async function recordCategory(repo: QuestRepository, args: RecordArgs): Promise<QuestResult> {
  const { date, category, categories, settings } = args
  const curve = { base: settings.level_base_xp, step: settings.level_step_xp }
  const [completions, totalBefore, lastActive] = await Promise.all([
    repo.listCompletions(date, date),
    repo.totalXp(),
    repo.lastActiveDate(date),
  ])
  const existing = completions.find((c) => c.category_id === category.id)
  const before = dailyScore(date, completions, categories)

  let type = args.type
  if (!args.allowDowngrade && existing && RANK[existing.completion_type] > RANK[type]) type = existing.completion_type

  const delta = xpDelta(existing, category, type)
  const now = new Date().toISOString()
  const completion: DailyCompletion = {
    id: existing?.id ?? newId(),
    date,
    category_id: category.id,
    completion_type: type,
    completed_at: now,
    xp_awarded: Math.max(existing?.xp_awarded ?? 0, xpForCompletion(category, type)),
  }
  await repo.saveCompletion(completion)

  const events: XPEvent[] = [...(args.extraXp ?? [])]
  if (delta > 0) {
    events.push({
      id: newId(),
      date,
      occurred_at: now,
      amount: delta,
      source_type: 'category',
      source_id: completion.id,
      description: `${category.name} — ${type === 'normal' ? 'Quest' : 'Minimum Quest'}`,
    })
  }
  await repo.addXpEvents(events)

  const nextCompletions = [...completions.filter((c) => c.id !== completion.id), completion]
  const bonusXp = (args.extraXp ?? []).reduce((a, e) => a + e.amount, 0)
  const gained = delta + bonusXp
  const pointNow = type === 'normal' || type === 'minimum'
  return {
    category,
    type,
    title: args.title ?? category.name,
    minutes: args.minutes ?? null,
    xpGained: delta,
    bonusXp,
    before,
    after: dailyScore(date, nextCompletions, categories),
    levelBefore: levelFromXp(totalBefore, curve),
    levelAfter: levelFromXp(totalBefore + gained, curve),
    welcomeBack: pointNow && !existing && before.score === 0 && isReturning(lastActive, date),
  }
}

/** Remove a mis-recorded entry. This is a correction tool, not a penalty. */
export async function clearCategory(repo: QuestRepository, completion: DailyCompletion): Promise<void> {
  await repo.deleteXpEventsForSource(completion.id)
  await repo.deleteCompletion(completion.id)
}

// --------------------------------------------------------------------------- blocks

export function makeBlock(args: {
  date: ISODate
  category: Category
  start: string
  end: string
  title?: string
  mode?: QuestMode
}): TimeBlock {
  const now = new Date().toISOString()
  return {
    id: newId(),
    date: args.date,
    category_id: args.category.id,
    title: args.title?.trim() || args.category.name,
    start_time: args.start,
    end_time: args.end,
    planned_minutes: durationMinutes(args.start, args.end),
    actual_minutes: null,
    mode: args.mode ?? 'normal',
    status: 'planned',
    notes: '',
    started_at: null,
    paused_at: null,
    paused_seconds: 0,
    completed_at: null,
    created_at: now,
    updated_at: now,
  }
}

const touch = (b: TimeBlock, patch: Partial<TimeBlock>): TimeBlock => ({ ...b, ...patch, updated_at: new Date().toISOString() })

export class ActiveQuestConflict extends Error {
  readonly active: TimeBlock
  constructor(active: TimeBlock) {
    super('Another quest is already active.')
    this.active = active
  }
}

export async function startBlock(repo: QuestRepository, block: TimeBlock, now = new Date()): Promise<TimeBlock> {
  const active = await repo.getActiveBlock()
  if (active && active.id !== block.id) throw new ActiveQuestConflict(active)
  const next = touch(block, { status: 'active', started_at: now.toISOString(), paused_at: null, paused_seconds: 0 })
  await repo.saveBlock(next)
  return next
}

export async function pauseBlock(repo: QuestRepository, block: TimeBlock, now = new Date()) {
  if (block.paused_at) return block
  const next = touch(block, { paused_at: now.toISOString() })
  await repo.saveBlock(next)
  return next
}

export async function resumeBlock(repo: QuestRepository, block: TimeBlock, now = new Date()) {
  if (!block.paused_at) return block
  const pausedFor = (now.getTime() - new Date(block.paused_at).getTime()) / 1000
  const next = touch(block, { paused_at: null, paused_seconds: Math.round(block.paused_seconds + Math.max(0, pausedFor)) })
  await repo.saveBlock(next)
  return next
}

export async function cancelBlock(repo: QuestRepository, block: TimeBlock) {
  const next = touch(block, { status: 'planned', started_at: null, paused_at: null, paused_seconds: 0 })
  await repo.saveBlock(next)
  return next
}

export async function skipBlock(repo: QuestRepository, block: TimeBlock) {
  const next = touch(block, { status: 'skipped', started_at: null, paused_at: null })
  await repo.saveBlock(next)
  return next
}

export async function reopenBlock(repo: QuestRepository, block: TimeBlock) {
  return cancelBlock(repo, { ...block, actual_minutes: null, completed_at: null })
}

/**
 * Finish a block. outcome: 'normal' = full quest, 'minimum' = reduced scope (still cleared),
 * 'partial' = progress logged without clearing the category.
 * `manualMinutes` lets the user complete a block they did without the timer.
 */
export async function completeBlock(
  repo: QuestRepository,
  args: {
    block: TimeBlock
    outcome: CompletionType
    category: Category
    categories: Category[]
    settings: Settings
    now?: Date
    manualMinutes?: number
  },
): Promise<QuestResult> {
  const now = args.now ?? new Date()
  const { block } = args
  const timed = block.started_at ? Math.max(1, Math.round(elapsedSeconds(block, now) / 60)) : null
  const minutes = args.manualMinutes ?? timed ?? block.planned_minutes
  const finished = touch(block, {
    status: args.outcome === 'partial' ? 'partial' : 'completed',
    actual_minutes: minutes,
    completed_at: now.toISOString(),
    paused_at: null,
  })
  await repo.saveBlock(finished)

  const extraXp: XPEvent[] = []
  const cleared = args.outcome === 'normal' || args.outcome === 'minimum'
  if (cleared && block.started_at && args.settings.schedule_bonus_xp > 0 && isOnSchedule(block, new Date(block.started_at), now)) {
    extraXp.push({
      id: newId(),
      date: block.date,
      occurred_at: now.toISOString(),
      amount: args.settings.schedule_bonus_xp,
      source_type: 'schedule_bonus',
      source_id: block.id,
      description: `On schedule — ${block.title}`,
    })
  }

  return recordCategory(repo, {
    date: block.date,
    category: args.category,
    categories: args.categories,
    settings: args.settings,
    type: args.outcome,
    allowDowngrade: false,
    title: block.title,
    minutes,
    extraXp,
  })
}

export async function copyPlan(repo: QuestRepository, from: ISODate, to: ISODate): Promise<number> {
  const src = await repo.listBlocks(from, from)
  const now = new Date().toISOString()
  const copies = src.map<TimeBlock>((b) => ({
    ...b,
    id: newId(),
    date: to,
    status: 'planned',
    actual_minutes: null,
    started_at: null,
    paused_at: null,
    paused_seconds: 0,
    completed_at: null,
    created_at: now,
    updated_at: now,
  }))
  await repo.saveBlocks(copies)
  return copies.length
}

export const yesterday = (d: ISODate) => addDays(d, -1)

// --------------------------------------------------------------------------- deviations

export async function logDeviation(
  repo: QuestRepository,
  args: {
    date: ISODate
    category: Category
    categories: Category[]
    settings: Settings
    blockId?: string | null
    item_label?: string | null
    trigger?: string | null
    context?: string | null
    note?: string
    /** Nutrition "Partial / Off-plan": mark the category partial. */
    markPartial: boolean
  },
): Promise<DeviationLog> {
  const log: DeviationLog = {
    id: newId(),
    date: args.date,
    category_id: args.category.id,
    time_block_id: args.blockId ?? null,
    item_label: args.item_label?.trim() || null,
    trigger: args.trigger?.trim() || null,
    context: args.context?.trim() || null,
    note: args.note?.trim() ?? '',
    created_at: new Date().toISOString(),
  }
  await repo.saveDeviation(log)

  const completions = await repo.listCompletions(args.date, args.date)
  const existing = completions.find((c) => c.category_id === args.category.id)
  if (args.markPartial) {
    await recordCategory(repo, { ...args, type: 'partial', allowDowngrade: true })
  } else if (!existing) {
    await recordCategory(repo, { ...args, type: 'incomplete', allowDowngrade: true })
  }
  return log
}
