import { useState, useEffect } from 'react'
import { mealsApi } from '../../api'
import { useUser } from '../../UserContext'
import { Modal } from '../Tasks/TaskForm'
import { avgRating, fmtDate, localNow } from './mealUtils'
import RatingModal, { Stars as SharedStars } from './RatingModal'

const VISIT_TYPES = ['dine-in', 'takeout', 'delivery']

// ── Star rating component ─────────────────────────────────────────────────────

function Stars({ value, onChange, readonly = false }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" disabled={readonly}
          onClick={() => onChange?.(s)}
          className={`leading-none text-base
            ${(value ?? 0) >= s ? 'text-amber-400' : 'text-gray-200'}
            ${!readonly ? 'hover:text-amber-300 cursor-pointer' : 'cursor-default'}`}>
          ★
        </button>
      ))}
    </span>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function RestaurantsTab({ restaurants, onChanged }) {
  const { currentUser, users } = useUser()
  const [search,    setSearch]    = useState('')
  const [viewing,   setViewing]   = useState(null)  // restaurant obj
  const [editing,   setEditing]   = useState(null)  // null | 'new' | restaurant obj
  const [importing, setImporting] = useState(false)

  const filtered = restaurants.filter(r =>
    !search ||
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.cuisine?.toLowerCase().includes(search.toLowerCase())
  )

  const handleRate = async (restId, userId, rating) => {
    await mealsApi.rateRestaurant(restId, { user_id: userId, rating })
    await onChanged()
    setViewing(prev => prev
      ? { ...prev, ratings: { ...prev.ratings, [String(userId)]: rating } }
      : null)
  }

  const handleDelete = async (rest) => {
    if (!confirm(`Delete "${rest.name}"?`)) return
    await mealsApi.deleteRestaurant(rest.id)
    await onChanged()
    setViewing(null)
  }

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <input className="input max-w-xs" placeholder="Search restaurants…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2 ml-auto">
          <button className="btn-secondary" onClick={() => setImporting(true)}>
            ⬇ Import from Claude
          </button>
          <button className="btn-primary" onClick={() => setEditing('new')}>
            + Add Restaurant
          </button>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p>{restaurants.length === 0
            ? 'No restaurants saved yet.'
            : 'No restaurants match your search.'}</p>
          {restaurants.length === 0 && (
            <button className="btn-primary mt-3" onClick={() => setEditing('new')}>
              Add your first restaurant
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(r => (
            <RestaurantCard key={r.id} restaurant={r} onClick={() => setViewing(r)} />
          ))}
        </div>
      )}

      {/* ── Detail modal ────────────────────────────────────────────── */}
      {viewing && (
        <RestaurantDetailModal
          restaurant={viewing}
          users={users}
          currentUser={currentUser}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
          onDelete={() => handleDelete(viewing)}
          onRate={handleRate}
          onVisitLogged={async () => { await onChanged() }}
        />
      )}

      {/* ── Form modal ──────────────────────────────────────────────── */}
      {editing && (
        <RestaurantFormModal
          restaurant={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await onChanged(); setEditing(null) }}
        />
      )}

      {/* ── Import modal ─────────────────────────────────────────────── */}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={async () => { await onChanged(); setImporting(false) }}
        />
      )}
    </div>
  )
}

// ── Restaurant card ───────────────────────────────────────────────────────────

function RestaurantCard({ restaurant: r, onClick }) {
  const avg = avgRating(r.ratings)
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100
        p-4 flex gap-3 hover:shadow-md transition-shadow group">
      <div className="w-14 h-14 rounded-lg bg-orange-50 flex items-center justify-center
                      shrink-0 text-2xl">
        🍽️
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{r.name}</p>
        {r.cuisine && (
          <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded
                           bg-orange-50 text-orange-600">
            {r.cuisine}
          </span>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <Stars value={avg} readonly />
          {avg != null && <span className="text-xs text-gray-400">{avg.toFixed(1)}</span>}
        </div>
        {r.address && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{r.address}</p>
        )}
      </div>
    </button>
  )
}

// ── Restaurant detail modal ───────────────────────────────────────────────────

