import type { ISODate } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local-time YYYY-MM-DD (never UTC — a 11pm quest belongs to today). */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = (): ISODate => toISODate(new Date())

export function addDays(date: ISODate, n: number): ISODate {
  const d = parseISODate(date)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/** First day of the week containing `date`. weekStart: 0 = Sunday, 1 = Monday. */
export function startOfWeek(date: ISODate, weekStart: 0 | 1): ISODate {
  const d = parseISODate(date)
  const diff = (d.getDay() - weekStart + 7) % 7
  return addDays(date, -diff)
}

export function weekDates(start: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Calendar grid for a month: leading nulls for padding, then each date. */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): (ISODate | null)[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() - weekStart + 7) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (ISODate | null)[] = Array.from({ length: lead }, () => null)
  for (let i = 1; i <= days; i++) cells.push(toISODate(new Date(year, month, i)))
  return cells
}

/** 'HH:MM' → minutes after midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)))
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`
}

export function durationMinutes(start: string, end: string): number {
  const d = timeToMinutes(end) - timeToMinutes(start)
  return d > 0 ? d : 0
}

/** '16:00' → '4:00 PM' */
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${suffix}`
}

export function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function formatMinutes(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export const nowMinutes = (d = new Date()) => d.getHours() * 60 + d.getMinutes()

export function weekdayLong(date: ISODate) {
  return parseISODate(date).toLocaleDateString('en-US', { weekday: 'long' })
}
export function monthDay(date: ISODate) {
  return parseISODate(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
export function shortDay(date: ISODate) {
  return parseISODate(date).toLocaleDateString('en-US', { weekday: 'short' })
}
