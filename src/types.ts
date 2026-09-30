/** Domain types. Field names mirror the Supabase columns (snake_case) so rows map 1:1. */

export type ISODate = string // 'YYYY-MM-DD' in the user's local time zone

/** How the "What happened?" sheet is structured for a category. */
export type LogStyle = 'food' | 'reason'

export interface Category {
  id: string
  name: string
  icon: string
  description: string
  normal_target: string
  minimum_target: string
  normal_xp: number
  minimum_xp: number
  default_minutes: number
  log_style: LogStyle
  active: boolean
  sort_order: number
  created_at: string
}

export type BlockStatus = 'planned' | 'active' | 'completed' | 'partial' | 'skipped'
export type QuestMode = 'normal' | 'minimum'

export interface TimeBlock {
  id: string
  date: ISODate
  category_id: string
  title: string
  start_time: string // 'HH:MM'
  end_time: string // 'HH:MM'
  planned_minutes: number
  actual_minutes: number | null
  mode: QuestMode
  status: BlockStatus
  notes: string
  started_at: string | null
  paused_at: string | null
  paused_seconds: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type CompletionType = 'normal' | 'minimum' | 'partial' | 'incomplete'

export interface DailyCompletion {
  id: string
  date: ISODate
  category_id: string
  completion_type: CompletionType
  completed_at: string
  xp_awarded: number
}

export type XPSource = 'category' | 'schedule_bonus'

export interface XPEvent {
  id: string
  date: ISODate
  occurred_at: string
  amount: number
  source_type: XPSource
  source_id: string
  description: string
}

export interface DeviationLog {
  id: string
  date: ISODate
  category_id: string
  time_block_id: string | null
  item_label: string | null // nutrition: the food / event
  trigger: string | null // nutrition: trigger · others: reason
  context: string | null
  note: string
  created_at: string
}

export type TagKind = 'food' | 'trigger' | 'context' | 'reason'

export interface Tag {
  id: string
  kind: TagKind
  label: string
  category_id: string | null // reasons can be scoped to a category
  sort_order: number
}

export interface DayNote {
  date: ISODate
  note: string
}

export interface WeeklyReview {
  week_start: ISODate
  what_worked: string
  next_adjustment: string
}

export type MetricType =
  | 'weight'
  | 'waist'
  | 'applications_sent'
  | 'recruiter_responses'
  | 'referrals'
  | 'interviews'
  | 'networking'
  | 'offers'
  | 'workouts'
  | 'active_minutes'
  | 'interview_stages'
  | 'health_note'

export interface OutcomeMetric {
  id: string
  date: ISODate
  metric_type: MetricType
  numeric_value: number | null
  text_value: string | null
}

export type Theme = 'dark' | 'light'

export interface Settings {
  week_start: 0 | 1 // 0 = Sunday, 1 = Monday
  level_base_xp: number
  level_step_xp: number
  schedule_bonus_xp: number
  theme: Theme
  reduce_motion: boolean
  weight_unit: 'kg' | 'lb'
}

export const DEFAULT_SETTINGS: Settings = {
  week_start: 1,
  level_base_xp: 100,
  level_step_xp: 20,
  schedule_bonus_xp: 5,
  theme: 'dark',
  reduce_motion: false,
  weight_unit: 'lb',
}

export type New<T extends { id: string }> = Omit<T, 'id' | 'created_at' | 'updated_at'> & { id?: string }
