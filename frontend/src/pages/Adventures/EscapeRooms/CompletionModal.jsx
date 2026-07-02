import { useState } from 'react'
import { adventuresApi } from '../../../api'
import { Modal } from '../../Tasks/TaskForm'
import StarPicker from '../shared/StarPicker'
import ParticipantsSection from '../shared/ParticipantsSection'

export default function CompletionModal({ room, venueName, completion, users, friends, onClose, onSaved }) {
  const editing = Boolean(completion)
  const [form, setForm] = useState({
    played_at:       completion?.played_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    escaped:         completion?.escaped ?? '',
    time_taken_mins: completion?.time_taken_mins ?? '',
    notes:           completion?.notes ?? '',
    user_ids:        (completion?.users   ?? []).map(u => u.id),
    friend_ids:      (completion?.friends ?? []).map(f => f.id),
    ratings:         completion?.ratings  ?? {},
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleUser = (id) => setForm(f => {
    const on = f.user_ids.includes(id)
    const user_ids = on ? f.user_ids.filter(x => x !== id) : [...f.user_ids, id]
    const ratings = { ...f.ratings }
    if (on) delete ratings[id]
    return { ...f, user_ids, ratings }
  })

  const toggleFriend = (id) => setForm(f => ({
    ...f,
    friend_ids: f.friend_ids.includes(id)
      ? f.friend_ids.filter(x => x !== id)
      : [...f.friend_ids, id],
  }))

  const setRating = (userId, rating) => setForm(f => ({
    ...f,
    ratings: { ...f.ratings, [userId]: rating || null },
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    const payload = {
      played_at:       form.played_at || null,
      escaped:         form.escaped === '' ? null : Number(form.escaped),
      time_taken_mins: form.time_taken_mins !== '' ? Number(form.time_taken_mins) : null,
      notes:           form.notes.trim() || null,
      user_ids:        form.user_ids,
      friend_ids:      form.friend_ids,
      ratings:         form.ratings,
    }
    try {
      if (editing) {
        await adventuresApi.updateCompletion(completion.id, payload)
      } else {
        await adventuresApi.addCompletion(room.id, payload)
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const selectedUsers = users.filter(u => form.user_ids.includes(u.id))

  return (
    <Modal
      title={editing ? `Edit — ${room.name}` : `Log Completion — ${room.name}`}
      onClose={onClose} maxWidth="max-w-xl"
    >
      <p className="text-xs text-gray-500 -mt-1 mb-4">{venueName}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div>
          <label className="label">Date played</label>
          <input type="date" className="input" value={form.played_at}
            onChange={e => set('played_at', e.target.value)} />
        </div>

        <div>
          <label className="label">Did you escape?</label>
          <div className="flex gap-4">
            {[['1','Yes ✅'], ['0','No ❌'], ['','Unknown']].map(([val, lbl]) => (
              <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="escaped" value={val}
                  checked={String(form.escaped) === val}
                  onChange={() => set('escaped', val)}
                  className="accent-indigo-600" />
                {lbl}
              </label>
            ))}
          </div>
        </div>

        {String(form.escaped) === '1' && (
          <div>
            <label className="label">Time taken (minutes)</label>
            <input type="number" min={1} max={120} className="input w-28"
              value={form.time_taken_mins}
              onChange={e => set('time_taken_mins', e.target.value)} />
          </div>
        )}

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Hints used, favourite moments…" />
        </div>

        <ParticipantsSection
          users={users} friends={friends}
          userIds={form.user_ids} friendIds={form.friend_ids}
          onToggleUser={toggleUser} onToggleFriend={toggleFriend}
        />

        {selectedUsers.length > 0 && (
          <div>
            <label className="label">Ratings</label>
            <div className="flex flex-col gap-2">
              {selectedUsers.map(u => (
                <StarPicker
                  key={u.id}
                  label={u.name}
                  value={Number(form.ratings[u.id]) || 0}
                  onChange={r => setRating(u.id, r)}
                />
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Log Completion'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
