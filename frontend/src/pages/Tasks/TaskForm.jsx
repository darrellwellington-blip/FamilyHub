import { useState, useEffect } from 'react'
import { tasksApi, requirementsApi, inventoryApi, shoppingApi } from '../../api'
import { useUser } from '../../UserContext'
import { MONTH_NAMES, DAY_NAMES_SHORT, todayISO } from './taskUtils'

const PRESET_CATEGORIES = ['Home', 'Car', 'Health', 'Garden']

const UNITS = [
  { value: 'days',   label: 'days'   },
  { value: 'weeks',  label: 'weeks'  },
  { value: 'months', label: 'months' },
  { value: 'years',  label: 'years'  },
]

function initForm(task, knownCats) {
  const isCustomCat = task?.category && !knownCats.includes(task.category)
  const isRecurring = task?.recurrence_type === 'Recurring'
  const isSeasonal  = task?.recurrence_type === 'Seasonal'
  let seasonalMonths = []
  if (task?.recurrence_months) {
    try { seasonalMonths = JSON.parse(task.recurrence_months) } catch {}
  }
  let recurrence_days = []
  if (task?.recurrence_days) {
    try { recurrence_days = JSON.parse(task.recurrence_days) } catch {}
  }

  return {
    title:               task?.title               ?? '',
    description:         task?.description         ?? '',
    categorySelect:      isCustomCat ? '__custom'  : (task?.category ?? 'Home'),
    customCategory:      isCustomCat ? task.category : '',
    priority:            task?.priority            ?? 'Medium',

    // Schedule
    due_date:            task?.due_date            ?? '',
    due_time:            task?.due_time            ?? '',

    // Recurrence
    recurring:           isRecurring,
    seasonal:            isSeasonal,
    recurrence_unit:     task?.recurrence_unit     ?? 'weeks',
    recurrence_interval: task?.recurrence_interval ?? 1,
    recurrence_days,
    recurrence_start:    task?.recurrence_start    ?? todayISO(),
    recurrence_end_type: task?.recurrence_end_type ?? 'never',
    recurrence_end_date: task?.recurrence_end_date ?? '',
    recurrence_end_count:task?.recurrence_end_count ?? 2,

    // Seasonal
    seasonalMonths,

    assigned_to:         task?.assigned_to    ?? null,
    parent_task_id:      task?.parent_task_id ?? null,
    is_active:           task?.is_active ?? 1,
  }
}

