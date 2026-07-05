import { useState, useEffect } from 'react'
import { mealsApi, usersApi } from '../../api'
import { useUser } from '../../UserContext'
import { Modal } from '../Tasks/TaskForm'
import RatingModal from './RatingModal'
import MealFormModal from './MealFormModal'
import {
  getMonday, toISO, addDays, fmtWeekRange,
  DAY_LABELS, DAY_NAMES, MEAL_TYPES, MEAL_TYPE_LABELS,
} from './mealUtils'

export default function MealPlanTab({ meals, restaurants, onMealsChanged }) {
  const [weekStart,    setWeekStart]    = useState(() => getMonday())
  const [plan,         setPlan]         = useState(null)
  const [editingSlot,  setEditingSlot]  = useState(null) // { day, mealType, slot }
  const [ratingSlot,   setRatingSlot]   = useState(null) // slot to rate
  const { users } = useUser()
  const [loadingPlan,  setLoadingPlan]  = useState(false)

  const weekISO = toISO(weekStart)
  const todayISO = toISO(new Date())

  useEffect(() => {
    setLoadingPlan(true)
    mealsApi.getWeekPlan(weekISO)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoadingPlan(false))
  }, [weekISO])

  const handleSlotSaved = async () => {
    const updated = await mealsApi.getWeekPlan(weekISO)
    setPlan(updated)
    setEditingSlot(null)
  }

  const isThisWeek = weekISO === toISO(getMonday())

  return (
    <div>
      {/* ── Week navigation ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setWeekStart(d => addDays(d, -7))}>
            ← Prev
          </button>
          <button className="btn-secondary" onClick={() => setWeekStart(d => addDays(d, 7))}>
            Next →
          </button>
          {!isThisWeek && (
            <button className="btn-secondary text-xs" onClick={() => setWeekStart(getMonday())}>
              This week
            </button>
          )}
        </div>
        <p className="text-sm font-medium text-gray-700">
          {isThisWeek && <span className="text-indigo-600 mr-1">This week · </span>}
          {fmtWeekRange(weekStart)}
        </p>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {loadingPlan ? (
        <p className="text-gray-400 text-center py-12">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-20 py-3 pr-2 text-right text-xs text-gray-400 font-medium uppercase tracking-wide" />
                {DAY_LABELS.map((day, i) => {
                  const date    = addDays(weekStart, i)
                  const dateISO = toISO(date)
                  const isToday = dateISO === todayISO
                  return (
                    <th key={day}
                      className={`py-3 px-2 text-center text-xs font-semibold ${
                        isToday ? 'text-indigo-700' : 'text-gray-600'
                      }`}
                    >
                      <div>{day}</div>
                      <div className={`font-normal mt-0.5 ${isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {MEAL_TYPES.map((mealType, mi) => (
                <tr key={mealType} className={mi < MEAL_TYPES.length - 1 ? 'border-b border-gray-50' : ''}>
                  <td className="py-2 pr-3 text-right text-xs text-gray-400 font-medium uppercase tracking-wide align-top pt-3">
                    {MEAL_TYPE_LABELS[mealType]}
                  </td>
                  {[0,1,2,3,4,5,6].map(day => {
                    const slot    = plan?.slots?.[day]?.[mealType] ?? null
                    const dateISO = toISO(addDays(weekStart, day))
                    const isToday = dateISO === todayISO
                    return (
                      <td key={day}
                        onClick={() => setEditingSlot({ day, mealType, slot })}
                        className={`h-16 p-1 border-l border-gray-50 cursor-pointer transition-colors
                          ${isToday ? 'bg-indigo-50/40' : ''}
                          hover:bg-indigo-50/60 group`}
                      >
                        <SlotCell slot={slot}
                          onRate={e => { e.stopPropagation(); setRatingSlot(slot) }} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Slot edit modal ───────────────────────────────────────────── */}
      {ratingSlot && (() => {
        const isMeal = ratingSlot.slot_type === 'meal' && ratingSlot.meal
        const isRest = ratingSlot.slot_type === 'restaurant' && ratingSlot.restaurant
        if (!isMeal && !isRest) return null
        const item = isMeal ? ratingSlot.meal : ratingSlot.restaurant
        return (
          <RatingModal
            title={`Rate: ${item.name}`}
            item={item}
            users={users}
            attendeeIds={ratingSlot.attendees ?? []}
            onClose={() => setRatingSlot(null)}
            onRate={async (userId, rating) => {
              if (isMeal) await mealsApi.rate(ratingSlot.meal.id, { user_id: userId, rating })
              else await mealsApi.rateRestaurant(ratingSlot.restaurant.id, { user_id: userId, rating })
            }}
          />
        )
      })()}

      {editingSlot && (
        <SlotModal
          slot={editingSlot.slot}
          day={editingSlot.day}
          mealType={editingSlot.mealType}
          weekISO={weekISO}
          meals={meals}
          restaurants={restaurants}
          onClose={() => setEditingSlot(null)}
          onSaved={handleSlotSaved}
          onMealsChanged={onMealsChanged}
        />
      )}
    </div>
  )
}

