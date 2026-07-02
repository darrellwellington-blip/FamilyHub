import { useState, useEffect } from 'react'
import { purchasesApi } from '../../api'
import { Modal } from '../Tasks/TaskForm'
import { fmtMoney, fmtDateTime } from './purchaseUtils'

export default function PurchaseDetail({ purchaseId, onClose, onEdit, onDeleted }) {
  const [purchase, setPurchase] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setLoading(true)
    purchasesApi.get(purchaseId)
      .then(data => { setPurchase(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [purchaseId])

  const handleDelete = async () => {
    if (!confirm(`Delete purchase at ${purchase?.store}?`)) return
    setDeleting(true)
    try {
      await purchasesApi.delete(purchaseId)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      title={loading ? 'Loading…' : (purchase?.store ?? 'Purchase')}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      {loading ? (
        <p className="py-10 text-center text-gray-400">Loading…</p>
      ) : !purchase ? (
        <p className="py-10 text-center text-gray-400">Could not load purchase.</p>
      ) : (
        <div className="flex flex-col gap-5">

          {/* Header meta */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">{fmtDateTime(purchase.purchased_at)}</p>
              {purchase.notes && (
                <p className="text-sm text-gray-600 mt-1 italic">{purchase.notes}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="btn-secondary text-sm"
                onClick={() => onEdit(purchase)}
              >
                Edit
              </button>
              <button
                className="btn-danger text-sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '…' : 'Delete'}
              </button>
            </div>
          </div>

          {/* Line items */}
          {purchase.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No line items recorded.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {purchase.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{item.name}</p>
                    {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Qty: {item.quantity}
                      {item.unit_price != null && ` · ${fmtMoney(item.unit_price)} each`}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-800 shrink-0">
                    {item.unit_price != null
                      ? fmtMoney((item.quantity || 0) * item.unit_price)
                      : '—'}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 mt-1">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-base font-bold text-gray-900">{fmtMoney(purchase.total)}</span>
              </div>
            </div>
          )}

        </div>
      )}
    </Modal>
  )
}
