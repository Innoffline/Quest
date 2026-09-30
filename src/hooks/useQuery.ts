import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'

export interface QueryState<T> {
  data: T | undefined
  loading: boolean
  error: string | null
}

/**
 * Tiny data hook: runs `fn` on mount, when `deps` change, and after any mutation
 * (the app-wide `version` counter). Keeps the previous data while refetching to avoid flicker.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const { version, repo } = useApp()
  const [state, setState] = useState<QueryState<T>>({ data: undefined, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    fn().then(
      (data) => !cancelled && setState({ data, loading: false, error: null }),
      (e: unknown) => !cancelled && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) })),
    )
    return () => {
      cancelled = true
    }
    // fn is intentionally excluded: callers pass the values it closes over in `deps`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [version, repo, ...deps])

  return state
}