// ── Slot cell ─────────────────────────────────────────────────────────────────

function SlotCell({ slot, onRate }) {
  if (!slot || slot.slot_type === 'empty') {
    return (
      <div className="flex items-center justify-center h-full text-gray-200 text-xl group-hover:text-gray-400 transition-colors">
        +
      </div>
    )
  }

  const canRate = (slot.slot_type === 'meal' && slot.meal) ||
                  (slot.slot_type === 'restaurant' && slot.restaurant)

  const RateBtn = canRate ? (
    <button type="button" onClick={onRate}
      className="absolute top-0.5 right-0.5 text-gray-300 hover:text-amber-400 text-xs leading-none"
      title="Rate">★</button>
  ) : null

  if (slot.slot_type === 'meal' && slot.meal) {
    return (
      <div className="relative h-full px-1.5 py-1 overflow-hidden">
        {RateBtn}
        <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">
          {slot.meal.name}
        </p>
        {slot.sides_note && (
          <p className="text-xs text-gray-400 leading-tight truncate mt-0.5">
            + {slot.sides_note}
          </p>
        )}
      </div>
    )
  }
  if (slot.slot_type === 'restaurant' && slot.restaurant) {
    const orderCount = slot.orders?.length ?? 0
    return (
      <div className="relative h-full px-1.5 py-1 overflow-hidden">
        {RateBtn}
        <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">
          🍽️ {slot.restaurant.name}
        </p>
        {orderCount > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">{orderCount} dish{orderCount !== 1 ? 'es' : ''}</p>
        )}
      </div>
    )
  }
  if (slot.slot_type === 'leftovers') {
    return (
      <div className="h-full px-1.5 py-1">
        <p className="text-xs font-medium text-gray-600">📦 Leftovers</p>
        {slot.leftovers_note && (
          <p className="text-xs text-gray-400 leading-tight truncate mt-0.5">{slot.leftovers_note}</p>
        )}
      </div>
    )
  }
  if (slot.slot_type === 'out') {
    return (
      <div className="h-full px-1.5 py-1">
        <p className="text-xs font-medium text-gray-600">🚗 Out</p>
      </div>
    )
  }
  return null
}

// ── Restaurant orders ─────────────────────────────────────────────────────────

