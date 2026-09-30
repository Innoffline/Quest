import { CalendarClock, CalendarDays, ChartColumn, Settings2, Timer, Zap } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useNow } from '../hooks/useClock'
import { useQuery } from '../hooks/useQuery'
import { formatClock } from '../lib/dates'
import { elapsedSeconds } from '../lib/xp'
import { useApp } from '../state/AppContext'
import { CompletionOverlay } from './CompletionOverlay'
import { cx } from '../lib/cx'

const NAV = [
  { to: '/', label: 'Today', icon: Zap },
  { to: '/plan', label: 'Plan', icon: CalendarClock },
  { to: '/history', label: 'History', icon: CalendarDays },
  { to: '/review', label: 'Review', icon: ChartColumn },
  { to: '/settings', label: 'Settings', icon: Settings2 },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { toast, repo, categories } = useApp()
  const location = useLocation()
  const onQuest = location.pathname.startsWith('/quest/')
  const active = useQuery(() => repo.getActiveBlock(), [])
  const now = useNow(1000)
  const block = active.data
  const cat = block ? categories.find((c) => c.id === block.category_id) : undefined

  // New screen starts at the top.
  useEffect(() => window.scrollTo(0, 0), [location.pathname])

  return (
    <div className="mx-auto min-h-dvh max-w-lg safe-top">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-ink focus:p-2 focus:text-bg">
        Skip to content
      </a>
      <main id="main" className="pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* floating active-quest bar */}
      {block && !onQuest && (
        <Link
          to={`/quest/${block.id}`}
          className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-lg items-center gap-3 bg-accent px-4 py-2.5 text-accent-ink"
        >
          <Timer size={18} aria-hidden />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {cat?.icon} {block.title}
          </span>
          <span className="font-display text-xl tabular-nums">{formatClock(elapsedSeconds(block, now))}</span>
        </Link>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t-2 border-ink bg-bg/95 backdrop-blur safe-bottom"
      >
        <ul className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cx(
                    'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition',
                    isActive ? 'text-ink' : 'text-muted hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span aria-hidden className="absolute inset-x-3 top-0 h-1 -skew-x-12 bg-accent" />}
                    <Icon size={22} strokeWidth={isActive ? 2.6 : 2} aria-hidden />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <CompletionOverlay />
      {toast && (
        <div role="status" className="anim-rise fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top))] z-[70] mx-auto max-w-md bg-ink px-4 py-3 text-sm font-semibold text-bg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
