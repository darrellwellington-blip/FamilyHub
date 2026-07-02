import { useState } from 'react'
import { inventoryApi } from '../../api'
import { Modal } from '../Tasks/TaskForm'

export default function RemoveModal({ item, onClose, onRemoved }) {
  const [status, setStatus] = useState('consumed')
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await inventoryApi.remove(item.id, {
        status,
        removal_notes: notes.trim() || null,
      })
      onRemoved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Remove: ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <p className="text-sm text-gray-600">
          This will move the item to history. You can restore it later if needed.
        </p>

        {/* Consumed / Disposed */}
        <div>
          <label className="label">Reason</label>
          <div className="flex gap-4">
            {[
              { value: 'consumed', label: '✅ Consumed', desc: 'Used up or eaten' },
              { value: 'disposed', label: '🗑 Disposed',  desc: 'Thrown away, donated, or sold' },
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${
                  status === opt.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                  className="sr-only"
                />
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="e.g. Half used, expired before we could finish…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={saving}>
            {saving ? 'Removing…' : 'Remove from Inventory'}
          </button>
        </div>

      </form>
    </Modal>
  )
}
