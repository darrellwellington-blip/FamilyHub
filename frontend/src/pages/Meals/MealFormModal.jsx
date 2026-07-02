import { useState } from 'react'
import { mealsApi } from '../../api'
import { Modal } from '../Tasks/TaskForm'
import { MEAL_CATEGORIES } from './mealUtils'

const COMMON_UNITS = ['', 'tsp', 'tbsp', 'cup', 'oz', 'lbs', 'g', 'kg', 'ml', 'L', 'clove', 'slice', 'can', 'pkg']

function IngredientRow({ ing, onChange, onDelete }) {
  return (
    <div className="flex gap-2 items-center">
      <input className="input flex-1" placeholder="Ingredient name"
        value={ing.name} onChange={e => onChange({ ...ing, name: e.target.value })} />
      <input className="input w-20" placeholder="Qty"
        value={ing.quantity ?? ''} onChange={e => onChange({ ...ing, quantity: e.target.value })} />
      <select className="input w-24 text-sm"
        value={ing.unit ?? ''} onChange={e => onChange({ ...ing, unit: e.target.value })}>
        {COMMON_UNITS.map(u => <option key={u} value={u}>{u || '—'}</option>)}
      </select>
      <button type="button" onClick={onDelete}
        className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0">✕</button>
    </div>
  )
}

export default function MealFormModal({ meal, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:               meal?.name               ?? '',
    category:           meal?.category           ?? '',
    description:        meal?.description        ?? '',
    recipe:             meal?.recipe             ?? '',
    min_frequency_days: meal?.min_frequency_days ?? 0,
  })
  const [ingredients, setIngredients] = useState(
    meal?.ingredients?.length
      ? meal.ingredients.map(i => ({ ...i }))
      : []
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addIngredient = () =>
    setIngredients(l => [...l, { name: '', quantity: '', unit: '' }])

  const updateIngredient = (i, val) =>
    setIngredients(l => l.map((x, idx) => idx === i ? val : x))

  const deleteIngredient = (i) =>
    setIngredients(l => l.filter((_, idx) => idx !== i))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        name:               form.name.trim(),
        category:           form.category || null,
        description:        form.description.trim() || null,
        recipe:             form.recipe.trim() || null,
        min_frequency_days: Number(form.min_frequency_days) || 0,
      }
      const saved = meal
        ? await mealsApi.update(meal.id, payload)
        : await mealsApi.create(payload)

      const ings = ingredients.filter(i => i.name.trim())
      await mealsApi.saveIngredients(saved.id, ings)

      await onSaved(saved)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={meal ? 'Edit Meal' : 'Add Meal'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div>
          <label className="label">Name <span className="text-red-500">*</span></label>
          <input className="input" value={form.name}
            onChange={e => set('name', e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category}
              onChange={e => set('category', e.target.value)}>
              <option value="">— None —</option>
              {MEAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Min days between</label>
            <input type="number" min="0" className="input" value={form.min_frequency_days}
              onChange={e => set('min_frequency_days', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">0 = no restriction</p>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2} value={form.description}
            onChange={e => set('description', e.target.value)} />
        </div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Ingredients</label>
            {ingredients.length > 0 && (
              <span className="text-xs text-gray-400">Name · Qty · Unit</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {ingredients.map((ing, i) => (
              <IngredientRow key={i} ing={ing}
                onChange={val => updateIngredient(i, val)}
                onDelete={() => deleteIngredient(i)} />
            ))}
          </div>
          <button type="button" onClick={addIngredient}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            + Add ingredient
          </button>
        </div>

        <div>
          <label className="label">Recipe / Notes</label>
          <textarea className="input resize-none" rows={4}
            placeholder="Steps, tips, variations…"
            value={form.recipe} onChange={e => set('recipe', e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : meal ? 'Save Changes' : 'Add Meal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