function RestaurantDetailModal({
  restaurant, users, currentUser, onClose, onEdit, onDelete, onRate, onVisitLogged,
}) {
  const [visits,      setVisits]      = useState(null)  // null = not loaded
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [loggingVisit,  setLoggingVisit]  = useState(false)

  const [showRating, setShowRating] = useState(false)

  const loadVisits = async () => {
    if (visits !== null) return
    setLoadingVisits(true)
    try {
      const data = await mealsApi.listVisits(restaurant.id)
      setVisits(data)
    } finally {
      setLoadingVisits(false)
    }
  }

  const handleVisitSaved = async () => {
    setLoggingVisit(false)
    setLoadingVisits(true)
    try {
      const data = await mealsApi.listVisits(restaurant.id)
      setVisits(data)
    } finally {
      setLoadingVisits(false)
    }
    await onVisitLogged()
  }

  return (
    <Modal title={restaurant.name} onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2">
          {restaurant.cuisine && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-600 font-medium">
              {restaurant.cuisine}
            </span>
          )}
          {restaurant.address && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
              📍 {restaurant.address}
            </span>
          )}
          {restaurant.phone && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
              📞 {restaurant.phone}
            </span>
          )}
          {restaurant.website && (
            <a href={restaurant.website} target="_blank" rel="noreferrer"
              className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 hover:underline"
              onClick={e => e.stopPropagation()}>
              🔗 Website
            </a>
          )}
        </div>

        {/* Notes */}
        {restaurant.notes && (
          <p className="text-sm text-gray-700">{restaurant.notes}</p>
        )}

        {/* Ratings */}
        {Object.keys(restaurant.ratings ?? {}).length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Family Ratings
            </p>
            <div className="flex flex-col gap-1.5">
              {(users ?? []).filter(u => restaurant.ratings?.[String(u.id)] != null).map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20 shrink-0">{u.name}</span>
                  <SharedStars value={restaurant.ratings[String(u.id)]} readonly size="text-base" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visit history section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Visit History
            </p>
            {visits === null && !loadingVisits && (
              <button className="text-xs text-indigo-600 hover:underline" onClick={loadVisits}>
                Load history
              </button>
            )}
          </div>

          {loadingVisits && <p className="text-sm text-gray-400">Loading…</p>}

          {visits !== null && visits.length === 0 && (
            <p className="text-sm text-gray-400">No visits logged yet.</p>
          )}

          {visits !== null && visits.length > 0 && (
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
              {visits.map(v => (
                <div key={v.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-500">{fmtDate(v.visited_at)}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 capitalize">
                      {v.visit_type}
                    </span>
                  </div>
                  {v.items?.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {v.items.map(item => (
                        <div key={item.id} className="flex items-start gap-2 text-xs">
                          <span className="font-medium text-gray-600 w-16 shrink-0">{item.user_name ?? '?'}</span>
                          <span className="text-gray-500 flex-1">{item.item_name ?? '—'}</span>
                          {item.rating && <Stars value={item.rating} readonly />}
                        </div>
                      ))}
                    </div>
                  )}
                  {v.notes && <p className="text-xs text-gray-400 italic">{v.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          <button className="btn-secondary" onClick={() => setLoggingVisit(true)}>Log Visit</button>
          <button className="btn-secondary" onClick={() => setShowRating(true)}>⭐ Rate</button>
          <button className="btn-secondary" onClick={onEdit}>Edit</button>
          <button className="btn-danger ml-auto" onClick={onDelete}>Delete</button>
        </div>

      </div>

      {showRating && (
        <RatingModal
          title={`Rate: ${restaurant.name}`}
          item={restaurant}
          users={users ?? []}
          onClose={() => setShowRating(false)}
          onRate={async (userId, rating) => {
            await onRate(restaurant.id, userId, rating)
          }}
        />
      )}

      {/* Log visit modal — nested */}
      {loggingVisit && (
        <LogVisitModal
          restaurant={restaurant}
          currentUser={currentUser}
          onClose={() => setLoggingVisit(false)}
          onSaved={handleVisitSaved}
        />
      )}
    </Modal>
  )
}

// ── Log visit modal ───────────────────────────────────────────────────────────

function LogVisitModal({ restaurant, currentUser, onClose, onSaved }) {
  const { users } = useUser()
  const [visitType, setVisitType] = useState('dine-in')
  const [visitedAt, setVisitedAt] = useState(localNow)
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  // Per-person entries: { userId -> { order: '', rating: null } }
  const [attendees, setAttendees] = useState(() => {
    const init = {}
    if (currentUser) init[currentUser.id] = { order: '', rating: null }
    return init
  })

  const toggleAttendee = (userId) => {
    setAttendees(prev => {
      const next = { ...prev }
      if (next[userId]) delete next[userId]
      else next[userId] = { order: '', rating: null }
      return next
    })
  }

  const setOrder  = (uid, val) => setAttendees(p => ({ ...p, [String(uid)]: { ...p[String(uid)], order: val } }))
  const setRating = (uid, val) => setAttendees(p => ({ ...p, [String(uid)]: { ...p[String(uid)], rating: val } }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const items = Object.entries(attendees).map(([uid, data]) => ({
        user_id:   Number(uid),
        item_name: data.order.trim() || null,
        rating:    data.rating,
      }))
      await mealsApi.createVisit(restaurant.id, {
        visited_at: visitedAt ? new Date(visitedAt).toISOString() : new Date().toISOString(),
        visit_type: visitType,
        notes:      notes.trim() || null,
        items,
      })
      await onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Log Visit — ${restaurant.name}`} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Visit type */}
        <div>
          <label className="label">Visit type</label>
          <div className="flex gap-2">
            {VISIT_TYPES.map(vt => (
              <button key={vt} type="button" onClick={() => setVisitType(vt)}
                className={`btn border text-sm capitalize ${
                  visitType === vt
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {vt}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="label">Date &amp; time</label>
          <input type="datetime-local" className="input" value={visitedAt}
            onChange={e => setVisitedAt(e.target.value)} />
        </div>

        {/* Who came */}
        <div>
          <label className="label">Who came?</label>
          <div className="flex flex-wrap gap-2">
            {users.map(u => {
              const on = !!attendees[u.id]
              return (
                <button key={u.id} type="button" onClick={() => toggleAttendee(u.id)}
                  className={`btn border text-sm ${on
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {u.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Per-person orders + ratings */}
        {Object.keys(attendees).length > 0 && (
          <div className="flex flex-col gap-3">
            <label className="label mb-0">Orders &amp; ratings</label>
            {Object.entries(attendees).map(([uid, data]) => {
              const user = users.find(u => u.id === Number(uid))
              return (
                <div key={uid} className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-col gap-2">
                  <p className="text-sm font-medium text-gray-700">{user?.name ?? 'Unknown'}</p>
                  <input className="input text-sm" placeholder="What did they order?"
                    value={data.order} onChange={e => setOrder(uid, e.target.value)} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Rating:</span>
                    <Stars value={data.rating} onChange={v => setRating(uid, v)} />
                    {data.rating && (
                      <button type="button" onClick={() => setRating(Number(uid), null)}
                        className="text-xs text-gray-300 hover:text-gray-500">clear</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* General notes */}
        <div>
          <label className="label">General notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea className="input resize-none" rows={2}
            placeholder="Overall impressions, wait time, ambiance…"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary w-full sm:w-auto justify-center" disabled={saving}>
            {saving ? 'Saving…' : 'Log Visit'}
          </button>
        </div>

      </form>
    </Modal>
  )
}

// ── Import from Claude modal ──────────────────────────────────────────────────

const CLAUDE_PROMPT = `Generate a list of restaurants as a JSON array. Use exactly this format (include all fields, use null if unknown):
[
  {
    "name": "Restaurant Name",
    "cuisine": "Cuisine type",
    "address": "Street address",
    "phone": "Phone number",
    "website": "https://example.com",
    "notes": "Notable dishes, hours, parking, etc."
  }
]`

function parseClaudeResponse(text) {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  // Find the first [ or { to locate the JSON
  const start = stripped.search(/[\[{]/)
  if (start === -1) throw new Error('No JSON found in the pasted text')
  const jsonText = stripped.slice(start)
  let parsed = JSON.parse(jsonText)
  if (!Array.isArray(parsed)) parsed = [parsed]
  return parsed.map(r => ({
    name:    (r.name    ?? '').toString().trim(),
    cuisine: (r.cuisine ?? '') || null,
    address: (r.address ?? '') || null,
    phone:   (r.phone   ?? '') || null,
    website: (r.website ?? '') || null,
    notes:   (r.notes   ?? '') || null,
  })).filter(r => r.name)
}

function ImportModal({ onClose, onImported }) {
  const [step,      setStep]      = useState('paste') // 'paste' | 'preview'
  const [text,      setText]      = useState('')
  const [parsed,    setParsed]    = useState([])
  const [parseErr,  setParseErr]  = useState(null)
  const [selected,  setSelected]  = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState(null)
  const [copied,    setCopied]    = useState(false)

  const copyPrompt = () => {
    navigator.clipboard.writeText(CLAUDE_PROMPT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleParse = () => {
    setParseErr(null)
    try {
      const rows = parseClaudeResponse(text)
      if (rows.length === 0) { setParseErr('No valid restaurants found — check the format.'); return }
      setParsed(rows)
      setSelected(new Set(rows.map((_, i) => i)))
      setStep('preview')
    } catch (e) {
      setParseErr(`Could not parse: ${e.message}`)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setImportErr(null)
    try {
      const toAdd = parsed.filter((_, i) => selected.has(i))
      await Promise.all(toAdd.map(r => mealsApi.createRestaurant(r)))
      await onImported()
    } catch (e) {
      setImportErr(e.message)
      setImporting(false)
    }
  }

  const toggleAll = () => {
    setSelected(prev => prev.size === parsed.length ? new Set() : new Set(parsed.map((_, i) => i)))
  }

  if (step === 'paste') {
    return (
      <Modal title="Import Restaurants from Claude" onClose={onClose} maxWidth="max-w-lg">
        <div className="flex flex-col gap-4">

          {/* Step 1: copy the prompt */}
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
            <p className="text-sm font-semibold text-indigo-800 mb-2">
              Step 1 — Ask Claude to generate the list
            </p>
            <p className="text-xs text-indigo-700 mb-3">
              Copy the prompt below, paste it into Claude, and add your city or any other details.
            </p>
            <pre className="text-xs bg-white rounded-lg border border-indigo-100 p-3 whitespace-pre-wrap text-gray-700 max-h-36 overflow-y-auto">
              {CLAUDE_PROMPT}
            </pre>
            <button type="button" onClick={copyPrompt}
              className={`mt-3 btn border text-sm w-full justify-center transition-colors ${
                copied ? 'border-green-400 bg-green-50 text-green-700' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-100'
              }`}>
              {copied ? '✓ Copied!' : '📋 Copy prompt'}
            </button>
          </div>

          {/* Step 2: paste response */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Step 2 — Paste Claude's response
            </p>
            <textarea
              className="input resize-none font-mono text-xs"
              rows={8}
              placeholder={'Paste Claude\'s JSON response here…\n[\n  { "name": "...", "cuisine": "...", ... },\n  ...\n]'}
              value={text}
              onChange={e => { setText(e.target.value); setParseErr(null) }}
            />
            {parseErr && <p className="text-sm text-red-600 mt-1">{parseErr}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleParse} disabled={!text.trim()}>
              Preview →
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // Preview step
  return (
    <Modal title={`Import ${selected.size} of ${parsed.length} restaurants`} onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Uncheck any you don't want to import.
          </p>
          <button type="button" onClick={toggleAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            {selected.size === parsed.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto flex flex-col gap-2">
          {parsed.map((r, i) => (
            <label key={i}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                selected.has(i)
                  ? 'border-indigo-200 bg-indigo-50'
                  : 'border-gray-100 bg-gray-50 opacity-50'
              }`}>
              <input type="checkbox" className="mt-0.5 shrink-0"
                checked={selected.has(i)}
                onChange={() => setSelected(prev => {
                  const next = new Set(prev)
                  next.has(i) ? next.delete(i) : next.add(i)
                  return next
                })} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {r.cuisine && <span className="text-xs text-orange-600">{r.cuisine}</span>}
                  {r.address && <span className="text-xs text-gray-400">📍 {r.address}</span>}
                  {r.phone   && <span className="text-xs text-gray-400">📞 {r.phone}</span>}
                </div>
                {r.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.notes}</p>}
              </div>
            </label>
          ))}
        </div>

        {importErr && <p className="text-sm text-red-600">{importErr}</p>}

        <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={() => setStep('paste')}>← Back</button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleImport}
              disabled={importing || selected.size === 0}>
              {importing ? 'Importing…' : `Import ${selected.size}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Restaurant form modal ─────────────────────────────────────────────────────

function RestaurantFormModal({ restaurant, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:    restaurant?.name    ?? '',
    cuisine: restaurant?.cuisine ?? '',
    address: restaurant?.address ?? '',
    phone:   restaurant?.phone   ?? '',
    website: restaurant?.website ?? '',
    notes:   restaurant?.notes   ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:    form.name.trim(),
        cuisine: form.cuisine.trim() || null,
        address: form.address.trim() || null,
        phone:   form.phone.trim()   || null,
        website: form.website.trim() || null,
        notes:   form.notes.trim()   || null,
      }
      restaurant
        ? await mealsApi.updateRestaurant(restaurant.id, payload)
        : await mealsApi.createRestaurant(payload)
      await onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={restaurant ? 'Edit Restaurant' : 'Add Restaurant'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div>
          <label className="label">Name <span className="text-red-500">*</span></label>
          <input className="input" value={form.name}
            onChange={e => set('name', e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Cuisine type</label>
            <input className="input" placeholder="e.g. Italian, Thai…"
              value={form.cuisine} onChange={e => set('cuisine', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={form.phone}
              onChange={e => set('phone', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Address</label>
          <input className="input" value={form.address}
            onChange={e => set('address', e.target.value)} />
        </div>

        <div>
          <label className="label">Website</label>
          <input className="input" type="url" placeholder="https://…"
            value={form.website} onChange={e => set('website', e.target.value)} />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2}
            placeholder="Parking, hours, favourite dishes…"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : restaurant ? 'Save Changes' : 'Add Restaurant'}
          </button>
        </div>

      </form>
    </Modal>
  )
}
