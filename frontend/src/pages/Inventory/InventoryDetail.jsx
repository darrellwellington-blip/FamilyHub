import { useState } from 'react'
import { inventoryApi } from '../../api'
import { Modal } from '../Tasks/TaskForm'
import {
  fmtDate, fmtMoney, expiryInfo,
  EXPIRY_BADGE, CATEGORY_ICONS,
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

export default function InventoryDetail({ item, onClose, onEdit, onRemove, onDeleted, onRestored }) {
  const [deleting,  setDeleting]  = useState(false)
  const [restoring, setRestoring] = useState(false)

  const expiry = expiryInfo(item)
  const isHistory = item.status !== 'active'

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await inventoryApi.delete(item.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const handleRestore = async () => {
    setRestoring(true)
    try {
      await inventoryApi.restore(item.id)
      onRestored()
    } finally {
      setRestoring(false)
    }
  }

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
            <button
              className="btn-secondary text-xs shrink-0"
              onClick={handleRestore}
              disabled={restoring}
            >
              {restoring ? '…' : 'Restore'}
            </button>
          </div>
        )}


        {/* Expiry badge */}
        {expiry && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium w-fit ${EXPIRY_BADGE[expiry.status]}`}>
            {expiry.status === 'expired'       ? '⚠️' :
             expiry.status === 'expiring-soon' ? '⏰' : '📅'}
            {expiry.label}
          </div>
        )}

        {/* Info grid */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Category"   value={`${CATEGORY_ICONS[item.category] ?? ''} ${item.category ?? ''}`.trim() || null} />
          <Field label="Location"   value={item.location} />
          <Field label="Quantity"   value={item.quantity != null ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : null} />
          <Field label="Best Before" value={fmtDate(item.best_before_date)} />
          <Field label="Purchase Date" value={fmtDate(item.purchase_date)} />
          <Field label="Store"      value={item.store} />
          <Field label="Purchase Price" value={fmtMoney(item.purchase_price)} />
          <Field label="Est. Value" value={fmtMoney(item.estimated_value)} />
          <Field label="Serial No." value={item.serial_number} />
          <Field label="Model No."  value={item.model_number} />
        </dl>

        {item.description && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}

        {item.notes && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}

        {/* Action row */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {!isHistory && (
            <>
              <button className="btn-primary text-sm"    onClick={() => onEdit(item)}>Edit</button>
              <button className="btn-secondary text-sm"  onClick={() => onRemove(item)}>Remove…</button>
            </>
          )}
          <button
            className="btn-danger text-sm ml-auto"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '…' : 'Delete permanently'}
          </button>
        </div>

      </div>
    </Modal>
  )
}
