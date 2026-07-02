import { useState, useEffect } from 'react'
import { tasksApi } from '../../api'
import { Modal } from './TaskForm'
import { fmtDateTime } from './taskUtils'

export default function HistoryModal({ task, onClose, onChanged }) {
  const [completions, setCompletions] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [deleting,    setDeleting]    = useState(null)

  const load = () => {
    setLoading(true)
    tasksApi.listCompletions(task.id)
      .then(data => { setCompletions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(load, [task.id])

  const handleDelete = async (id) => {
    if (!confirm('Delete this completion record?')) return
    setDeleting(id)
    try {
      await tasksApi.deleteCompletion(id)
      await onChanged()
      load()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Modal title={`History: ${task.title}`} onClose={onClose} maxWidth="max-w-xl">
      {loading ? (
        <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
      ) : completions.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No completions recorded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {completions.map(c => (
            <li key={c.id} className="py-3 flex gap-3 items-start">

              <div className="w-8 h-8 rounded-full bg-green-100 shrink-0 flex items-center justify-center text-green-600 text-sm font-bold">✓</div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {c.user_name ?? 'Unknown'}
                  </span>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="text-xs text-gray-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    {deleting === c.id ? '…' : 'Delete'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(c.completed_at)}</p>
                {c.notes && (
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{c.notes}</p>
                )}
              </div>

            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end pt-3 mt-2 border-t border-gray-100">
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
