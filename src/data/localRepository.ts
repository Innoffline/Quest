import { DEFAULT_SETTINGS } from '../types'
import type {
  Category,
  DailyCompletion,
  DayNote,
  DeviationLog,
  ISODate,
  OutcomeMetric,
  Settings,
  Tag,
  TimeBlock,
  WeeklyReview,
  XPEvent,
} from '../types'
import type { QuestRepository } from './repository'

interface LocalDB {
  version: 1
  settings: Settings
  categories: Category[]
  tags: Tag[]
  blocks: TimeBlock[]
  completions: DailyCompletion[]
  xp: XPEvent[]
  deviations: DeviationLog[]
  notes: DayNote[]
  reviews: WeeklyReview[]
  metrics: OutcomeMetric[]
}

const empty = (): LocalDB => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS },
  categories: [],
  tags: [],
  blocks: [],
  completions: [],
  xp: [],
  deviations: [],
  notes: [],
  reviews: [],
  metrics: [],
})

/** Minimal key-value surface so tests can pass an in-memory store. */
export interface KVStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function memoryStore(): KVStore {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

const inRange = (d: ISODate, from: ISODate, to: ISODate) => d >= from && d <= to

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const next = list.slice()
  next[i] = item
  return next
}

/** Local Mode: everything lives in one JSON document in browser storage. Private to this device. */
export class LocalRepository implements QuestRepository {
  readonly kind = 'local' as const
  private cache: LocalDB | null = null
  private readonly store: KVStore
  private readonly key: string

  constructor(store?: KVStore, key = 'quest:v1') {
    this.store = store ?? (typeof localStorage !== 'undefined' ? localStorage : memoryStore())
    this.key = key
  }

  private read(): LocalDB {
    if (this.cache) return this.cache
    try {
      const raw = this.store.getItem(this.key)
      this.cache = raw ? { ...empty(), ...(JSON.parse(raw) as Partial<LocalDB>) } : empty()
    } catch {
      this.cache = empty()
    }
    this.cache.settings = { ...DEFAULT_SETTINGS, ...this.cache.settings }
    return this.cache
  }

  private write(mut: (db: LocalDB) => LocalDB): void {
    const next = mut(this.read())
    this.cache = next
    try {
      this.store.setItem(this.key, JSON.stringify(next))
    } catch (e) {
      console.error('Quest: could not persist local data', e)
      throw new Error('Could not save on this device (storage full or blocked).')
    }
  }

  async getSettings() {
    return this.read().settings
  }
  async saveSettings(s: Settings) {
    this.write((db) => ({ ...db, settings: s }))
  }

  async listCategories() {
    return [...this.read().categories].sort((a, b) => a.sort_order - b.sort_order)
  }
  async saveCategory(c: Category) {
    this.write((db) => ({ ...db, categories: upsert(db.categories, c) }))
  }
  async saveCategories(cs: Category[]) {
    this.write((db) => ({ ...db, categories: cs.reduce(upsert, db.categories) }))
  }

  async listTags() {
    return [...this.read().tags].sort((a, b) => a.sort_order - b.sort_order)
  }
  async saveTags(tags: Tag[]) {
    this.write((db) => ({ ...db, tags: tags.reduce(upsert, db.tags) }))
  }
  async deleteTag(id: string) {
    this.write((db) => ({ ...db, tags: db.tags.filter((t) => t.id !== id) }))
  }

  async listBlocks(from: ISODate, to: ISODate) {
    return this.read()
      .blocks.filter((b) => inRange(b.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
  }
  async getActiveBlock() {
    return this.read().blocks.find((b) => b.status === 'active') ?? null
  }
  async saveBlock(b: TimeBlock) {
    this.write((db) => ({ ...db, blocks: upsert(db.blocks, b) }))
  }
  async saveBlocks(bs: TimeBlock[]) {
    this.write((db) => ({ ...db, blocks: bs.reduce(upsert, db.blocks) }))
  }
  async deleteBlock(id: string) {
    this.write((db) => ({ ...db, blocks: db.blocks.filter((b) => b.id !== id) }))
  }

  async listCompletions(from: ISODate, to: ISODate) {
    return this.read().completions.filter((c) => inRange(c.date, from, to))
  }
  async saveCompletion(c: DailyCompletion) {
    this.write((db) => ({
      ...db,
      // one row per (date, category) — mirrors the DB unique constraint
      completions: upsert(
        db.completions.filter((x) => x.id === c.id || !(x.date === c.date && x.category_id === c.category_id)),
        c,
      ),
    }))
  }
  async deleteCompletion(id: string) {
    this.write((db) => ({ ...db, completions: db.completions.filter((c) => c.id !== id) }))
  }
  async lastActiveDate(before: ISODate) {
    const dates = this.read()
      .completions.filter((c) => c.date < before && (c.completion_type === 'normal' || c.completion_type === 'minimum'))
      .map((c) => c.date)
      .sort()
    return dates.at(-1) ?? null
  }

  async listXpEvents(from: ISODate, to: ISODate) {
    return this.read().xp.filter((e) => inRange(e.date, from, to))
  }
  async addXpEvents(events: XPEvent[]) {
    this.write((db) => ({ ...db, xp: [...db.xp, ...events] }))
  }
  async deleteXpEventsForSource(sourceId: string) {
    this.write((db) => ({ ...db, xp: db.xp.filter((e) => e.source_id !== sourceId) }))
  }
  async totalXp() {
    return this.read().xp.reduce((a, e) => a + e.amount, 0)
  }

  async listDeviations(from: ISODate, to: ISODate) {
    return this.read()
      .deviations.filter((d) => inRange(d.date, from, to))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async saveDeviation(d: DeviationLog) {
    this.write((db) => ({ ...db, deviations: upsert(db.deviations, d) }))
  }
  async deleteDeviation(id: string) {
    this.write((db) => ({ ...db, deviations: db.deviations.filter((d) => d.id !== id) }))
  }

  async listDayNotes(from: ISODate, to: ISODate) {
    return this.read().notes.filter((n) => inRange(n.date, from, to))
  }
  async saveDayNote(n: DayNote) {
    this.write((db) => ({ ...db, notes: [...db.notes.filter((x) => x.date !== n.date), n] }))
  }

  async getWeeklyReview(weekStart: ISODate) {
    return this.read().reviews.find((r) => r.week_start === weekStart) ?? null
  }
  async saveWeeklyReview(r: WeeklyReview) {
    this.write((db) => ({ ...db, reviews: [...db.reviews.filter((x) => x.week_start !== r.week_start), r] }))
  }

  async listMetrics(from: ISODate, to: ISODate) {
    return this.read().metrics.filter((m) => inRange(m.date, from, to))
  }
  async saveMetric(m: OutcomeMetric) {
    this.write((db) => ({
      ...db,
      metrics: upsert(
        db.metrics.filter((x) => x.id === m.id || !(x.date === m.date && x.metric_type === m.metric_type)),
        m,
      ),
    }))
  }
  async deleteMetric(id: string) {
    this.write((db) => ({ ...db, metrics: db.metrics.filter((m) => m.id !== id) }))
  }

  async exportAll() {
    return { ...this.read(), exported_at: new Date().toISOString() }
  }
}
