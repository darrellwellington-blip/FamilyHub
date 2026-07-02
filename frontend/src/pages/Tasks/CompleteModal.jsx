import { useState, useEffect } from 'react'
import { tasksApi } from '../../api'
import { useUser } from '../../UserContext'
import { Modal } from './TaskForm'
import { localNow } from './taskUtils'

export default function CompleteModal({ task, onClose, onSaved }) {
  const { currentUser, users } = useUser()

  const [completedAt, setCompletedAt] = useState(localNow())
  const [userId,      setUserId]      = useState(currentUser?.id ?? '')

  // Sync userId once currentUser loads (async gap on first render)
  useEffect(() => {
    if (currentUser?.id && !userId) setUserId(currentUser.id)
  }, [currentUser?.id])
  const [notes,       setNotes]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      await tasksApi.addCompletion(task.id, {
        completed_at: new Date(completedAt).toISOString(),
        completed_by: Number(userId),
        notes:        notes.trim() || null,
      })

      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Complete: ${task.title}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Who completed it */}
        <div>
          <label className="label">Completed by</label>
          <select className="input" value={userId} onChange={e => setUserId(e.target.value)}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* When */}
        <div>
          <label className="label">Date &amp; time</label>
          <input type="datetime-local" className="input"
            value={completedAt} onChange={e => setCompletedAt(e.target.value)} />
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea className="input resize-none" rows={3} placeholder="Anything worth noting…"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : '✓ Mark Complete'}
          </button>
        </div>

      </form>
    </Modal>
  )
}
