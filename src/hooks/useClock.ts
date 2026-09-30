import { useEffect, useState } from 'react'
import { todayISO } from '../lib/dates'

/** Re-renders every `ms`. Used for timers and "what's next". */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms)
    const onVis = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ms])
  return now
}

/** Today's date; rolls over at local midnight. */
export function useToday(): string {
  const now = useNow(30_000)
  const [today, setToday] = useState(todayISO)
  const current = todayISO()
  if (current !== today) setToday(current)
  void now
  return today
}
