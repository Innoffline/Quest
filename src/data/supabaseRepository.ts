import type { SupabaseClient } from '@supabase/supabase-js'
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

/**
 * Supabase implementation. Every table has `user_id default auth.uid()` and RLS
 * policies restricting rows to their owner, so the client never sends user_id.
 */

type Result<T> = { data: T | null; error: { message: string } | null }

function unwrap<T>(res: Result<T>, fallback: T): T {
  if (res.error) throw new Error(res.error.message)
  return res.data ?? fallback
}
function check(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message)
}

const hhmm = (t: string) => t.slice(0, 5)
const normBlock = (b: TimeBlock): TimeBlock => ({ ...b, start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) })

/** Remove server-owned columns before writing. */
function strip<T extends object>(row: T): T {
  const { user_id: _u, ...rest } = row as T & { user_id?: string }
  void _u
  return rest as T
}

export class SupabaseRepository implements QuestRepository {
  readonly kind = 'supabase' as const
  private readonly db: SupabaseClient

  constructor(client: SupabaseClient) {
    this.db = client
  }

  async getSettings(): Promise<Settings> {
    const res = await this.db.from('user_settings').select('*').maybeSingle()
    const row = unwrap<Partial<Settings> | null>(res, null)
    return { ...DEFAULT_SETTINGS, ...(row ?? {}) }
  }
  async saveSettings(s: Settings) {
    const payload: Settings = {
      week_start: s.week_start,
      level_base_xp: s.level_base_xp,
      level_step_xp: s.level_step_xp,
      schedule_bonus_xp: s.schedule_bonus_xp,
      theme: s.theme,
      reduce_motion: s.reduce_motion,
      weight_unit: s.weight_unit,
    }
    check(await this.db.from('user_settings').upsert(payload, { onConflict: 'user_id' }))
  }

  async listCategories() {
    return unwrap<Category[]>(await this.db.from('categories').select('*').order('sort_order'), [])
  }
  async saveCategory(c: Category) {
    check(await this.db.from('categories').upsert(strip(c)))
  }
  async saveCategories(cs: Category[]) {
    if (cs.length) check(await this.db.from('categories').upsert(cs.map(strip)))
  }

  async listTags() {
    return unwrap<Tag[]>(await this.db.from('tags').select('*').order('sort_order'), [])
  }
  async saveTags(tags: Tag[]) {
    if (tags.length) check(await this.db.from('tags').upsert(tags.map(strip)))
  }
  async deleteTag(id: string) {
    check(await this.db.from('tags').delete().eq('id', id))
  }

  async listBlocks(from: ISODate, to: ISODate) {
    const rows = unwrap<TimeBlock[]>(
      await this.db.from('time_blocks').select('*').gte('date', from).lte('date', to).order('date').order('start_time'),
      [],
    )
    return rows.map(normBlock)
  }
  async getActiveBlock() {
    const row = unwrap<TimeBlock | null>(
      await this.db.from('time_blocks').select('*').eq('status', 'active').limit(1).maybeSingle(),
      null,
    )
    return row ? normBlock(row) : null
  }
  async saveBlock(b: TimeBlock) {
    check(await this.db.from('time_blocks').upsert(strip(b)))
  }
  async saveBlocks(bs: TimeBlock[]) {
    if (bs.length) check(await this.db.from('time_blocks').upsert(bs.map(strip)))
  }
  async deleteBlock(id: string) {
    check(await this.db.from('time_blocks').delete().eq('id', id))
  }

  async listCompletions(from: ISODate, to: ISODate) {
    return unwrap<DailyCompletion[]>(
      await this.db.from('daily_completions').select('*').gte('date', from).lte('date', to),
      [],
    )
  }
  async saveCompletion(c: DailyCompletion) {
    check(await this.db.from('daily_completions').upsert(strip(c), { onConflict: 'user_id,date,category_id' }))
  }
  async deleteCompletion(id: string) {
    check(await this.db.from('daily_completions').delete().eq('id', id))
  }
  async lastActiveDate(before: ISODate) {
    const row = unwrap<{ date: ISODate } | null>(
      await this.db
        .from('daily_completions')
        .select('date')
        .lt('date', before)
        .in('completion_type', ['normal', 'minimum'])
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      null,
    )
    return row?.date ?? null
  }

  async listXpEvents(from: ISODate, to: ISODate) {
    return unwrap<XPEvent[]>(await this.db.from('xp_events').select('*').gte('date', from).lte('date', to), [])
  }
  async addXpEvents(events: XPEvent[]) {
    if (events.length) check(await this.db.from('xp_events').insert(events.map(strip)))
  }
  async deleteXpEventsForSource(sourceId: string) {
    check(await this.db.from('xp_events').delete().eq('source_id', sourceId))
  }
  async totalXp() {
    // `user_xp_totals` is a security_invoker view: RLS on xp_events still applies.
    const row = unwrap<{ total_xp: number } | null>(
      await this.db.from('user_xp_totals').select('total_xp').maybeSingle(),
      null,
    )
    return Number(row?.total_xp ?? 0)
  }

  async listDeviations(from: ISODate, to: ISODate) {
    return unwrap<DeviationLog[]>(
      await this.db.from('deviation_logs').select('*').gte('date', from).lte('date', to).order('created_at'),
      [],
    )
  }
  async saveDeviation(d: DeviationLog) {
    check(await this.db.from('deviation_logs').upsert(strip(d)))
  }
  async deleteDeviation(id: string) {
    check(await this.db.from('deviation_logs').delete().eq('id', id))
  }

  async listDayNotes(from: ISODate, to: ISODate) {
    return unwrap<DayNote[]>(await this.db.from('daily_plans').select('date, note').gte('date', from).lte('date', to), [])
  }
  async saveDayNote(n: DayNote) {
    check(await this.db.from('daily_plans').upsert({ date: n.date, note: n.note }, { onConflict: 'user_id,date' }))
  }

  async getWeeklyReview(weekStart: ISODate) {
    return unwrap<WeeklyReview | null>(
      await this.db
        .from('weekly_reviews')
        .select('week_start, what_worked, next_adjustment')
        .eq('week_start', weekStart)
        .maybeSingle(),
      null,
    )
  }
  async saveWeeklyReview(r: WeeklyReview) {
    check(await this.db.from('weekly_reviews').upsert(r, { onConflict: 'user_id,week_start' }))
  }

  async listMetrics(from: ISODate, to: ISODate) {
    return unwrap<OutcomeMetric[]>(
      await this.db.from('outcome_metrics').select('*').gte('date', from).lte('date', to),
      [],
    )
  }
  async saveMetric(m: OutcomeMetric) {
    check(await this.db.from('outcome_metrics').upsert(strip(m), { onConflict: 'user_id,date,metric_type' }))
  }
  async deleteMetric(id: string) {
    check(await this.db.from('outcome_metrics').delete().eq('id', id))
  }

  async exportAll() {
    const tables = [
      'user_settings',
      'categories',
      'tags',
      'daily_plans',
      'time_blocks',
      'daily_completions',
      'xp_events',
      'deviation_logs',
      'weekly_reviews',
      'outcome_metrics',
    ]
    const out: Record<string, unknown> = { exported_at: new Date().toISOString() }
    for (const t of tables) out[t] = unwrap<unknown[]>(await this.db.from(t).select('*'), [])
    return out
  }
}
