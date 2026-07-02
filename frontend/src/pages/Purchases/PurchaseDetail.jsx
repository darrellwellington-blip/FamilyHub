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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 font-medium w-8"></th>
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Unit Price</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchase.items.map(item => (
                    <tr key={item.id} className="group">
                      <td className="py-2.5 text-gray-900">
                        {item.name}
                        {item.notes && (
                          <span className="block text-xs text-gray-400">{item.notes}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{item.quantity}</td>
                      <td className="py-2.5 text-right text-gray-600">
                        {item.unit_price != null ? fmtMoney(item.unit_price) : '—'}
                      </td>
                      <td className="py-2.5 text-right font-medium text-gray-800">
                        {item.unit_price != null
                          ? fmtMoney((item.quantity || 0) * item.unit_price)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={4} className="pt-3 text-right text-sm font-semibold text-gray-700">
                      Total
                    </td>
                    <td className="pt-3 text-right text-base font-bold text-gray-900">
                      {fmtMoney(purchase.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        </div>
      )}
    </Modal>
  )
}
