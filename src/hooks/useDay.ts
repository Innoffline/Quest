import type { DailyCompletion, DeviationLog, ISODate, TimeBlock, XPEvent } from '../types'
import { useApp } from '../state/AppContext'
import { useQuery } from './useQuery'

export interface DayData {
  blocks: TimeBlock[]
  completions: DailyCompletion[]
  deviations: DeviationLog[]
  xpEvents: XPEvent[]
  note: string
}

export function useDay(date: ISODate) {
  const { repo } = useApp()
  return useQuery<DayData>(async () => {
    const [blocks, completions, deviations, xpEvents, notes] = await Promise.all([
      repo.listBlocks(date, date),
      repo.listCompletions(date, date),
      repo.listDeviations(date, date),
      repo.listXpEvents(date, date),
      repo.listDayNotes(date, date),
    ])
    return { blocks, completions, deviations, xpEvents, note: notes[0]?.note ?? '' }
  }, [date])
}

/** Short neutral description of a deviation: "Fried chicken · Very hungry". */
export function deviationLine(d: DeviationLog): string {
  return [d.item_label, d.trigger, d.context].filter(Boolean).join(' · ') || d.note || 'Logged'
}
