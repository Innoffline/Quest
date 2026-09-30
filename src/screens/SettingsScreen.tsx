import { ArrowDown, ArrowUp, Download, LogOut, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button, Chip, Field, IconButton, SectionTitle, Sheet, inputCls } from '../components/ui'
import { cx } from '../lib/cx'
import { newId } from '../data/repository'
import { useAction } from '../hooks/useAction'
import { xpToAdvance } from '../lib/levels'
import { useApp } from '../state/AppContext'
import type { Category, Tag, TagKind } from '../types'

export function SettingsScreen() {
  const { repo, settings, updateSettings, categories, email, signOut, level } = useApp()
  const { run } = useAction()
  const [editing, setEditing] = useState<Category | null>(null)

  const move = (i: number, dir: -1 | 1) => {
    const list = [...categories]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    return run(() => repo.saveCategories(list.map((c, k) => ({ ...c, sort_order: k }))))
  }

  const addCategory = () =>
    setEditing({
      id: newId(),
      name: '',
      icon: '⭐',
      description: '',
      normal_target: '',
      minimum_target: '',
      normal_xp: 20,
      minimum_xp: 10,
      default_minutes: 60,
      log_style: 'reason',
      active: true,
      sort_order: categories.length,
      created_at: new Date().toISOString(),
    })

  const exportData = async () => {
    const data = await repo.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `quest-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="px-4 pb-10 pt-4">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted">Configuration</p>
      <h1 className="font-display text-4xl">Settings</h1>

      {/* ------------------------------------------------ account */}
      <div className="mt-5 border-l-4 border-accent bg-surface p-4 text-sm">
        {repo.kind === 'supabase' ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Synced with Supabase</p>
              <p className="text-muted">{email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut size={16} aria-hidden /> Sign out
            </Button>
          </div>
        ) : (
          <>
            <p className="font-semibold">Local Mode</p>
            <p className="mt-1 text-muted">
              Data is stored only in this browser. Add Supabase keys to <code>.env</code> to sync across devices (see README).
            </p>
          </>
        )}
      </div>

      {/* ------------------------------------------------ categories */}
      <SectionTitle
        right={
          <Button size="sm" variant="ghost" onClick={addCategory}>
            <Plus size={16} aria-hidden /> Add
          </Button>
        }
      >
        Quest lines
      </SectionTitle>
      <ul className="border-t border-line">
        {categories.map((c, i) => (
          <li key={c.id} className={cx('flex items-center gap-2 border-b border-line py-2', !c.active && 'opacity-50')}>
            <button className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing(c)}>
              <span className="text-2xl" aria-hidden>
                {c.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">
                  {c.name} {!c.active && <span className="text-xs font-normal text-muted">(inactive)</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  +{c.normal_xp} · min +{c.minimum_xp} · {c.normal_target}
                </span>
              </span>
            </button>
            <IconButton label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-20">
              <ArrowUp size={18} />
            </IconButton>
            <IconButton label={`Move ${c.name} down`} disabled={i === categories.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-20">
              <ArrowDown size={18} />
            </IconButton>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Each active quest line is worth one point of the daily score.</p>

      {/* ------------------------------------------------ exp & levels */}
      <SectionTitle>EXP & levels</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <NumberSetting key={`level_base_xp-${settings.level_base_xp}`} label="L1→2 EXP" value={settings.level_base_xp} min={10} onSave={(v) => updateSettings({ level_base_xp: v })} />
        <NumberSetting key={`level_step_xp-${settings.level_step_xp}`} label="+ per level" value={settings.level_step_xp} min={0} onSave={(v) => updateSettings({ level_step_xp: v })} />
        <NumberSetting key={`schedule_bonus_xp-${settings.schedule_bonus_xp}`} label="On-time bonus" value={settings.schedule_bonus_xp} min={0} onSave={(v) => updateSettings({ schedule_bonus_xp: v })} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Curve: {[1, 2, 3, 4, 5].map((l) => xpToAdvance(l, { base: settings.level_base_xp, step: settings.level_step_xp })).join(' → ')} … · You: Lv {level.level},{' '}
        {level.totalXp} EXP total
      </p>

      {/* ------------------------------------------------ preferences */}
      <SectionTitle>Preferences</SectionTitle>
      <div className="space-y-4">
        <Toggle label="Week starts on" options={[['Monday', 1], ['Sunday', 0]] as const} value={settings.week_start} onChange={(v) => updateSettings({ week_start: v })} />
        <Toggle label="Theme" options={[['Dark', 'dark'], ['Light', 'light']] as const} value={settings.theme} onChange={(v) => updateSettings({ theme: v })} />
        <Toggle label="Motion" options={[['Full', false], ['Reduced', true]] as const} value={settings.reduce_motion} onChange={(v) => updateSettings({ reduce_motion: v })} />
        <Toggle label="Weight unit" options={[['lb', 'lb'], ['kg', 'kg']] as const} value={settings.weight_unit} onChange={(v) => updateSettings({ weight_unit: v })} />
      </div>

      {/* ------------------------------------------------ tags */}
      <SectionTitle>Quick-log tags</SectionTitle>
      <TagManager />

      {/* ------------------------------------------------ data */}
      <SectionTitle>Your data</SectionTitle>
      <Button variant="ghost" className="w-full" onClick={exportData}>
        <Download size={18} aria-hidden /> Export all data (JSON)
      </Button>
      <p className="mt-2 text-xs text-muted">Exports stay on your device. Don’t commit them to the repository.</p>

      <SectionTitle>Install on iPhone</SectionTitle>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Open Quest in Safari.</li>
        <li>Tap the Share button.</li>
        <li>Choose “Add to Home Screen”, then “Add”.</li>
      </ol>

      <CategoryEditor category={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Toggle<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly (readonly [string, T])[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="float-left text-sm font-semibold">{label}</legend>
      <div className="flex gap-2">
        {options.map(([text, v]) => (
          <Chip key={String(v)} tone="ink" selected={value === v} onClick={() => onChange(v)}>
            {text}
          </Chip>
        ))}
      </div>
    </fieldset>
  )
}

function NumberSetting({ label, value, min, onSave }: { label: string; value: number; min: number; onSave: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <Field label={label}>
      <input
        className={inputCls}
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
        onBlur={() => {
          const n = Math.max(min, Math.min(10_000, Number(text) || min))
          setText(String(n))
          if (n !== value) onSave(n)
        }}
      />
    </Field>
  )
}

function CategoryEditor({ category, onClose }: { category: Category | null; onClose: () => void }) {
  return category ? <CategoryForm key={category.id} category={category} onClose={onClose} /> : null
}

function CategoryForm({ category, onClose }: { category: Category; onClose: () => void }) {
  const { repo, categories } = useApp()
  const { run, pending } = useAction()
  const [d, setD] = useState<Category>(category)
  const isNew = !categories.some((c) => c.id === d.id)
  const set = (p: Partial<Category>) => setD((x) => ({ ...x, ...p }))
  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v.replace(/\D/g, '')) || 0))
  const valid = d.name.trim().length > 0

  return (
    <Sheet open onClose={onClose} title={isNew ? 'New quest line' : 'Edit quest line'}>
      <div className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <Field label="Icon">
            <input className={inputCls + ' text-center text-2xl'} value={d.icon} maxLength={4} onChange={(e) => set({ icon: e.target.value })} />
          </Field>
          <Field label="Name">
            <input className={inputCls} value={d.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <input className={inputCls} value={d.description} maxLength={200} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <Field label="Normal quest target">
            <input className={inputCls} value={d.normal_target} maxLength={120} onChange={(e) => set({ normal_target: e.target.value })} />
          </Field>
          <Field label="EXP">
            <input className={inputCls} inputMode="numeric" value={d.normal_xp} onChange={(e) => set({ normal_xp: num(e.target.value, 0, 500) })} />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <Field label="Minimum quest target">
            <input className={inputCls} value={d.minimum_target} maxLength={120} onChange={(e) => set({ minimum_target: e.target.value })} />
          </Field>
          <Field label="EXP">
            <input className={inputCls} inputMode="numeric" value={d.minimum_xp} onChange={(e) => set({ minimum_xp: num(e.target.value, 0, 500) })} />
          </Field>
        </div>
        <Field label="Default block length (min)">
          <input className={inputCls} inputMode="numeric" value={d.default_minutes} onChange={(e) => set({ default_minutes: num(e.target.value, 0, 600) })} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">“What happened?” style</legend>
          <div className="grid grid-cols-2 gap-2">
            <Chip tone="ink" selected={d.log_style === 'food'} onClick={() => set({ log_style: 'food' })}>
              Food · trigger · context
            </Chip>
            <Chip tone="ink" selected={d.log_style === 'reason'} onClick={() => set({ log_style: 'reason' })}>
              Reason
            </Chip>
          </div>
        </fieldset>
        <Chip tone="ink" selected={d.active} onClick={() => set({ active: !d.active })}>
          {d.active ? 'Active — counts toward daily score' : 'Inactive — hidden, history kept'}
        </Chip>
        <Button
          size="lg"
          className="w-full"
          disabled={!valid || pending}
          onClick={async () => {
            await run(() => repo.saveCategory({ ...d, name: d.name.trim(), default_minutes: Math.max(5, d.default_minutes) }))
            onClose()
          }}
        >
          Save
        </Button>
      </div>
    </Sheet>
  )
}

const KINDS: { kind: TagKind; label: string }[] = [
  { kind: 'food', label: 'Food / event' },
  { kind: 'trigger', label: 'Triggers' },
  { kind: 'context', label: 'Contexts' },
  { kind: 'reason', label: 'Reasons' },
]

function TagManager() {
  const { repo, tags, activeCategories } = useApp()
  const { run } = useAction()
  const [kind, setKind] = useState<TagKind>('food')
  const [catId, setCatId] = useState<string | null>(activeCategories.find((c) => c.log_style === 'reason')?.id ?? null)
  const [text, setText] = useState('')
  const visible = tags.filter((t) => t.kind === kind && (kind !== 'reason' || t.category_id === catId))

  const add = async () => {
    const label = text.trim()
    if (!label || visible.some((t) => t.label.toLowerCase() === label.toLowerCase())) return setText('')
    const tag: Tag = { id: newId(), kind, label, category_id: kind === 'reason' ? catId : null, sort_order: visible.length }
    await run(() => repo.saveTags([tag]))
    setText('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Chip key={k.kind} tone="ink" selected={kind === k.kind} onClick={() => setKind(k.kind)}>
            {k.label}
          </Chip>
        ))}
      </div>
      {kind === 'reason' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeCategories
            .filter((c) => c.log_style === 'reason')
            .map((c) => (
              <Chip key={c.id} selected={catId === c.id} onClick={() => setCatId(c.id)}>
                {c.icon} {c.name}
              </Chip>
            ))}
        </div>
      )}
      <ul className="mt-4 flex flex-wrap gap-2">
        {visible.map((t) => (
          <li key={t.id} className="inline-flex items-center border-2 border-line bg-surface pl-3 text-sm">
            {t.label}
            <button aria-label={`Remove ${t.label}`} className="flex h-9 w-9 items-center justify-center text-muted hover:text-ink" onClick={() => run(() => repo.deleteTag(t.id))}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input className={inputCls} value={text} maxLength={60} placeholder="New tag" onChange={(e) => setText(e.target.value)} aria-label="New tag" />
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          Add
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted">Removing a tag keeps past logs intact.</p>
    </div>
  )
}
