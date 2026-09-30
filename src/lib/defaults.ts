import type { Category, New, Tag, TagKind } from '../types'

type SeedCategory = Omit<New<Category>, 'id'> & { key: string }

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  {
    key: 'nutrition',
    name: 'Nutrition',
    icon: '🥗',
    description: 'Follow the planned eating structure; skip unplanned eating.',
    normal_target: 'Ate according to plan',
    minimum_target: 'Make the next meal match the plan',
    normal_xp: 20,
    minimum_xp: 10,
    default_minutes: 30,
    log_style: 'food',
    active: true,
    sort_order: 0,
  },
  {
    key: 'exercise',
    name: 'Exercise',
    icon: '🏃',
    description: "Complete today's planned movement.",
    normal_target: 'Planned workout',
    minimum_target: '15-minute walk',
    normal_xp: 20,
    minimum_xp: 10,
    default_minutes: 60,
    log_style: 'reason',
    active: true,
    sort_order: 1,
  },
  {
    key: 'job',
    name: 'Job Search',
    icon: '💼',
    description: 'Applications, outreach, networking, interview prep.',
    normal_target: '60 min focused career work',
    minimum_target: '15 min',
    normal_xp: 20,
    minimum_xp: 10,
    default_minutes: 60,
    log_style: 'reason',
    active: true,
    sort_order: 2,
  },
  {
    key: 'skills',
    name: 'Skills',
    icon: '💻',
    description: 'Deliberate technical practice: SQL, LeetCode, ML, projects.',
    normal_target: '60 min deliberate practice',
    minimum_target: '1 SQL or LeetCode problem',
    normal_xp: 20,
    minimum_xp: 10,
    default_minutes: 60,
    log_style: 'reason',
    active: true,
    sort_order: 3,
  },
  {
    key: 'school',
    name: 'School',
    icon: '📚',
    description: 'The most important academic task of the day.',
    normal_target: 'Complete primary study task',
    minimum_target: '10 min or one tiny concrete task',
    normal_xp: 20,
    minimum_xp: 10,
    default_minutes: 60,
    log_style: 'reason',
    active: true,
    sort_order: 4,
  },
]

export const DEFAULT_TAGS: Record<Exclude<TagKind, 'reason'>, string[]> = {
  food: ['Fried chicken', 'Dessert', 'Milk tea', 'Chips', 'Fast food', 'Late-night snack', 'Extra meal', 'Sugary drink'],
  trigger: ['Very hungry', 'Stress', 'Boredom', 'Craving', 'Social eating', 'Convenience', 'No meal prepared', 'Tired', 'Celebration'],
  context: ['Delivery', 'Restaurant', 'Home', 'School', 'Work', 'Social event', 'Late night', 'Travel'],
}

/** Reason tags per default category key. */
export const DEFAULT_REASONS: Record<string, string[]> = {
  job: ['Low energy', 'Class workload', 'Procrastination', 'Unclear next task', 'Application fatigue', 'Distracted by phone', 'Underestimated duration'],
  skills: ['Task too difficult', 'No clear exercise selected', 'Too tired', 'Work took longer than expected', 'Distracted by phone'],
  exercise: ['Tired', 'Schedule conflict', 'Injury', 'Poor sleep', 'Forgot equipment', 'Social plans'],
  school: ['Underestimated assignment', 'Unclear material', 'Other deadline', 'Procrastination', 'Low energy'],
}

/** Generic reasons for any category without a specific list (e.g. user-created categories). */
export const GENERIC_REASONS = ['Low energy', 'Schedule conflict', 'Unclear next step', 'Underestimated duration', 'Distracted']

export function buildSeedTags(categoryIdByKey: Record<string, string>): New<Tag>[] {
  const tags: New<Tag>[] = []
  for (const kind of ['food', 'trigger', 'context'] as const) {
    DEFAULT_TAGS[kind].forEach((label, i) => tags.push({ kind, label, category_id: null, sort_order: i }))
  }
  for (const [key, labels] of Object.entries(DEFAULT_REASONS)) {
    const category_id = categoryIdByKey[key]
    if (!category_id) continue
    labels.forEach((label, i) => tags.push({ kind: 'reason', label, category_id, sort_order: i }))
  }
  return tags
}