export default function TaskForm({ task, categories, allTasks = [], onClose, onSaved, onDelete, onAddSubtask }) {
  const { users } = useUser()
  const knownCategories = categories?.length ? categories : PRESET_CATEGORIES
  const [form, setForm] = useState(() => initForm(task, knownCategories))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleDay = (d) => set('recurrence_days',
    form.recurrence_days.includes(d)
      ? form.recurrence_days.filter(x => x !== d)
      : [...form.recurrence_days, d]
  )

  const toggleMonth = (m) => set('seasonalMonths',
    form.seasonalMonths.includes(m)
      ? form.seasonalMonths.filter(x => x !== m)
      : [...form.seasonalMonths, m]
  )

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }

    const category = form.categorySelect === '__custom'
      ? form.customCategory.trim() || 'Custom'
      : form.categorySelect

    setSaving(true); setError(null)
    try {
      let recurrence_type = 'One-time'
      if (form.recurring) recurrence_type = 'Recurring'
      if (form.seasonal)  recurrence_type = 'Seasonal'

      const payload = {
        title:       form.title.trim(),
        description: form.description.trim(),
        category,
        priority:    form.priority,
        is_active:   form.is_active ? 1 : 0,
        assigned_to:    form.assigned_to    ?? null,
        parent_task_id: form.parent_task_id ?? null,
        due_date: !form.recurring && !form.seasonal && form.due_date ? form.due_date : null,
        due_time: form.due_time || null,

        recurrence_type,
        recurrence_unit:     form.recurring ? form.recurrence_unit : null,
        recurrence_interval: form.recurring ? Number(form.recurrence_interval) || 1 : null,
        recurrence_days:     form.recurring && form.recurrence_unit === 'weeks' && form.recurrence_days.length
                               ? JSON.stringify(form.recurrence_days) : null,
        recurrence_months:   form.seasonal ? JSON.stringify(form.seasonalMonths) : null,
        recurrence_start:    form.recurring ? (form.recurrence_start || todayISO()) : null,
        recurrence_end_type: form.recurring ? form.recurrence_end_type : null,
        recurrence_end_date: form.recurring && form.recurrence_end_type === 'on_date'
                               ? form.recurrence_end_date : null,
        recurrence_end_count:form.recurring && form.recurrence_end_type === 'after'
                               ? Number(form.recurrence_end_count) || 1 : null,
      }

      if (task) {
        await tasksApi.update(task.id, payload)
      } else {
        await tasksApi.create(payload)
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const n = Number(form.recurrence_interval) || 1
  const unitSingular = { days: 'day', weeks: 'week', months: 'month', years: 'year' }

  return (
    <Modal title={task ? 'Edit Task' : 'Add Task'} onClose={onClose}
      headerAction={task && onDelete && (
        <button type="button" onClick={() => { if (confirm(`Delete "${task.title}"?`)) onDelete() }}
          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">
          Delete
        </button>
      )}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Title */}
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input className="input" value={form.title}
            onChange={e => set('title', e.target.value)} />
        </div>

        {/* Description */}
        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2}
            value={form.description} onChange={e => set('description', e.target.value)} />
        </div>

        {/* Category */}
        <div>
          <label className="label">Category</label>
          <div className="flex gap-2">
            <select className="input" value={form.categorySelect}
              onChange={e => set('categorySelect', e.target.value)}>
              {knownCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom">Custom…</option>
            </select>
            {form.categorySelect === '__custom' && (
              <input className="input" placeholder="Category name"
                value={form.customCategory}
                onChange={e => set('customCategory', e.target.value)} />
            )}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="label">Priority</label>
          <div className="flex gap-3">
            {['Low', 'Medium', 'High'].map(p => (
              <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input type="radio" name="priority" value={p}
                  checked={form.priority === p} onChange={() => set('priority', p)}
                  className="accent-indigo-600" />
                {p}
              </label>
            ))}
          </div>
        </div>

        {/* Parent task */}
        {(() => {
          // Eligible parents: top-level tasks (no parent), excluding this task itself
          const eligible = allTasks.filter(t =>
            !t.parent_task_id && t.id !== task?.id
          )
          if (!eligible.length) return null
          return (
            <div>
              <label className="label">Subtask of</label>
              <select className="input"
                value={form.parent_task_id ?? ''}
                onChange={e => set('parent_task_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— None (top-level task) —</option>
                {eligible.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          )
        })()}

        {/* Assigned to */}
        <div>
          <label className="label">Assigned to</label>
          <div className="flex gap-2 flex-wrap">
            <button type="button"
              onClick={() => set('assigned_to', null)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                form.assigned_to == null
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              Anyone
            </button>
            {users.map(u => (
              <button key={u.id} type="button"
                onClick={() => set('assigned_to', u.id)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  form.assigned_to === u.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {u.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Schedule ──────────────────────────────────────────────── */}
        <div className="border border-gray-100 rounded-xl p-4 flex flex-col gap-4 bg-gray-50/50">

          {/* Date + Time (for one-time tasks) */}
          {!form.recurring && !form.seasonal && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="date" className="input" value={form.due_date}
                  onChange={e => set('due_date', e.target.value)} />
              </div>
              <div className="w-36">
                <label className="label">Time <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="time" className="input" value={form.due_time}
                  onChange={e => set('due_time', e.target.value)} />
              </div>
            </div>
          )}

          {/* Recurring toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div className={`relative w-10 h-5 rounded-full transition-colors ${form.recurring ? 'bg-indigo-600' : 'bg-gray-300'}`}
              onClick={() => { set('recurring', !form.recurring); if (!form.recurring) set('seasonal', false) }}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.recurring ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">Repeats</span>
          </label>

          {/* Recurring options */}
          {form.recurring && (
            <div className="flex flex-col gap-4 pl-1">

              {/* Every N unit */}
              <div>
                <label className="label">Repeats every</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="number" min={1} max={99} className="input w-20 text-center"
                    value={form.recurrence_interval}
                    onChange={e => set('recurrence_interval', e.target.value)} />
                  <div className="flex gap-1.5 flex-wrap">
                    {UNITS.map(u => (
                      <button key={u.value} type="button"
                        onClick={() => set('recurrence_unit', u.value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          form.recurrence_unit === u.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
                        }`}>
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Day-of-week picker for weeks */}
              {form.recurrence_unit === 'weeks' && (
                <div>
                  <label className="label">On <span className="text-gray-400 font-normal">(optional)</span></label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_NAMES_SHORT.map((name, i) => (
                      <button key={i} type="button" onClick={() => toggleDay(i)}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          form.recurrence_days.includes(i)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                        }`}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time */}
              <div className="w-36">
                <label className="label">Time <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="time" className="input" value={form.due_time}
                  onChange={e => set('due_time', e.target.value)} />
              </div>

              {/* Start date */}
              <div>
                <label className="label">Start date</label>
                <input type="date" className="input max-w-[180px]"
                  value={form.recurrence_start}
                  onChange={e => set('recurrence_start', e.target.value)} />
              </div>

              {/* Ends */}
              <div>
                <label className="label">Ends</label>
                <div className="flex flex-col gap-2">

                  {[
                    { key: 'never',   label: 'Never' },
                    { key: 'on_date', label: 'On date' },
                    { key: 'after',   label: 'After' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer text-sm">
                      <input type="radio" name="end_type"
                        checked={form.recurrence_end_type === opt.key}
                        onChange={() => set('recurrence_end_type', opt.key)}
                        className="accent-indigo-600 mt-0.5" />
                      <span className="text-gray-700">{opt.label}</span>

                      {opt.key === 'on_date' && form.recurrence_end_type === 'on_date' && (
                        <input type="date" className="input ml-1"
                          value={form.recurrence_end_date}
                          onChange={e => set('recurrence_end_date', e.target.value)} />
                      )}

                      {opt.key === 'after' && form.recurrence_end_type === 'after' && (
                        <span className="flex items-center gap-1.5 ml-1">
                          <input type="number" min={1} className="input w-20 text-center"
                            value={form.recurrence_end_count}
                            onChange={e => set('recurrence_end_count', e.target.value)} />
                          <span className="text-gray-500">
                            {(Number(form.recurrence_end_count) || 1) === 1
                              ? `${unitSingular[form.recurrence_unit]}`
                              : `${unitSingular[form.recurrence_unit]}s`}
                          </span>
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Seasonal toggle (only when not recurring) */}
          {!form.recurring && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className={`relative w-10 h-5 rounded-full transition-colors ${form.seasonal ? 'bg-indigo-600' : 'bg-gray-300'}`}
                onClick={() => set('seasonal', !form.seasonal)}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.seasonal ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Seasonal (active in certain months)</span>
            </label>
          )}

          {/* Seasonal month picker */}
          {form.seasonal && !form.recurring && (
            <div>
              <label className="label">Active months</label>
              <div className="flex flex-wrap gap-2">
                {MONTH_NAMES.map((name, i) => {
                  const m = i + 1
                  const checked = form.seasonalMonths.includes(m)
                  return (
                    <button key={m} type="button" onClick={() => toggleMonth(m)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        checked
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                      }`}>
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Subtasks (editing a top-level task) */}
        {task && !task.parent_task_id && (() => {
          const subtasks = allTasks.filter(t => t.parent_task_id === task.id)
          return (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Subtasks</label>
                {onAddSubtask && (
                  <button type="button" onClick={onAddSubtask}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    + Add subtask
                  </button>
                )}
              </div>
              {subtasks.length === 0 ? (
                <p className="text-xs text-gray-400">No subtasks yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {subtasks.map(s => {
                    const done = !!s.last_completed_at
                    return (
                      <div key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
                        ${done ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                        <span className={`text-base leading-none ${done ? 'text-green-500' : 'text-gray-300'}`}>
                          {done ? '✓' : '○'}
                        </span>
                        <span className={done ? 'line-through opacity-60' : ''}>{s.title}</span>
                        {s.assigned_to_name && (
                          <span className="ml-auto text-xs text-gray-400">{s.assigned_to_name}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {/* Requirements (edit only) */}
        {task?.id && (
          <RequirementsSection taskId={task.id} />
        )}

        {/* Active toggle (edit only) */}
        {task && (
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="accent-indigo-600 w-4 h-4"
              checked={Boolean(form.is_active)}
              onChange={e => set('is_active', e.target.checked ? 1 : 0)} />
            Task is active
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          {task && onDelete && (
            <button type="button" className="btn-danger"
              onClick={() => { if (confirm(`Delete "${task.title}"?`)) onDelete() }}>
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : task ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </div>

      </form>
    </Modal>
  )
}

/* ── Requirements section ────────────────────────────────────────────────── */

function RequirementsSection({ taskId }) {
  const [reqs,         setReqs]         = useState([])
  const [showInvPicker, setShowInvPicker] = useState(false)
  const [showShopPicker, setShowShopPicker] = useState(false)

  const load = async () => setReqs(await requirementsApi.list(taskId))
  useEffect(() => { load() }, [taskId])

  const handleDelete = async (id) => {
    await requirementsApi.delete(id)
    await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label mb-0">Requirements</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowInvPicker(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            + Inventory
          </button>
          <button type="button" onClick={() => setShowShopPicker(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            + Shopping
          </button>
        </div>
      </div>

      {reqs.length === 0 ? (
        <p className="text-xs text-gray-400">No requirements yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reqs.map(r => (
            <div key={r.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
              ${r.ready ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
              <span className={r.ready ? 'text-green-500' : 'text-gray-300'}>
                {r.ready ? '✓' : '○'}
              </span>
              <span className="flex-1 min-w-0">
                <span className={r.ready ? 'text-green-700' : 'text-gray-700'}>{r.label}</span>
                <span className="ml-1.5 text-xs text-gray-400">
                  {r.type === 'inventory' ? '📦' : '🛒'}
                  {r.type === 'shopping' && r.sl_name ? ` ${r.sl_name}` : ''}
                  {r.type === 'inventory' && r.inv_location ? ` · ${r.inv_location}` : ''}
                </span>
              </span>
              <button type="button" onClick={() => handleDelete(r.id)}
                className="text-gray-300 hover:text-red-500 text-xs shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {showInvPicker && (
        <InventoryPickerModal
          onClose={() => setShowInvPicker(false)}
          onPicked={async (invId) => {
            await requirementsApi.create(taskId, { type: 'inventory', inventory_item_id: invId })
            setShowInvPicker(false)
            await load()
          }}
        />
      )}
      {showShopPicker && (
        <ShoppingPickerModal
          onClose={() => setShowShopPicker(false)}
          onAdded={async (listId, label) => {
            await requirementsApi.create(taskId, { type: 'shopping', shopping_list_id: listId, label })
            setShowShopPicker(false)
            await load()
          }}
        />
      )}
    </div>
  )
}

function InventoryPickerModal({ onClose, onPicked }) {
  const [search,  setSearch]  = useState('')
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    inventoryApi.list({ status: 'active' }).then(d => { setItems(d); setLoading(false) })
  }, [])

  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Modal title="Pick an Inventory Item" onClose={onClose}>
      <input className="input mb-3" placeholder="Search…" value={search}
        onChange={e => setSearch(e.target.value)} />
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">No items found.</p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
          {filtered.map(item => (
            <button key={item.id} type="button"
              onClick={() => onPicked(item.id)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100
                bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 text-left transition-colors">
              <span className="text-sm font-medium text-gray-800 flex-1">{item.name}</span>
              {item.location && <span className="text-xs text-gray-400">{item.location}</span>}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

function ShoppingPickerModal({ onClose, onAdded }) {
  const [lists,   setLists]   = useState([])
  const [listId,  setListId]  = useState('')
  const [label,   setLabel]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    shoppingApi.lists({ archived: false }).then(d => {
      setLists(d)
      if (d.length) setListId(String(d[0].id))
      setLoading(false)
    })
  }, [])

  const handleAdd = () => {
    if (!listId || !label.trim()) return
    onAdded(Number(listId), label.trim())
  }

  return (
    <Modal title="Add to Shopping List" onClose={onClose}>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Item name</label>
            <input className="input" placeholder="What do you need to buy?"
              value={label} onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          </div>
          <div>
            <label className="label">Add to list</label>
            {lists.length === 0 ? (
              <p className="text-sm text-gray-400">No shopping lists exist yet. Create one in the Shopping tab first.</p>
            ) : (
              <select className="input" value={listId} onChange={e => setListId(e.target.value)}>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary w-full sm:w-auto justify-center"
              disabled={!label.trim() || !listId} onClick={handleAdd}>
              Add to List
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ── Shared modal shell ────────────────────────────────────────────────────── */
export function Modal({ title, onClose, children, maxWidth = 'max-w-lg', headerAction }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white w-full ${maxWidth} flex flex-col
        rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92svh] sm:max-h-[90vh] overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            {headerAction}
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
