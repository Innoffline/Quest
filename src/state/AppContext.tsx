import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LocalRepository } from '../data/localRepository'
import { ensureSeeded, type QuestResult } from '../data/questService'
import type { QuestRepository } from '../data/repository'
import { supabase, supabaseConfigured } from '../data/supabaseClient'
import { SupabaseRepository } from '../data/supabaseRepository'
import { levelFromXp, type LevelInfo } from '../lib/levels'
import type { Category, Settings, Tag } from '../types'
import { DEFAULT_SETTINGS } from '../types'

type AuthState = 'loading' | 'signed-out' | 'ready' | 'error'

interface AppState {
  auth: AuthState
  error: string | null
  email: string | null
  repo: QuestRepository
  settings: Settings
  categories: Category[]
  activeCategories: Category[]
  tags: Tag[]
  totalXp: number
  level: LevelInfo
  /** Increments after every mutation; data hooks refetch on change. */
  version: number
  refresh: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  result: QuestResult | null
  showResult: (r: QuestResult | null) => void
  toast: string | null
  notify: (msg: string) => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

const localRepo = new LocalRepository()

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [auth, setAuth] = useState<AuthState>(supabaseConfigured ? 'loading' : 'ready')
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [totalXp, setTotalXp] = useState(0)
  const [version, setVersion] = useState(0)
  const [result, showResult] = useState<QuestResult | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [booted, setBooted] = useState(false)

  const repo = useMemo<QuestRepository>(
    () => (supabase && session ? new SupabaseRepository(supabase) : localRepo),
    [session],
  )

  // ---- auth
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuth(data.session ? 'ready' : 'signed-out')
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setAuth(s ? 'ready' : 'signed-out')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    const [s, c, t, xp] = await Promise.all([repo.getSettings(), repo.listCategories(), repo.listTags(), repo.totalXp()])
    setSettings(s)
    setCategories(c)
    setTags(t)
    setTotalXp(xp)
    setVersion((v) => v + 1)
  }, [repo])

  // ---- boot: seed defaults on first run, then load
  useEffect(() => {
    if (auth !== 'ready') return
    let cancelled = false
    ;(async () => {
      try {
        await ensureSeeded(repo)
        if (!cancelled) await refresh()
        if (!cancelled) setBooted(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setAuth('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auth, repo, refresh])

  // ---- theme + motion on <html>
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.dataset.motion = settings.reduce_motion ? 'reduced' : 'full'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'light' ? '#f3f1ec' : '#0a0a0b')
  }, [settings.theme, settings.reduce_motion])

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch }
      setSettings(next)
      await repo.saveSettings(next)
      setVersion((v) => v + 1)
    },
    [repo, settings],
  )

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600)
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  const value: AppState = {
    auth: auth === 'ready' && !booted ? 'loading' : auth,
    error,
    email: session?.user.email ?? null,
    repo,
    settings,
    categories,
    activeCategories: categories.filter((c) => c.active),
    tags,
    totalXp,
    level: levelFromXp(totalXp, { base: settings.level_base_xp, step: settings.level_step_xp }),
    version,
    refresh,
    updateSettings,
    result,
    showResult,
    toast,
    notify,
    signOut,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside <AppProvider>')
  return v
}
