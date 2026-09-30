import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react'

import { cx } from '../lib/cx'

// ------------------------------------------------------------------ Button

type Variant = 'primary' | 'secondary' | 'ghost' | 'ok' | 'min'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong active:translate-y-px',
  secondary: 'bg-ink text-bg hover:opacity-90 active:translate-y-px',
  ghost: 'bg-transparent text-ink border-2 border-line hover:border-ink',
  ok: 'bg-ok text-on-status active:translate-y-px',
  min: 'bg-min text-on-status active:translate-y-px',
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  size?: 'md' | 'lg' | 'sm'
  slanted?: boolean
}

export function Button({ variant = 'primary', size = 'md', slanted = false, className, ...rest }: ButtonProps) {
  const sizes = { sm: 'min-h-10 px-3 text-sm', md: 'min-h-12 px-5 text-base', lg: 'min-h-16 px-7 text-2xl' }
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 transition disabled:opacity-40 disabled:pointer-events-none',
        VARIANT[variant],
        sizes[size],
        size === 'lg' ? 'font-display tracking-wide' : 'font-semibold',
        slanted ? 'slant px-8' : 'rounded-none',
        className,
      )}
    />
  )
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx('inline-flex h-11 w-11 items-center justify-center text-muted hover:text-ink transition', className)}
    >
      {children}
    </button>
  )
}

// ------------------------------------------------------------------ Chip (toggle)

export function Chip({
  selected,
  onClick,
  children,
  tone = 'accent',
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  tone?: 'accent' | 'ink'
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'min-h-10 border-2 px-3 text-sm font-medium transition -skew-x-6',
        selected
          ? tone === 'accent'
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-ink bg-ink text-bg'
          : 'border-line bg-surface text-ink hover:border-muted',
      )}
    >
      <span className="inline-block skew-x-6">
        {selected && <span aria-hidden>✓ </span>}
        {children}
      </span>
    </button>
  )
}

// ------------------------------------------------------------------ Labels

/** Slanted section tag, e.g. NEXT QUEST. */
export function Tag({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'ink' | 'muted' }) {
  const tones = { accent: 'bg-accent text-accent-ink', ink: 'bg-ink text-bg', muted: 'bg-surface-2 text-ink' }
  return (
    <span className={cx('slant inline-block px-4 py-1 font-display text-sm tracking-widest', tones[tone])}>{children}</span>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-end justify-between gap-3">
      <h2 className="font-display text-2xl">{children}</h2>
      {right}
    </div>
  )
}

// ------------------------------------------------------------------ Progress

export function Bar({ value, tone = 'accent', label, animate = false }: { value: number; tone?: 'accent' | 'ok' | 'ink'; label: string; animate?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const tones = { accent: 'bg-accent', ok: 'bg-ok', ink: 'bg-ink' }
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-3 w-full -skew-x-12 overflow-hidden bg-surface-2"
    >
      <div className={cx('h-full transition-[width] duration-700 ease-out', tones[tone], animate && 'anim-wipe')} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Five slanted pips — daily score at a glance. Filled count is also stated in text. */
export function ScorePips({ score, total, clearAt }: { score: number; total: number; clearAt: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx(
            'h-4 flex-1 -skew-x-12 transition-colors duration-500',
            i < score ? (i < clearAt ? 'bg-accent' : 'bg-ink') : 'bg-surface-2',
            i === clearAt - 1 && 'outline-2 outline-offset-2 outline-muted/60',
          )}
        />
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ Sheet (bottom modal)

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button aria-label="Close" className="absolute inset-0 bg-black/70" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="anim-rise relative max-h-[92dvh] w-full max-w-lg overflow-y-auto border-t-4 border-accent bg-bg safe-bottom outline-none sm:border-4"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-bg px-5 pb-2 pt-4">
          <h2 id={id} className="font-display text-2xl">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={22} />
          </IconButton>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Form fields

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full min-h-12 border-2 border-line bg-surface px-3 text-base text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none'

// ------------------------------------------------------------------ States

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-muted">
      <span className="h-3 w-10 -skew-x-12 animate-pulse bg-accent" />
      <span className="font-display tracking-widest">{label}…</span>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="border-l-4 border-info bg-surface p-4 text-sm">
      <p className="font-semibold">Couldn’t load this.</p>
      <p className="mt-1 text-muted">{message}</p>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="cut stripes border-2 border-dashed border-line p-6 text-center">
      <p className="font-display text-xl">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}
