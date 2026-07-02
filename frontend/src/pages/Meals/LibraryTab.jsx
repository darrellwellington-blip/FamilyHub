import { useState, useEffect } from 'react'
import { mealsApi, shoppingApi } from '../../api'
import { useUser } from '../../UserContext'
import { Modal } from '../Tasks/TaskForm'
import MealFormModal from './MealFormModal'
import { MEAL_CATEGORIES, avgRating, fmtDate } from './mealUtils'
import RatingModal from './RatingModal'

// ── Star rating ───────────────────────────────────────────────────────────────

function Stars({ value, onChange, size = 'base', readonly = false }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" disabled={readonly}
          onClick={() => onChange?.(s)}
          className={`leading-none text-${size}
            ${(value ?? 0) >= s ? 'text-amber-400' : 'text-gray-200'}
            ${!readonly ? 'hover:text-amber-300 cursor-pointer' : 'cursor-default'}`}>
          ★
        </button>
      ))}
    </span>
  )
}

// ── Add-to-shopping modal ─────────────────────────────────────────────────────

function AddToShoppingModal({ ingredient, onClose }) {
  const [lists,    setLists]    = useState(null)
  const [listId,   setListId]   = useState('')
  const [newList,  setNewList]  = useState('')
  const [qty,      setQty]      = useState(ingredient.quantity ?? '')
  const [unit,     setUnit]     = useState(ingredient.unit ?? '')
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    shoppingApi.lists({ is_archived: false })
      .then(data => {
        const active = data.filter(l => !l.is_archived && !l.completed_at)
        setLists(active)
        if (active.length > 0) setListId(String(active[0].id))
      })
      .catch(() => setLists([]))
  }, [])

  const handleAdd = async () => {
    setSaving(true)
    try {
      let targetListId = listId
      if (listId === '__new') {
        const created = await shoppingApi.createList({ name: newList.trim() || 'Shopping List' })
        targetListId = created.id
      }
      await shoppingApi.addItem(targetListId, {
        name:     ingredient.name,
        quantity: qty ? Number(qty) || 1 : 1,
        unit:     unit || null,
      })
      setDone(true)
      setTimeout(onClose, 800)
    } catch {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Modal title="Added!" onClose={onClose} maxWidth="max-w-xs">
        <p className="text-sm text-green-600 text-center py-2">✓ {ingredient.name} added to shopping list</p>
      </Modal>
    )
  }

  return (
    <Modal title={`Add to Shopping — ${ingredient.name}`} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">Quantity</label>
            <input className="input" value={qty} onChange={e => setQty(e.target.value)} placeholder="1" />
          </div>
          <div className="flex-1">
            <label className="label">Unit</label>
            <input className="input" value={unit} onChange={e => setUnit(e.target.value)} placeholder="lbs, cups…" />
          </div>
        </div>
        <div>
          <label className="label">Shopping list</label>
          {lists === null ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (
            <select className="input" value={listId} onChange={e => setListId(e.target.value)}>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value="__new">+ Create new list</option>
            </select>
          )}
        </div>
        {listId === '__new' && (
          <div>
            <label className="label">New list name</label>
            <input className="input" value={newList} onChange={e => setNewList(e.target.value)}
              placeholder="e.g. This week's groceries" autoFocus />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleAdd}
            disabled={saving || lists === null || (!listId && listId !== '__new')}>
            {saving ? 'Adding…' : 'Add to List'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Meal card ─────────────────────────────────────────────────────────────────

function MealCard({ meal, onClick }) {
  const avg = avgRating(meal.ratings)
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100
        p-4 flex gap-3 hover:shadow-md transition-shadow group">
      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center
                      shrink-0 text-2xl overflow-hidden">
        {'🍳'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{meal.name}</p>
        {meal.category && (
          <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
            {meal.category}
          </span>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <Stars value={avg} readonly size="sm" />
          {avg != null && <span className="text-xs text-gray-400">{avg.toFixed(1)}</span>}
        </div>
        {meal.last_made_at && (
          <p className="text-xs text-gray-400 mt-0.5">Last made {fmtDate(meal.last_made_at)}</p>
        )}
      </div>
    </button>
  )
}

// ── Meal detail modal ─────────────────────────────────────────────────────────

function MealDetailModal({ meal, users, currentUser, onClose, onEdit, onDelete, onRate, onMadeToday }) {
  const [addingIngredient, setAddingIngredient] = useState(null)
  const [showRating, setShowRating] = useState(false)

  return (
    <Modal title={meal.name} onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">

        <div className="flex flex-wrap gap-2">
          {meal.category && (
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium">
              {meal.category}
            </span>
          )}
          {meal.last_made_at && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
              Last made {fmtDate(meal.last_made_at)}
            </span>
          )}
          {meal.min_frequency_days > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
              Every {meal.min_frequency_days}+ days
            </span>
          )}
        </div>

        {meal.description && <p className="text-sm text-gray-700">{meal.description}</p>}

        {/* Ingredients */}
        {meal.ingredients?.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ingredients</p>
              <span className="text-xs text-gray-400">{meal.ingredients.length} items</span>
            </div>
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
              {meal.ingredients.map(ing => (
                <div key={ing.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-gray-800 truncate">{ing.name}</span>
                    {(ing.quantity || ing.unit) && (
                      <span className="text-xs text-gray-400 shrink-0">
                        {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setAddingIngredient(ing)}
                    className="ml-3 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50
                               px-2 py-0.5 rounded shrink-0"
                    title="Add to shopping list"
                  >
                    + List
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {meal.recipe && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Recipe</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{meal.recipe}</p>
          </div>
        )}

        {/* Ratings summary */}
        {Object.keys(meal.ratings ?? {}).length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Ratings</p>
            <div className="flex flex-col gap-1.5">
              {(users ?? []).filter(u => meal.ratings?.[String(u.id)] != null).map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20 shrink-0">{u.name}</span>
                  <Stars value={meal.ratings[String(u.id)]} readonly size="sm" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          <button className="btn-secondary" onClick={onMadeToday}>Made it today</button>
          <button className="btn-secondary" onClick={() => setShowRating(true)}>⭐ Rate</button>
          <button className="btn-secondary" onClick={onEdit}>Edit</button>
          <button className="btn-danger ml-auto" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {showRating && (
        <RatingModal
          title={`Rate: ${meal.name}`}
          item={meal}
          users={users ?? []}
          onClose={() => setShowRating(false)}
          onRate={async (userId, rating) => { await onRate(meal.id, userId, rating) }}
        />
      )}

      {addingIngredient && (
        <AddToShoppingModal
          ingredient={addingIngredient}
          onClose={() => setAddingIngredient(null)}
        />
      )}
    </Modal>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function LibraryTab({ meals, onChanged }) {
  const { currentUser, users } = useUser()
  const [search,    setSearch]    = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [viewing,   setViewing]   = useState(null)
  const [editing,   setEditing]   = useState(null)

  const filtered = meals.filter(m => {
    if (catFilter && m.category !== catFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!m.name?.toLowerCase().includes(q) &&
          !m.description?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const allCats = [...new Set(meals.map(m => m.category).filter(Boolean))].sort()

  const handleRate = async (mealId, userId, rating) => {
    await mealsApi.rate(mealId, { user_id: userId, rating })
    await onChanged()
    setViewing(prev => prev
      ? { ...prev, ratings: { ...prev.ratings, [String(userId)]: rating } }
      : null
    )
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <input className="input max-w-xs" placeholder="Search meals…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-auto" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn-primary ml-auto" onClick={() => setEditing('new')}>+ Add Meal</button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🍳</p>
          <p>{meals.length === 0 ? 'No meals in the library yet.' : 'No meals match your filters.'}</p>
          {meals.length === 0 && (
            <button className="btn-primary mt-3" onClick={() => setEditing('new')}>Add your first meal</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(meal => (
            <MealCard key={meal.id} meal={meal} onClick={() => setViewing(meal)} />
          ))}
        </div>
      )}

      {viewing && (
        <MealDetailModal
          meal={viewing}
          users={users}
          currentUser={currentUser}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
          onDelete={async () => {
            if (!confirm(`Delete "${viewing.name}"?`)) return
            await mealsApi.delete(viewing.id)
            await onChanged()
            setViewing(null)
          }}
          onRate={handleRate}
          onMadeToday={async () => {
            await mealsApi.addHistory(viewing.id, { made_at: new Date().toISOString() })
            await onChanged()
            setViewing(prev => prev ? { ...prev, last_made_at: new Date().toISOString() } : null)
          }}
        />
      )}

      {editing && (
        <MealFormModal
          meal={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await onChanged(); setEditing(null) }}
        />
      )}
    </div>
  )
}
