import { useState } from 'react'
import { Modal } from '../Tasks/TaskForm'

export function Stars({ value, onChange, readonly = false, size = 'text-xl' }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" disabled={readonly} onClick={() => onChange?.(s)}
          className={`leading-none ${size}
            ${(value ?? 0) >= s ? 'text-amber-400' : 'text-gray-200'}
            ${!readonly ? 'hover:text-amber-300 cursor-pointer' : 'cursor-default'}`}>
          ★
        </button>
      ))}
    </span>
  )
}

// Multi-person rating modal for meals or restaurants
// onRate(userId, rating) — called once per person who has a rating set
export default function RatingModal({ title, item, users, attendeeIds, onClose, onRate }) {
  const displayUsers = attendeeIds?.length > 0
    ? users.filter(u => attendeeIds.includes(u.id))
    : users

  const [ratings, setRatings] = useState(() => {
    const existing = item?.ratings ?? {}
    const init = {}
    displayUsers.forEach(u => {
      if (existing[String(u.id)] != null) init[u.id] = existing[String(u.id)]
    })
    return init
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const [uid, rating] of Object.entries(ratings)) {
        await onRate(Number(uid), rating)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title ?? `Rate: ${item?.name}`} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex flex-col gap-4">
        {displayUsers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">No people added yet.</p>
        ) : (
          displayUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{u.name}</span>
              <Stars value={ratings[u.id] ?? null}
                onChange={v => setRatings(prev => ({ ...prev, [u.id]: v }))} />
              {ratings[u.id] != null && (
                <button type="button" onClick={() => setRatings(prev => { const n={...prev}; delete n[u.id]; return n })}
                  className="text-xs text-gray-300 hover:text-gray-500">✕</button>
              )}
            </div>
          ))
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}
            disabled={saving || Object.keys(ratings).length === 0}>
            {saving ? 'Saving…' : 'Save Ratings'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
