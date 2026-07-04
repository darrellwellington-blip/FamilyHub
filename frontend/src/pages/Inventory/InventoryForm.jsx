import { useState } from 'react'
import { inventoryApi } from '../../api'
import { Modal } from '../Tasks/TaskForm'
import { PRESET_CATEGORIES, PRESET_LOCATIONS, BATCH_CATEGORIES, categoryFields } from './inventoryUtils'

function initForm(item) {
  const isCustomCat = item?.category && !PRESET_CATEGORIES.includes(item.category)
  return {
    name:            item?.name            ?? '',
    description:     item?.description     ?? '',
    categorySelect:  isCustomCat ? '__custom' : (item?.category ?? 'Food'),
    customCategory:  isCustomCat ? item.category : '',
    location:        item?.location        ?? '',
    quantity:        item?.quantity        ?? 1,
    unit:            item?.unit            ?? '',
    best_before_date:item?.best_before_date ?? '',
    purchase_date:   item?.purchase_date   ?? '',
    purchase_price:  item?.purchase_price  != null ? String(item.purchase_price) : '',
    store:           item?.store           ?? '',
    serial_number:   item?.serial_number   ?? '',
    model_number:    item?.model_number    ?? '',
    estimated_value: item?.estimated_value != null ? String(item.estimated_value) : '',
    notes:           item?.notes           ?? '',
  }
}

export default function InventoryForm({ item, locationNames, storeNames, onClose, onSaved }) {
  const [form,   setForm]   = useState(() => initForm(item))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const category = form.categorySelect === '__custom'
    ? (form.customCategory.trim() || 'Custom')
    : form.categorySelect

  const fields  = categoryFields(category).item ?? []
  const isBatch = BATCH_CATEGORIES.has(category)
  const show    = (f) => fields.includes(f)

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)

    const payload = {
      name:        form.name.trim(),
      description: show('description') ? (form.description.trim() || null) : null,
      category,
      location:    show('location')    ? (form.location.trim() || null)    : null,
      unit:        show('unit')        ? (form.unit.trim() || null)        : null,
      notes:       show('notes')       ? (form.notes.trim() || null)       : null,
      // non-batch item fields
      ...(!isBatch && {
        quantity:        show('quantity')       ? (form.quantity !== '' ? Number(form.quantity) : null) : null,
        best_before_date:show('best_before_date')? (form.best_before_date || null) : null,
        purchase_date:   show('purchase_date')  ? (form.purchase_date || null)    : null,
        purchase_price:  show('purchase_price') ? (form.purchase_price !== '' ? Number(form.purchase_price) : null) : null,
        store:           show('store')          ? (form.store.trim() || null)     : null,
      }),
      serial_number:  show('serial_number')  ? (form.serial_number.trim() || null)  : null,
      model_number:   show('model_number')   ? (form.model_number.trim() || null)   : null,
      estimated_value:show('estimated_value')? (form.estimated_value !== '' ? Number(form.estimated_value) : null) : null,
    }

    try {
      if (!item) {
        await inventoryApi.create(payload)
      } else {
        await inventoryApi.update(item.id, payload)
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={item ? 'Edit Item' : 'Add Item'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Name ──────────────────────────────────────────────────────── */}
        <div>
          <label className="label">Name <span className="text-red-500">*</span></label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        {/* ── Category + Location ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.categorySelect}
              onChange={e => set('categorySelect', e.target.value)}>
              {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom">Custom…</option>
            </select>
          </div>
          {show('location') && (
            <div>
              <label className="label">Location</label>
              <input list="known-locations-form" className="input" placeholder="e.g. Pantry, Fridge…"
                value={form.location} onChange={e => set('location', e.target.value)} />
              <datalist id="known-locations-form">
                {[...new Set([...PRESET_LOCATIONS, ...(locationNames ?? [])])].map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
          )}
        </div>

        {form.categorySelect === '__custom' && (
          <div>
            <label className="label">Custom category name</label>
            <input className="input" placeholder="Category name"
              value={form.customCategory} onChange={e => set('customCategory', e.target.value)} />
          </div>
        )}

        {/* ── Unit (batch categories) ───────────────────────────────────── */}
        {show('unit') && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Unit</label>
              <input className="input" placeholder="e.g. pcs, lbs, oz…"
                value={form.unit} onChange={e => set('unit', e.target.value)} />
            </div>
          </div>
        )}

        {isBatch && (
          <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
            Quantity and expiry dates are tracked per batch — add batches from the item detail view after saving.
          </p>
        )}

        {/* ── Stock (non-batch) ─────────────────────────────────────────── */}
        {!isBatch && show('quantity') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity</label>
              <input type="number" min="0" step="any" className="input"
                value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            {show('unit') && (
              <div>
                <label className="label">Unit</label>
                <input className="input" placeholder="e.g. pcs, lbs, oz…"
                  value={form.unit} onChange={e => set('unit', e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* ── Dates (non-batch) ─────────────────────────────────────────── */}
        {!isBatch && (show('best_before_date') || show('purchase_date')) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {show('best_before_date') && (
              <div>
                <label className="label">Best-before / Expiry date</label>
                <input type="date" className="input"
                  value={form.best_before_date} onChange={e => set('best_before_date', e.target.value)} />
              </div>
            )}
            {show('purchase_date') && (
              <div>
                <label className="label">Purchase date</label>
                <input type="date" className="input"
                  value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* ── Purchase info (non-batch) ─────────────────────────────────── */}
        {!isBatch && (show('store') || show('purchase_price')) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {show('store') && (
              <div>
                <label className="label">Store</label>
                <input list="known-stores-inv" className="input" placeholder="Where was it purchased?"
                  value={form.store} onChange={e => set('store', e.target.value)} />
                <datalist id="known-stores-inv">
                  {(storeNames ?? []).map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            )}
            {show('purchase_price') && (
              <div>
                <label className="label">Purchase price ($)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" className="input"
                  value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* ── Product info ──────────────────────────────────────────────── */}
        {(show('serial_number') || show('model_number') || show('estimated_value')) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {show('serial_number') && (
              <div>
                <label className="label">Serial number</label>
                <input className="input" placeholder="Optional"
                  value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
              </div>
            )}
            {show('model_number') && (
              <div>
                <label className="label">Model number</label>
                <input className="input" placeholder="Optional"
                  value={form.model_number} onChange={e => set('model_number', e.target.value)} />
              </div>
            )}
            {show('estimated_value') && (
              <div>
                <label className="label">Estimated value ($)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" className="input"
                  value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* ── Description + Notes ───────────────────────────────────────── */}
        {show('description') && (
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2}
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        )}
        {show('notes') && (
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2}
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary w-full sm:w-auto justify-center" disabled={saving}>
            {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Item'}
          </button>
        </div>

      </form>
    </Modal>
  )
}
