import { useState } from 'react'
import { miniGolfApi } from '../../../api'
import { Modal } from '../../Tasks/TaskForm'
import StarPicker from '../shared/StarPicker'
import ParticipantsSection from '../shared/ParticipantsSection'

export default function SessionModal({ course, venueName, session, users, friends, onClose, onSaved }) {
  const editing = Boolean(session)
  const initScores = () => {
    if (!session?.scores) return {}
    return Object.fromEntries(session.scores.map(s => [s.user_id, s.total_score]))
  }
  const [form, setForm] = useState({
    played_at:  session?.played_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    notes:      session?.notes ?? '',
    user_ids:   (session?.users   ?? []).map(u => u.id),
    friend_ids: (session?.friends ?? []).map(f => f.id),
    scores:     initScores(),
    ratings:    session?.ratings ?? {},
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleUser = (id) => setForm(f => {
    const on = f.user_ids.includes(id)
    const user_ids = on ? f.user_ids.filter(x => x !== id) : [...f.user_ids, id]
    const scores  = { ...f.scores };  if (on) delete scores[id]
    const ratings = { ...f.ratings }; if (on) delete ratings[id]
    return { ...f, user_ids, scores, ratings }
  })

  const toggleFriend = (id) => setForm(f => ({
    ...f,
    friend_ids: f.friend_ids.includes(id)
      ? f.friend_ids.filter(x => x !== id)
      : [...f.friend_ids, id],
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    const payload = {
      played_at:  form.played_at || null,
      notes:      form.notes.trim() || null,
      user_ids:   form.user_ids,
      friend_ids: form.friend_ids,
      scores:     form.scores,
      ratings:    form.ratings,
    }
    try {
      if (editing) {
        await miniGolfApi.updateSession(session.id, payload)
      } else {
        await miniGolfApi.addSession(course.id, payload)
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
    <Modal title={editing ? `Edit Session — ${course.name}` : `Log Session — ${course.name}`}
      onClose={onClose} maxWidth="max-w-xl">
      <p className="text-xs text-gray-500 -mt-1 mb-4">{venueName} · {course.holes} holes</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div>
          <label className="label">Date played</label>
          <input type="date" className="input" value={form.played_at}
            onChange={e => set('played_at', e.target.value)} />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes}
            onChange={e => set('notes', e.target.value)} placeholder="Weather, who won, highlights…" />
        </div>

        <ParticipantsSection
          users={users} friends={friends}
          userIds={form.user_ids} friendIds={form.friend_ids}
          onToggleUser={toggleUser} onToggleFriend={toggleFriend}
        />

        {selectedUsers.length > 0 && (
          <div>
            <label className="label">Scores (total)</label>
            <div className="flex flex-col gap-2">
              {selectedUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-24 shrink-0">{u.name}</span>
                  <input type="number" min={0} max={200} className="input w-24"
                    placeholder="Score"
                    value={form.scores[u.id] ?? ''}
                    onChange={e => set('scores', { ...form.scores, [u.id]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedUsers.length > 0 && (
          <div>
            <label className="label">Ratings</label>
            <div className="flex flex-col gap-2">
              {selectedUsers.map(u => (
                <StarPicker key={u.id} label={u.name}
                  value={Number(form.ratings[u.id]) || 0}
                  onChange={r => set('ratings', { ...form.ratings, [u.id]: r || null })} />
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Log Session'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
