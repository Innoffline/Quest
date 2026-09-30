import { ChevronRight } from 'lucide-react'
import type { Category, CompletionType, DeviationLog } from '../types'
import { deviationLine } from '../hooks/useDay'
import { cx } from '../lib/cx'

const STATUS: Record<CompletionType | 'none', { mark: string; text: string; cls: string }> = {
  normal: { mark: '✓', text: 'Cleared', cls: 'bg-ok text-on-status' },
  minimum: { mark: '✓', text: 'Minimum cleared', cls: 'bg-min text-on-status' },
  partial: { mark: '~', text: 'Partial', cls: 'border-2 border-min text-min' },
  incomplete: { mark: '•', text: 'Logged', cls: 'border-2 border-line text-muted' },
  none: { mark: '', text: 'Open', cls: 'border-2 border-line' },
}

export function StatusMark({ type }: { type: CompletionType | undefined }) {
  const s = STATUS[type ?? 'none']
  return (
    <span className={cx('inline-flex h-8 w-8 shrink-0 -skew-x-12 items-center justify-center text-base font-bold', s.cls)}>
      <span className="skew-x-12" aria-hidden>
        {s.mark}
      </span>
    </span>
  )
}

export function CategoryRow({
  category,
  type,
  deviations,
  onClick,
}: {
  category: Category
  type: CompletionType | undefined
  deviations: DeviationLog[]
  onClick?: () => void
}) {
  const s = STATUS[type ?? 'none']
  const last = deviations.at(-1)
  const sub = last ? `Logged: ${deviationLine(last)}` : type === 'minimum' ? category.minimum_target : category.normal_target
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cx(
        'flex w-full min-h-16 items-center gap-3 border-b border-line py-2.5 text-left',
        onClick && 'transition hover:bg-surface active:bg-surface-2',
      )}
    >
      <StatusMark type={type} />
      <span className="text-2xl" aria-hidden>
        {category.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="font-semibold">{category.name}</span>
          <span className={cx('text-xs font-semibold uppercase tracking-wide', type === 'normal' ? 'text-ok' : type === 'minimum' || type === 'partial' ? 'text-min' : 'text-muted')}>
            {type ? s.text : ''}
          </span>
        </span>
        <span className="block truncate text-sm text-muted">{sub}</span>
      </span>
      {onClick && <ChevronRight size={18} className="text-muted" aria-hidden />}
    </Tag>
  )
}
