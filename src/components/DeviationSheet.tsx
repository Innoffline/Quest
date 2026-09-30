import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { logDeviation } from '../data/questService'
import { newId } from '../data/repository'
import { GENERIC_REASONS } from '../lib/defaults'
import { useApp } from '../state/AppContext'
import type { Category, ISODate, Tag, TagKind } from '../types'
import { Button, Chip, Field, inputCls, Sheet } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  category: Category
  date: ISODate
  blockId?: string | null
  /** Pre-select "Partial / Off-plan" (nutrition). */
  defaultPartial?: boolean
  onSaved?: () => void
}

/**
 * "What happened?" — capture the pattern in ~20 seconds, not a diary.
 * Neutral language only; no failure framing.
 */
export function DeviationSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="What happened?">
      <DeviationForm {...props} />
    </Sheet>
  )
}

function DeviationForm({ onClose, category, date, blockId, defaultPartial = true, onSaved }: Props) {
  const { repo, tags, categories, settings, notify } = useApp()
  const { run, pending } = useAction()
  const food = category.log_style === 'food'
  const [item, setItem] = useState<string | null>(null)
  const [trigger, setTrigger] = useState<string | null>(null)
  const [context, setContext] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [partial, setPartial] = useState(defaultPartial)


  const byKind = useMemo(() => {
    const pick = (kind: TagKind, catId: string | null = null) =>
      tags.filter((t) => t.kind === kind && (kind !== 'reason' || t.category_id === catId)).map((t) => t.label)
    const reasons = pick('reason', category.id)
    return {
      food: pick('food'),
      trigger: pick('trigger'),
      context: pick('context'),
      reason: reasons.length ? reasons : GENERIC_REASONS,
    }
  }, [tags, category.id])

  const addTag = async (kind: TagKind, label: string) => {
    const tag: Tag = { id: newId(), kind, label, category_id: kind === 'reason' ? category.id : null, sort_order: 999 }
    await run(() => repo.saveTags([tag]))
  }

  const canSave = Boolean(item || trigger || context || note.trim())

  const save = async () => {
    const ok = await run(() =>
      logDeviation(repo, {
        date,
        category,
        categories,
        settings,
        blockId,
        item_label: food ? item : null,
        trigger,
        context,
        note,
        markPartial: food && partial,
      }),
    )
    if (ok) {
      notify('Logged. Pattern captured.')
      onSaved?.()
      onClose()
    }
  }

  return (
    <>
      <p className="mb-5 text-sm text-muted">
        {category.icon} {category.name} · Tap what fits. Everything is optional.
      </p>

      {food && (
        <div className="mb-6 grid grid-cols-2 gap-2">
          <Chip selected={partial} onClick={() => setPartial(true)} tone="ink">
            Partial / Off-plan
          </Chip>
          <Chip selected={!partial} onClick={() => setPartial(false)} tone="ink">
            Just log it
          </Chip>
        </div>
      )}

      {food ? (
        <>
          <TagGroup label="Food / Event" options={byKind.food} value={item} onChange={setItem} onAdd={(l) => addTag('food', l)} />
          <TagGroup label="Trigger" options={byKind.trigger} value={trigger} onChange={setTrigger} onAdd={(l) => addTag('trigger', l)} />
          <TagGroup label="Context" options={byKind.context} value={context} onChange={setContext} onAdd={(l) => addTag('context', l)} />
        </>
      ) : (
        <>
          <TagGroup label="What got in the way" options={byKind.reason} value={trigger} onChange={setTrigger} onAdd={(l) => addTag('reason', l)} />
        </>
      )}

      <Field label="Note (optional)">
        <input
          className={inputCls}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={food ? 'e.g. Skipped lunch' : 'e.g. Next step wasn’t clear'}
          maxLength={280}
        />
      </Field>

      <Button className="mt-6 w-full" size="lg" disabled={!canSave || pending} onClick={save}>
        Save log
      </Button>
      <p className="mt-3 text-center text-xs text-muted">Logging what happened is useful data — it counts as showing up.</p>
    </>
  )
}

function TagGroup({
  label,
  options,
  value,
  onChange,
  onAdd,
}: {
  label: string
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
  onAdd: (label: string) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const all = value && !options.includes(value) ? [...options, value] : options
  const submit = async () => {
    const l = text.trim()
    if (!l) return setAdding(false)
    if (!options.some((o) => o.toLowerCase() === l.toLowerCase())) await onAdd(l)
    onChange(options.find((o) => o.toLowerCase() === l.toLowerCase()) ?? l)
    setText('')
    setAdding(false)
  }
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => (
          <Chip key={o} selected={value === o} onClick={() => onChange(value === o ? null : o)}>
            {o}
          </Chip>
        ))}
        {adding ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <input
              autoFocus
              className={inputCls + ' !min-h-10 w-40'}
              value={text}
              maxLength={60}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => void submit()}
              placeholder="Custom"
              aria-label={`Custom ${label}`}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-10 items-center gap-1 border-2 border-dashed border-line px-3 text-sm text-muted hover:text-ink"
          >
            <Plus size={16} /> Custom
          </button>
        )}
      </div>
    </fieldset>
  )
}
