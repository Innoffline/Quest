import { Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useAction } from '../hooks/useAction'
import { deviationLine } from '../hooks/useDay'
import { clearCategory, recordCategory } from '../data/questService'
import { useApp } from '../state/AppContext'
import type { Category, DailyCompletion, DeviationLog, ISODate } from '../types'
import { DeviationSheet } from './DeviationSheet'
import { Button, IconButton, Sheet } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  category: Category
  date: ISODate
  completion?: DailyCompletion
  deviations: DeviationLog[]
}

/** Quick record for a category without a timed block (e.g. Nutrition, a walk). */
export function CategorySheet({ open, onClose, category, date, completion, deviations }: Props) {
  const { repo, categories, settings, showResult } = useApp()
  const { run, pending } = useAction()
  const [logOpen, setLogOpen] = useState(false)

  const record = async (type: 'normal' | 'minimum') => {
    const r = await run(() => recordCategory(repo, { date, category, categories, settings, type, allowDowngrade: true }))
    if (r) {
      onClose()
      showResult(r)
    }
  }

  const current = completion?.completion_type
  return (
    <>
      <Sheet open={open && !logOpen} onClose={onClose} title={`${category.icon} ${category.name}`}>
        {category.description && <p className="mb-5 text-sm text-muted">{category.description}</p>}

        <div className="space-y-3">
          <QuestOption
            label="Quest"
            target={category.normal_target}
            xp={category.normal_xp}
            active={current === 'normal'}
            disabled={pending}
            onClick={() => record('normal')}
          />
          <QuestOption
            label="Minimum Quest"
            target={category.minimum_target}
            xp={category.minimum_xp}
            active={current === 'minimum'}
            disabled={pending}
            minimum
            onClick={() => record('minimum')}
          />
        </div>

        <Button variant="ghost" className="mt-4 w-full" onClick={() => setLogOpen(true)}>
          What happened?
        </Button>

        {deviations.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Logged today</h3>
            <ul className="divide-y divide-line border-y border-line">
              {deviations.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {deviationLine(d)}
                    {d.note && d.item_label && <span className="block text-xs text-muted">{d.note}</span>}
                  </span>
                  <IconButton label="Delete log" onClick={() => run(() => repo.deleteDeviation(d.id))}>
                    <Trash2 size={18} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        )}

        {completion && (
          <button
            type="button"
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            onClick={async () => {
              await run(() => clearCategory(repo, completion))
              onClose()
            }}
          >
            <Undo2 size={16} /> Recorded by mistake? Clear this entry
          </button>
        )}
      </Sheet>
      <DeviationSheet open={logOpen} onClose={() => setLogOpen(false)} category={category} date={date} onSaved={onClose} />
    </>
  )
}

function QuestOption({
  label,
  target,
  xp,
  active,
  minimum,
  disabled,
  onClick,
}: {
  label: string
  target: string
  xp: number
  active: boolean
  minimum?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={
        'cut-2 flex w-full items-center justify-between gap-3 border-l-8 bg-surface p-4 text-left transition hover:bg-surface-2 ' +
        (minimum ? 'border-min' : 'border-accent')
      }
    >
      <span>
        <span className="block font-display text-lg">
          {label} {active && <span className="text-ok">✓</span>}
        </span>
        <span className="block text-sm text-muted">{target || '—'}</span>
      </span>
      <span className="font-display text-2xl text-ink">+{xp}</span>
    </button>
  )
}
