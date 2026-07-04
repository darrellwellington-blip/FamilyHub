import { useState } from 'react'
import { inventoryApi } from '../../api'
import { Modal } from '../Tasks/TaskForm'
import {
  fmtDate, fmtMoney, expiryInfo, totalQuantity,
  EXPIRY_BADGE, CATEGORY_ICONS, BATCH_CATEGORIES, categoryFields,
} from './inventoryUtils'

function Field({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
    </div>
  )
}

function initBatch() {
  return { quantity: 1, unit: '', best_before_date: '', purchase_date: '', purchase_price: '', store: '', notes: '' }
}

function BatchRow({ batch, unit, storeNames, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState({
    quantity:        batch.quantity ?? 1,
    unit:            batch.unit ?? unit ?? '',
    best_before_date:batch.best_before_date ?? '',
    purchase_date:   batch.purchase_date ?? '',
    purchase_price:  batch.purchase_price != null ? String(batch.purchase_price) : '',
    store:           batch.store ?? '',
    notes:           batch.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expDays = batch.best_before_date
    ? Math.round((new Date(batch.best_before_date + 'T12:00:00') - today) / 86_400_000)
    : null
  const expColor = expDays === null ? '' : expDays < 0 ? 'text-red-600' : expDays <= 7 ? 'text-amber-600' : 'text-gray-500'

  const save = async () => {
    setSaving(true)
    try {
      await onSave(batch.id, {
        quantity:        Number(form.quantity) || 1,
        unit:            form.unit.trim() || null,
        best_before_date:form.best_before_date || null,
        purchase_date:   form.purchase_date || null,
        purchase_price:  form.purchase_price !== '' ? Number(form.purchase_price) : null,
        store:           form.store.trim() || null,
        notes:           form.notes.trim() || null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Quantity</label>
            <input type="number" min="0" step="any" className="input py-1 text-sm"
              value={form.quantity} onChange={e => set('quantity', e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Unit</label>
            <input className="input py-1 text-sm" placeholder="lbs, pcs…"
              value={form.unit} onChange={e => set('unit', e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Best before</label>
            <input type="date" className="input py-1 text-sm"
              value={form.best_before_date} onChange={e => set('best_before_date', e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Purchase date</label>
            <input type="date" className="input py-1 text-sm"
              value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Store</label>
            <input list="batch-stores" className="input py-1 text-sm"
              value={form.store} onChange={e => set('store', e.target.value)} />
            <datalist id="batch-stores">
              {(storeNames ?? []).map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className="label text-xs">Price ($)</label>
            <input type="number" min="0" step="0.01" className="input py-1 text-sm"
              value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label text-xs">Notes</label>
          <input className="input py-1 text-sm" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary text-xs py-1" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn-primary text-xs py-1" onClick={save} disabled={saving}>{saving ? '…' : 'Save'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 group">
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-sm font-medium text-gray-900">
          {batch.quantity ?? 1}{batch.unit ? ` ${batch.unit}` : ''}
        </span>
        {batch.best_before_date && (
          <span className={`text-xs ${expColor}`}>
            {expDays < 0 ? `Expired ${Math.abs(expDays)}d ago` :
             expDays === 0 ? 'Expires today' :
             `BB: ${fmtDate(batch.best_before_date)}`}
          </span>
        )}
        {batch.store && <span className="text-xs text-gray-400 col-span-2">{batch.store}{batch.purchase_price != null ? ` · ${fmtMoney(batch.purchase_price)}` : ''}</span>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity">
        <button className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" onClick={() => setEditing(true)} title="Edit batch">✏️</button>
        <button className="p-1.5 text-gray-400 hover:text-red-600 rounded" onClick={() => onDelete(batch.id)} title="Delete batch">🗑</button>
      </div>
    </div>
  )
}

function AddBatchForm({ unit, storeNames, onAdd, onCancel }) {
  const [form,   setForm]   = useState({ ...initBatch(), unit: unit ?? '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await onAdd({
        quantity:        Number(form.quantity) || 1,
        unit:            form.unit.trim() || null,
        best_before_date:form.best_before_date || null,
        purchase_date:   form.purchase_date || null,
        purchase_price:  form.purchase_price !== '' ? Number(form.purchase_price) : null,
        store:           form.store.trim() || null,
        notes:           form.notes.trim() || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex flex-col gap-2">
      <p className="text-xs font-medium text-green-700">New batch</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-xs">Quantity</label>
          <input type="number" min="0" step="any" className="input py-1 text-sm"
            value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Unit</label>
          <input className="input py-1 text-sm" placeholder="lbs, pcs…"
            value={form.unit} onChange={e => set('unit', e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Best before</label>
          <input type="date" className="input py-1 text-sm"
            value={form.best_before_date} onChange={e => set('best_before_date', e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Purchase date</label>
          <input type="date" className="input py-1 text-sm"
            value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Store</label>
          <input list="add-batch-stores" className="input py-1 text-sm"
            value={form.store} onChange={e => set('store', e.target.value)} />
          <datalist id="add-batch-stores">
            {(storeNames ?? []).map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div>
          <label className="label text-xs">Price ($)</label>
          <input type="number" min="0" step="0.01" className="input py-1 text-sm"
            value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary text-xs py-1" onClick={onCancel}>Cancel</button>
        <button className="btn-primary text-xs py-1" onClick={save} disabled={saving}>{saving ? '…' : 'Add Batch'}</button>
      </div>
    </div>
  )
}

export default function InventoryDetail({ item: initialItem, storeNames, onClose, onEdit, onRemove, onDeleted, onRestored }) {
  const [item,      setItem]      = useState(initialItem)
  const [deleting,  setDeleting]  = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [addingBatch, setAddingBatch] = useState(false)

  const expiry  = expiryInfo(item)
  const isHistory = item.status !== 'active'
  const isBatch   = BATCH_CATEGORIES.has(item.category)
  const fields    = categoryFields(item.category).item ?? []
  const show      = (f) => fields.includes(f)
  const qty       = totalQuantity(item)

  const refreshItem = async () => {
    const updated = await inventoryApi.get(item.id)
    setItem(updated)
  }

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try { await inventoryApi.delete(item.id); onDeleted() }
    finally { setDeleting(false) }
  }

  const handleRestore = async () => {
    setRestoring(true)
    try { await inventoryApi.restore(item.id); onRestored() }
    finally { setRestoring(false) }
  }

  const handleAddBatch = async (data) => {
    await inventoryApi.addBatch(item.id, data)
    await refreshItem()
    setAddingBatch(false)
  }

  const handleUpdateBatch = async (batchId, data) => {
    await inventoryApi.updateBatch(batchId, data)
    await refreshItem()
  }

  const handleDeleteBatch = async (batchId) => {
    if (!confirm('Remove this batch?')) return
    await inventoryApi.deleteBatch(batchId)
    await refreshItem()
  }

  const batches = (item.batches ?? []).slice().sort((a, b) => {
    if (!a.best_before_date && !b.best_before_date) return 0
    if (!a.best_before_date) return 1
    if (!b.best_before_date) return -1
    return a.best_before_date.localeCompare(b.best_before_date)
  })

  return (
    <Modal title={item.name} onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col gap-5">

        {/* Status banner for history items */}
        {isHistory && (
          <div className={`rounded-lg px-4 py-3 flex items-center justify-between gap-3 ${
            item.status === 'consumed' ? 'bg-green-50 border border-green-200' : 'bg-gray-100 border border-gray-200'
          }`}>
            <div>
              <span className="text-sm font-medium">
                {item.status === 'consumed' ? '✅ Consumed' : '🗑 Disposed'} on {fmtDate(item.removed_at?.slice(0, 10))}
              </span>
              {item.removal_notes && (
                <p className="text-xs text-gray-500 mt-0.5">{item.removal_notes}</p>
              )}
            </div>
            <button className="btn-secondary text-xs shrink-0" onClick={handleRestore} disabled={restoring}>
              {restoring ? '…' : 'Restore'}
            </button>
          </div>
        )}

        {/* Expiry badge */}
        {expiry && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium w-fit ${EXPIRY_BADGE[expiry.status]}`}>
            {expiry.status === 'expired' ? '⚠️' : expiry.status === 'expiring-soon' ? '⏰' : '📅'}
            {expiry.label}
          </div>
        )}

        {/* Item fields */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Category" value={`${CATEGORY_ICONS[item.category] ?? ''} ${item.category ?? ''}`.trim() || null} />
          {show('location')       && <Field label="Location"      value={item.location} />}
          {!isBatch && show('quantity') && (
            <Field label="Quantity" value={qty != null ? `${qty}${item.unit ? ' ' + item.unit : ''}` : null} />
          )}
          {!isBatch && show('best_before_date') && <Field label="Best Before"    value={fmtDate(item.best_before_date)} />}
          {!isBatch && show('purchase_date')    && <Field label="Purchase Date"  value={fmtDate(item.purchase_date)} />}
          {!isBatch && show('store')            && <Field label="Store"          value={item.store} />}
          {!isBatch && show('purchase_price')   && <Field label="Purchase Price" value={fmtMoney(item.purchase_price)} />}
          {show('estimated_value') && <Field label="Est. Value"    value={fmtMoney(item.estimated_value)} />}
          {show('serial_number')   && <Field label="Serial No."    value={item.serial_number} />}
          {show('model_number')    && <Field label="Model No."     value={item.model_number} />}
        </dl>

        {show('description') && item.description && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}
        {show('notes') && item.notes && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}

        {/* ── Batches section ───────────────────────────────────────────── */}
        {isBatch && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-gray-700">Stock</span>
                {qty != null && (
                  <span className="ml-2 text-xs text-gray-400">
                    {qty} total{item.unit ? ` ${item.unit}` : ''}
                  </span>
                )}
              </div>
              {!isHistory && !addingBatch && (
                <button className="btn-secondary text-xs py-1" onClick={() => setAddingBatch(true)}>+ Add Batch</button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {batches.map(b => (
                <BatchRow
                  key={b.id}
                  batch={b}
                  unit={item.unit}
                  storeNames={storeNames}
                  onSave={handleUpdateBatch}
                  onDelete={handleDeleteBatch}
                />
              ))}
              {batches.length === 0 && !addingBatch && (
                <p className="text-xs text-gray-400 italic py-2">No stock batches yet — add one to track quantity and expiry.</p>
              )}
              {addingBatch && (
                <AddBatchForm
                  unit={item.unit}
                  storeNames={storeNames}
                  onAdd={handleAddBatch}
                  onCancel={() => setAddingBatch(false)}
                />
              )}
            </div>
          </div>
        )}

        {/* Action row */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {!isHistory && (
            <>
              <button className="btn-primary text-sm"   onClick={() => onEdit(item)}>Edit</button>
              <button className="btn-secondary text-sm" onClick={() => onRemove(item)}>Remove…</button>
            </>
          )}
          <button className="btn-danger text-sm ml-auto" onClick={handleDelete} disabled={deleting}>
            {deleting ? '…' : 'Delete permanently'}
          </button>
        </div>

      </div>
    </Modal>
  )
}
