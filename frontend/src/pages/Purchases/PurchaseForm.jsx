import { useState } from 'react'
import { purchasesApi } from '../../api'
import { useUser } from '../../UserContext'
import { Modal } from '../Tasks/TaskForm'
import { isoToLocalInput, localNow, fmtMoney, formTotal } from './purchaseUtils'

let _keySeq = 0
const newKey = () => `item-${++_keySeq}`

const blankItem = () => ({
  _key:       newKey(),
  id:         null,
  name:       '',
  quantity:   1,
  unit_price: '',
  notes:      '',
  _deleted:   false,
})

function initForm(purchase) {
  if (!purchase) {
    return {
      store:        '',
      purchased_at: localNow(),
      notes:        '',
      items:        [blankItem()],
    }
  }
  return {
    store:        purchase.store        ?? '',
    purchased_at: isoToLocalInput(purchase.purchased_at),
    notes:        purchase.notes        ?? '',
    items: (purchase.items ?? []).map(item => ({
      _key:       newKey(),
      id:         item.id,
      name:       item.name        ?? '',
      quantity:   item.quantity    ?? 1,
      unit_price: item.unit_price != null ? String(item.unit_price) : '',
      notes:      item.notes       ?? '',
      _deleted:   false,
    })),
  }
}

export default function PurchaseForm({ purchase, storeNames, onClose, onSaved }) {
  const { currentUser } = useUser()
  const [form,   setForm]   = useState(() => initForm(purchase))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const updateItem = (_key, changes) =>
    setForm(f => ({
      ...f,
      items: f.items.map(i => i._key === _key ? { ...i, ...changes } : i),
    }))

  const removeItem = (_key) =>
    setForm(f => ({
      ...f,
      items: f.items.map(i =>
        i._key === _key ? (i.id ? { ...i, _deleted: true } : null) : i
      ).filter(Boolean),
    }))

  const addItem = () =>
    setForm(f => ({ ...f, items: [...f.items, blankItem()] }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.store.trim()) { setError('Store name is required'); return }
    const unnamedItems = form.items.filter(i => !i._deleted && !i.name.trim())
    if (unnamedItems.length > 0) { setError('All line items must have a name'); return }
    setSaving(true)
    setError(null)

    const toPayload = item => ({
      name:       item.name.trim(),
      quantity:   Number(item.quantity) || 1,
      unit_price: item.unit_price !== '' ? Number(item.unit_price) : null,
      notes:      item.notes.trim() || null,
    })

    try {
      if (!purchase) {
        const p = await purchasesApi.create({
          store:        form.store.trim(),
          purchased_at: new Date(form.purchased_at).toISOString(),
          notes:        form.notes.trim() || null,
          created_by:   currentUser?.id   ?? null,
        })
        await Promise.all(
          form.items.filter(i => !i._deleted).map(i => purchasesApi.addItem(p.id, toPayload(i)))
        )
      } else {
        await purchasesApi.update(purchase.id, {
          store:        form.store.trim(),
          purchased_at: new Date(form.purchased_at).toISOString(),
          notes:        form.notes.trim() || null,
        })
        await Promise.all(form.items.filter(i => i._deleted && i.id).map(i => purchasesApi.deleteItem(i.id)))
        await Promise.all(form.items.filter(i => i.id && !i._deleted).map(i => purchasesApi.updateItem(i.id, toPayload(i))))
        await Promise.all(form.items.filter(i => !i.id && !i._deleted).map(i => purchasesApi.addItem(purchase.id, toPayload(i))))
      }

      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const visibleItems = form.items.filter(i => !i._deleted)
  const total        = formTotal(form.items)

  return (
    <Modal title={purchase ? 'Edit Purchase' : 'Add Purchase'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Store <span className="text-red-500">*</span></label>
            <input list="known-stores" className="input" placeholder="e.g. Costco"
              value={form.store} onChange={e => setField('store', e.target.value)} autoFocus />
            <datalist id="known-stores">
              {storeNames.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="label">Date &amp; time</label>
            <input type="datetime-local" className="input"
              value={form.purchased_at} onChange={e => setField('purchased_at', e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={2} placeholder="e.g. Weekly grocery run"
              value={form.notes} onChange={e => setField('notes', e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Line Items ({visibleItems.length})</h3>
            {total > 0 && <span className="text-sm font-semibold text-gray-900">Total: {fmtMoney(total)}</span>}
          </div>

          <div className="flex flex-col gap-3">
            {visibleItems.map(item => (
              <ItemRow key={item._key} item={item}
                onChange={(changes) => updateItem(item._key, changes)}
                onRemove={() => removeItem(item._key)} />
            ))}
          </div>

          <button type="button" className="btn-secondary mt-3 w-full justify-center text-sm" onClick={addItem}>
            + Add Item
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : purchase ? 'Save Changes' : 'Save Purchase'}
          </button>
        </div>

      </form>
    </Modal>
  )
}

function ItemRow({ item, onChange, onRemove }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 flex flex-col gap-2">
      <div className="flex gap-2 items-start">
        <input className="input flex-1 bg-white" placeholder="Item name"
          value={item.name} onChange={e => onChange({ name: e.target.value })} />
        <button type="button" onClick={onRemove}
          className="shrink-0 text-gray-400 hover:text-red-600 transition-colors mt-2" title="Remove item">
          <XIcon />
        </button>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">Qty</label>
          <input type="number" min="0" step="0.01" className="input w-20 bg-white text-center"
            value={item.quantity} onChange={e => onChange({ quantity: e.target.value })} />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">Price $</label>
          <input type="number" min="0" step="0.01" placeholder="0.00" className="input w-24 bg-white"
            value={item.unit_price} onChange={e => onChange({ unit_price: e.target.value })} />
        </div>

        {item.unit_price !== '' && Number(item.unit_price) > 0 && (
          <span className="text-sm text-gray-500 ml-auto">
            = {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
                .format((Number(item.quantity) || 0) * Number(item.unit_price))}
          </span>
        )}
      </div>

      <input className="input bg-white text-xs" placeholder="Notes (optional)"
        value={item.notes} onChange={e => onChange({ notes: e.target.value })} />
    </div>
  )
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
