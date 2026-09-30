import { useCallback, useState } from 'react'
import { useApp } from '../state/AppContext'

/** Wraps a mutation: tracks pending state, refreshes app data, surfaces errors as a toast. */
export function useAction() {
  const { refresh, notify } = useApp()
  const [pending, setPending] = useState(false)
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setPending(true)
      try {
        const r = await fn()
        await refresh()
        return r
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Something went wrong. Try again.')
        return undefined
      } finally {
        setPending(false)
      }
    },
    [refresh, notify],
  )
  return { run, pending }
}