function OrdersSection({ orders, attendeeIds, users, onChange }) {
  const [inputs, setInputs] = useState({}) // keyed by userId (null = shared)

  const setInput = (key, val) => setInputs(p => ({ ...p, [key]: val }))

  const addDish = (userId) => {
    const key = userId ?? 'shared'
    const name = (inputs[key] ?? '').trim()
    if (!name) return
    onChange(prev => [...prev, { user_id: userId ?? null, dish_name: name }])
    setInput(key, '')
  }

  const removeDish = (idx) => onChange(prev => prev.filter((_, i) => i !== idx))

  const rows = [
    { key: 'shared', userId: null, label: 'Shared' },
    ...attendeeIds.map(id => ({
      key: String(id),
      userId: id,
      label: users.find(u => u.id === id)?.name ?? `User ${id}`,
    })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <label className="label mb-0">What did everyone order?</label>
      {rows.map(({ key, userId, label }) => {
        const myDishes = orders.filter(o => (o.user_id ?? null) === (userId ?? null))
        return (
          <div key={key}>
            <p className="text-xs font-medium text-gray-500 mb-1">
              {userId === null ? '🍽️ Shared / for the table' : `👤 ${label}`}
            </p>
            <div className="flex flex-wrap gap-1 mb-1">
              {myDishes.map((d, i) => {
                const globalIdx = orders.indexOf(d)
                return (
                  <span key={i}
                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    {d.dish_name}
                    <button type="button" onClick={() => removeDish(globalIdx)}
                      className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                  </span>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input
                className="input py-1 text-sm flex-1"
                placeholder={userId === null ? 'e.g. Garlic bread, Calamari…' : 'Dish name…'}
                value={inputs[key] ?? ''}
                onChange={e => setInput(key, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDish(userId) } }}
              />
              <button type="button" className="btn-secondary text-sm px-3"
                onClick={() => addDish(userId)}>Add</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Slot edit modal ───────────────────────────────────────────────────────────

const SLOT_TYPES = [
  { key: 'meal',       icon: '🍳', label: 'Home-cooked' },
  { key: 'restaurant', icon: '🍽️', label: 'Restaurant' },
  { key: 'leftovers',  icon: '📦', label: 'Leftovers' },
  { key: 'out',        icon: '🚗', label: 'Out' },
  { key: 'empty',      icon: '✕',  label: 'Clear' },
]

function SlotModal({ slot, day, mealType, weekISO, meals, restaurants, onClose, onSaved, onMealsChanged }) {
  const { users, reloadUsers } = useUser()
  const [slotType,      setSlotType]      = useState(slot?.slot_type ?? 'empty')
  const [mealId,        setMealId]        = useState(slot?.meal_id       ?? null)
  const [restaurantId,  setRestaurantId]  = useState(slot?.restaurant_id ?? null)
  const [leftoversNote, setLeftoversNote] = useState(slot?.leftovers_note ?? '')
  const [attendees,     setAttendees]     = useState(() => new Set(slot?.attendees ?? []))
  const [cookId,        setCookId]        = useState(slot?.cook_id ?? null)
  const [ratingOpen,    setRatingOpen]    = useState(false)
  const [search,        setSearch]        = useState('')
  const [sidesNote,     setSidesNote]     = useState(slot?.sides_note ?? '')
  const [orders,        setOrders]        = useState(slot?.orders ?? [])
  const [saving,        setSaving]        = useState(false)
  const [addingMeal,    setAddingMeal]    = useState(false)
  const [addingRest,    setAddingRest]    = useState(false)
  const [newRestName,   setNewRestName]   = useState('')
  const [newRestCuisine,setNewRestCuisine]= useState('')
  const [savingRest,    setSavingRest]    = useState(false)

  const title = `${DAY_NAMES[day]} ${MEAL_TYPE_LABELS[mealType]}`

  const toggleAttendee = (uid) => setAttendees(prev => {
    const next = new Set(prev)
    next.has(uid) ? next.delete(uid) : next.add(uid)
    return next
  })

  const [showNewPerson,  setShowNewPerson]  = useState(false)
  const [newPersonName,  setNewPersonName]  = useState('')
  const [savingPerson,   setSavingPerson]   = useState(false)

  const handleAddPerson = async () => {
    const name = newPersonName.trim()
    if (!name) return
    setSavingPerson(true)
    try {
      const created = await usersApi.create({ name })
      await reloadUsers()
      setAttendees(prev => new Set([...prev, created.id]))
      setNewPersonName('')
      setShowNewPerson(false)
    } finally {
      setSavingPerson(false) }
  }

  const handleAddRestaurant = async () => {
    if (!newRestName.trim()) return
    setSavingRest(true)
    try {
      const created = await mealsApi.createRestaurant({
        name: newRestName.trim(),
        cuisine: newRestCuisine.trim() || null,
      })
      if (onMealsChanged) await onMealsChanged()
      setRestaurantId(created.id)
      setAddingRest(false)
      setNewRestName('')
      setNewRestCuisine('')
    } finally {
      setSavingRest(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await mealsApi.updateSlot(weekISO, day, mealType, {
        slot_type:      slotType,
        meal_id:        slotType === 'meal'       ? mealId        : null,
        restaurant_id:  slotType === 'restaurant' ? restaurantId  : null,
        leftovers_note: slotType === 'leftovers'  ? leftoversNote.trim() || null : null,
        attendees:      [...attendees],
        cook_id:        slotType === 'meal' ? cookId : null,
        sides_note:     slotType === 'meal'       ? (sidesNote.trim() || null) : null,
        orders:         slotType === 'restaurant' ? orders : [],
      })
      await onSaved()
    } catch {
      setSaving(false)
    }
  }

  const filteredMeals = meals.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // When a new meal is created from this modal, refresh the library and auto-select it
  const handleNewMealSaved = async (saved) => {
    setAddingMeal(false)
    if (onMealsChanged) await onMealsChanged()
    setMealId(saved.id)
    setSearch('')
  }

  return (
    <>
      <Modal title={title} onClose={onClose} maxWidth="max-w-md">
        <div className="flex flex-col gap-4">

          {/* Slot type */}
          <div className="flex flex-wrap gap-2">
            {SLOT_TYPES.map(t => (
              <button key={t.key} type="button"
                onClick={() => setSlotType(t.key)}
                className={`btn border text-sm ${
                  slotType === t.key
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Meal picker */}
          {slotType === 'meal' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Choose a meal</label>
                <button type="button" onClick={() => setAddingMeal(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  + New Meal
                </button>
              </div>
              <input className="input mb-2" placeholder="Search…"
                value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              <div className="max-h-52 overflow-y-auto flex flex-col rounded-lg border border-gray-100">
                {filteredMeals.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-6">
                    {meals.length === 0
                      ? <span>No meals yet. <button type="button" onClick={() => setAddingMeal(true)}
                          className="text-indigo-600 underline">Add one</button></span>
                      : 'No matches.'}
                  </div>
                ) : filteredMeals.map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setMealId(m.id)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      mealId === m.id
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    {m.name}
                    {m.category && (
                      <span className="text-xs text-gray-400 ml-2">{m.category}</span>
                    )}
                    {mealId === m.id && <span className="float-right text-indigo-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Restaurant picker */}
          {slotType === 'restaurant' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Choose a restaurant</label>
                <button type="button"
                  onClick={() => { setAddingRest(v => !v); setNewRestName(''); setNewRestCuisine('') }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  {addingRest ? 'Cancel' : '+ New'}
                </button>
              </div>

              {addingRest && (
                <div className="mb-3 flex flex-col gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                  <input className="input text-sm" placeholder="Restaurant name"
                    value={newRestName} onChange={e => setNewRestName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddRestaurant()} />
                  <input className="input text-sm" placeholder="Cuisine (optional)"
                    value={newRestCuisine} onChange={e => setNewRestCuisine(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddRestaurant()} />
                  <button type="button" className="btn-primary text-sm justify-center"
                    onClick={handleAddRestaurant} disabled={savingRest || !newRestName.trim()}>
                    {savingRest ? 'Adding…' : 'Add & Select'}
                  </button>
                </div>
              )}

              {restaurants.length === 0 && !addingRest ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No restaurants yet — tap + New to add one.
                </p>
              ) : (
                <div className="flex flex-col rounded-lg border border-gray-100 max-h-52 overflow-y-auto">
                  {restaurants.map(r => (
                    <button key={r.id} type="button"
                      onClick={() => setRestaurantId(r.id)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        restaurantId === r.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}>
                      {r.name}
                      {r.cuisine && <span className="text-xs text-gray-400 ml-2">{r.cuisine}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Restaurant orders */}
          {slotType === 'restaurant' && restaurantId && (
            <OrdersSection
              orders={orders}
              attendeeIds={[...attendees]}
              users={users}
              onChange={setOrders}
            />
          )}

          {/* Side dishes */}
          {slotType === 'meal' && (
            <div>
              <label className="label">Side dishes <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex flex-wrap gap-1 mb-2">
                {meals.filter(m => m.category === 'Side Dish').map(m => {
                  const already = sidesNote.toLowerCase().includes(m.name.toLowerCase())
                  return (
                    <button key={m.id} type="button"
                      onClick={() => {
                        if (already) {
                          setSidesNote(prev => prev.split(',').map(s => s.trim()).filter(s => s.toLowerCase() !== m.name.toLowerCase()).join(', '))
                        } else {
                          setSidesNote(prev => prev.trim() ? `${prev.trim()}, ${m.name}` : m.name)
                        }
                      }}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        already
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                      }`}>
                      {already ? '✓ ' : ''}{m.name}
                    </button>
                  )
                })}
              </div>
              <input className="input" placeholder="e.g. Mashed potatoes, green beans…"
                value={sidesNote} onChange={e => setSidesNote(e.target.value)} />
            </div>
          )}

          {/* Who's joining */}
          {slotType !== 'empty' && (
            <div>
              <label className="label">Who's joining?</label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <button key={u.id} type="button" onClick={() => toggleAttendee(u.id)}
                    className={`btn border text-sm ${attendees.has(u.id)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {u.name}
                  </button>
                ))}
                <div className="relative">
                  <button type="button"
                    onClick={() => { setShowNewPerson(v => !v); setNewPersonName('') }}
                    className="btn border text-sm border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500">
                    + New
                  </button>
                  {showNewPerson && (
                    <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 p-3 flex gap-2 min-w-[180px]">
                      <input className="input flex-1 text-sm py-1" placeholder="Name"
                        value={newPersonName}
                        onChange={e => setNewPersonName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddPerson(); if (e.key === 'Escape') setShowNewPerson(false) }} />
                      <button type="button" onClick={handleAddPerson}
                        disabled={savingPerson || !newPersonName.trim()}
                        className="btn-primary text-sm py-1">
                        {savingPerson ? '…' : 'Add'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Who cooked it */}
          {slotType === 'meal' && (
            <div>
              <label className="label">Who cooked it? <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <button key={u.id} type="button" onClick={() => setCookId(prev => prev === u.id ? null : u.id)}
                    className={`btn border text-sm ${cookId === u.id
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Leftovers note */}
          {slotType === 'leftovers' && (
            <div>
              <label className="label">
                Note <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input className="input" placeholder="e.g. from Tuesday's pasta…"
                value={leftoversNote} onChange={e => setLeftoversNote(e.target.value)} autoFocus />
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
            {((slotType === 'meal' && slot?.meal) || (slotType === 'restaurant' && slot?.restaurant)) ? (
              <button type="button" className="btn-secondary" onClick={() => setRatingOpen(true)}>
                ⭐ Rate
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving ||
                (slotType === 'meal' && !mealId) ||
                (slotType === 'restaurant' && !restaurantId)
              }>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

        </div>
      </Modal>

      {addingMeal && (
        <MealFormModal
          meal={null}
          onClose={() => setAddingMeal(false)}
          onSaved={handleNewMealSaved}
        />
      )}

      {ratingOpen && (() => {
        const isMeal = slotType === 'meal' && slot?.meal
        const isRest = slotType === 'restaurant' && slot?.restaurant
        if (!isMeal && !isRest) return null
        const item = isMeal ? slot.meal : slot.restaurant
        return (
          <RatingModal
            title={`Rate: ${item.name}`}
            item={item}
            users={users}
            attendeeIds={[...attendees]}
            onClose={() => setRatingOpen(false)}
            onRate={async (userId, rating) => {
              if (isMeal) await mealsApi.rate(slot.meal.id, { user_id: userId, rating })
              else await mealsApi.rateRestaurant(slot.restaurant.id, { user_id: userId, rating })
            }}
          />
        )
      })()}
    </>
  )
}
