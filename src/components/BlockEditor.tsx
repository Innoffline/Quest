import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAction } from '../hooks/useAction'
import { reopenBlock, skipBlock } from '../data/questService'
import { endFor } from '../lib/blocks'
import { durationMinutes, timeToMinutes } from '../lib/dates'
import { useApp } from '../state/AppContext'
import type { QuestMode, TimeBlock } from '../types'
import { DeviationSheet } from './DeviationSheet'
import { Button, Chip, Field, inputCls, Sheet } from './ui'

const PRESETS = [15, 30, 45, 60, 90, 120]

export function BlockEditor({ block, onClose }: { block: TimeBlock | null; onClose: () => void }) {
  return block ? <Editor key={block.id} block={block} onClose={onClose} /> : null
}

function Editor({ block, onClose }: { block: TimeBlock; onClose: () => void }) {
  const { repo, activeCategories, categories, notify } = useApp()
  const { run, pending } = useAction()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<TimeBlock>(block)
  const [logOpen, setLogOpen] = useState(false)

  const set = (patch: Partial<TimeBlock>) => setDraft((d) => ({ ...d, ...patch }))
  const valid = timeToMinutes(draft.end_time) > timeToMinutes(draft.start_time)
  const category = categories.find((c) => c.id === draft.category_id)
  const editable = draft.status === 'planned' || draft.status === 'skipped'

  const save = async () => {
    const ok = await run(async () => {
      await repo.saveBlock({
        ...draft,
        title: draft.title.trim() || category?.name || 'Quest',
        planned_minutes: durationMinutes(draft.start_time, draft.end_time),
        updated_at: new Date().toISOString(),
      })
      return true
    })
    if (ok) onClose()
  }

  return (
    <>
      <Sheet open={!logOpen} onClose={onClose} title="Edit quest">
        <div className="space-y-5">
          <Field label="Title">
            <input className={inputCls} value={draft.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
          </Field>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Category</legend>
            <div className="flex flex-wrap gap-2">
              {activeCategories.map((c) => (
                <Chip key={c.id} tone="ink" selected={draft.category_id === c.id} onClick={() => set({ category_id: c.id })}>
                  {c.icon} {c.name}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                className={inputCls}
                value={draft.start_time}
                onChange={(e) => {
                  const dur = durationMinutes(draft.start_time, draft.end_time) || 60
                  set({ start_time: e.target.value, end_time: endFor(e.target.value, dur) })
                }}
              />
            </Field>
            <Field label="End">
              <input type="time" className={inputCls} value={draft.end_time} onChange={(e) => set({ end_time: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Duration presets">
            {PRESETS.map((m) => (
              <Chip
                key={m}
                tone="ink"
                selected={durationMinutes(draft.start_time, draft.end_time) === m}
                onClick={() => set({ end_time: endFor(draft.start_time, m) })}
              >
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </Chip>
            ))}
          </div>
          {!valid && <p className="text-sm text-info">End time needs to be after the start.</p>}

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Mode</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['normal', 'minimum'] as QuestMode[]).map((m) => (
                <Chip key={m} tone="ink" selected={draft.mode === m} onClick={() => set({ mode: m })}>
                  {m === 'normal' ? `Quest +${category?.normal_xp ?? 20}` : `Minimum +${category?.minimum_xp ?? 10}`}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {draft.mode === 'minimum' ? category?.minimum_target : category?.normal_target}
            </p>
          </fieldset>

          <Field label="Notes (optional)">
            <input className={inputCls} value={draft.notes} maxLength={280} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Finish Q3–Q5" />
          </Field>

          <Button size="lg" className="w-full" disabled={!valid || pending} onClick={save}>
            Save
          </Button>

          <div className="grid grid-cols-2 gap-2">
            {draft.status === 'planned' && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await run(() => skipBlock(repo, draft))
                  setLogOpen(true)
                }}
              >
                Skip
              </Button>
            )}
            {!editable && draft.status !== 'active' && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await run(() => reopenBlock(repo, draft))
                  notify('Block reopened. Earned EXP stays.')
                  onClose()
                }}
              >
                Reopen
              </Button>
            )}
            {draft.status === 'skipped' && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await run(() => reopenBlock(repo, draft))
                  onClose()
                }}
              >
                Back to plan
              </Button>
            )}
            {draft.status === 'active' && (
              <Button variant="ghost" onClick={() => navigate(`/quest/${draft.id}`)}>
                Open timer
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-muted"
              onClick={async () => {
                await run(() => repo.deleteBlock(draft.id))
                onClose()
              }}
            >
              <Trash2 size={16} aria-hidden /> Delete
            </Button>
          </div>
        </div>
      </Sheet>
      {category && (
        <DeviationSheet
          open={logOpen}
          onClose={() => {
            setLogOpen(false)
            onClose()
          }}
          category={category}
          date={draft.date}
          blockId={draft.id}
          defaultPartial={false}
        />
      )}
    </>
  )
}
