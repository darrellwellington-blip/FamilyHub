import { useState } from 'react'
import { mealsApi } from '../../api'
import { useUser } from '../../UserContext'
import { Modal } from '../Tasks/TaskForm'
import { MEAL_CATEGORIES, fmtDate } from './mealUtils'

const VOTES = [
  { key: 'yes',   icon: '👍', label: 'Want it', activeClass: 'bg-green-100 text-green-700 border-green-400' },
  { key: 'maybe', icon: '🤷', label: 'Maybe',   activeClass: 'bg-amber-100 text-amber-700 border-amber-400' },
  { key: 'no',    icon: '👎', label: 'No thanks',activeClass: 'bg-red-100   text-red-700   border-red-400'   },
]

export default function TryTab({ tryList, onChanged, onPromoted }) {
  const { currentUser, users } = useUser()
  const [adding,    setAdding]    = useState(false)
  const [promoting, setPromoting] = useState(null) // try obj

  const handleVote = async (tryId, vote) => {
    if (!currentUser) return
    await mealsApi.vote(tryId, { user_id: currentUser.id, vote })
    await onChanged()
  }

  const handleDelete = async (tryId, name) => {
    if (!confirm(`Remove "${name}" from the list?`)) return
    await mealsApi.deleteTry(tryId)
    await onChanged()
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          Suggest meals to add to the family rotation. Vote to build consensus, then promote the winners to the Library.
        </p>
        <button className="btn-primary shrink-0 ml-4" onClick={() => setAdding(true)}>
          + Suggest Meal
        </button>
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      {tryList.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🌟</p>
          <p>No meal suggestions yet. Be the first to suggest one!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tryList.map(item => (
            <TryCard
              key={item.id}
              item={item}
              users={users}
              currentUser={currentUser}
              onVote={handleVote}
              onPromote={() => setPromoting(item)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          ))}
        </div>
      )}

      {/* ── Add modal ───────────────────────────────────────────────── */}
      {adding && (
        <TryFormModal
          onClose={() => setAdding(false)}
          onSaved={async () => { await onChanged(); setAdding(false) }}
          currentUser={currentUser}
        />
      )}

      {/* ── Promote modal ───────────────────────────────────────────── */}
      {promoting && (
        <PromoteModal
          item={promoting}
          onClose={() => setPromoting(null)}
          onPromoted={async () => { await onPromoted(); setPromoting(null) }}
        />
      )}
    </div>
  )
}

// ── Try card ──────────────────────────────────────────────────────────────────

function TryCard({ item, users, currentUser, onVote, onPromote, onDelete }) {
  const myVote = item.votes?.[String(currentUser?.id)] ?? null

  const voteCounts = VOTES.map(v => ({
    ...v,
    count: Object.values(item.votes ?? {}).filter(vote => vote === v.key).length,
    voters: (users ?? []).filter(u => item.votes?.[String(u.id)] === v.key).map(u => u.name),
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center
                        shrink-0 text-2xl overflow-hidden">
          {'🍽️'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{item.name}</p>
              {item.description && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Suggested {fmtDate(item.proposed_at)}
              </p>
            </div>
            <button onClick={onDelete}
              className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
              title="Remove suggestion">
              ×
            </button>
          </div>

          {/* Vote counts */}
          <div className="flex flex-wrap gap-3 mt-2">
            {voteCounts.map(v => (
              <div key={v.key} title={v.voters.join(', ') || 'No votes'}
                className="flex items-center gap-1 text-sm text-gray-500">
                <span>{v.icon}</span>
                <span className="text-xs font-medium">{v.count}</span>
              </div>
            ))}
          </div>

          {/* Vote buttons for current user */}
          {currentUser && (
            <div className="flex gap-2 mt-3">
              {VOTES.map(v => (
                <button key={v.key} type="button"
                  onClick={() => onVote(item.id, v.key)}
                  className={`btn border text-xs ${
                    myVote === v.key
                      ? v.activeClass
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Promote to library */}
      <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
        <button className="btn-secondary text-xs" onClick={onPromote}>
          ✓ Promote to Library
        </button>
      </div>
    </div>
  )
}

// ── Add suggestion modal ──────────────────────────────────────────────────────

function TryFormModal({ onClose, onSaved, currentUser }) {
  const [name,    setName]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      await mealsApi.createTry({
        name:        name.trim(),
        description: desc.trim() || null,
        proposed_by: currentUser?.id ?? null,
      })
      await onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Suggest a Meal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Meal name <span className="text-red-500">*</span></label>
          <input className="input" placeholder="e.g. Thai Green Curry"
            value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea className="input resize-none" rows={2}
            placeholder="Where did you see it? Why try it?"
            value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Suggest'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Promote modal ─────────────────────────────────────────────────────────────

function PromoteModal({ item, onClose, onPromoted }) {
  const [category,  setCategory]  = useState('')
  const [recipe,    setRecipe]    = useState('')
  const [minDays,   setMinDays]   = useState(0)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await mealsApi.promote(item.id, {
        category:           category || null,
        recipe:             recipe.trim() || null,
        min_frequency_days: Number(minDays) || 0,
      })
      await onPromoted()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Promote: ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          This will add <strong>{item.name}</strong> to the meal library. You can fill in details now or edit later.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— None —</option>
              {MEAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Min days between</label>
            <input type="number" min="0" className="input" value={minDays}
              onChange={e => setMinDays(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Recipe / Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea className="input resize-none" rows={3}
            placeholder="Ingredients, steps…"
            value={recipe} onChange={e => setRecipe(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Promoting…' : 'Add to Library'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
