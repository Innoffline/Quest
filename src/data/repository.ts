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

/**
 * Storage boundary. UI and services only talk to this interface.
 * Two implementations: Supabase (default when configured) and Local (browser storage).
 * IDs are generated client-side (UUID), so every save is an upsert by id.
 * Date ranges are inclusive.
 */
export interface QuestRepository {
  readonly kind: 'supabase' | 'local'

  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<void>

  listCategories(): Promise<Category[]>
  saveCategory(c: Category): Promise<void>
  saveCategories(cs: Category[]): Promise<void>

  listTags(): Promise<Tag[]>
  saveTags(tags: Tag[]): Promise<void>
  deleteTag(id: string): Promise<void>

  listBlocks(from: ISODate, to: ISODate): Promise<TimeBlock[]>
  getActiveBlock(): Promise<TimeBlock | null>
  saveBlock(b: TimeBlock): Promise<void>
  saveBlocks(bs: TimeBlock[]): Promise<void>
  deleteBlock(id: string): Promise<void>

  listCompletions(from: ISODate, to: ISODate): Promise<DailyCompletion[]>
  saveCompletion(c: DailyCompletion): Promise<void>
  deleteCompletion(id: string): Promise<void>
  lastActiveDate(before: ISODate): Promise<ISODate | null>

  listXpEvents(from: ISODate, to: ISODate): Promise<XPEvent[]>
  addXpEvents(events: XPEvent[]): Promise<void>
  /** Correction only (user clears an entry recorded by mistake). Never used as a penalty. */
  deleteXpEventsForSource(sourceId: string): Promise<void>
  totalXp(): Promise<number>

  listDeviations(from: ISODate, to: ISODate): Promise<DeviationLog[]>
  saveDeviation(d: DeviationLog): Promise<void>
  deleteDeviation(id: string): Promise<void>

  listDayNotes(from: ISODate, to: ISODate): Promise<DayNote[]>
  saveDayNote(n: DayNote): Promise<void>

  getWeeklyReview(weekStart: ISODate): Promise<WeeklyReview | null>
  saveWeeklyReview(r: WeeklyReview): Promise<void>

  listMetrics(from: ISODate, to: ISODate): Promise<OutcomeMetric[]>
  saveMetric(m: OutcomeMetric): Promise<void>
  deleteMetric(id: string): Promise<void>

  exportAll(): Promise<Record<string, unknown>>
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0
        return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })
