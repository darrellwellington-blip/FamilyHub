import { useState } from 'react'
import { moviesApi } from '../../../api'
import { Modal } from '../../Tasks/TaskForm'
import StarPicker from '../shared/StarPicker'
import ParticipantsSection from '../shared/ParticipantsSection'

export default function ViewingModal({ movie, viewing, users, friends, onClose, onSaved }) {
  const editing = Boolean(viewing)
  const [form, setForm] = useState({
    viewed_at:    viewing?.viewed_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    venue_type:   viewing?.venue_type ?? 'home',
    theater_name: viewing?.theater_name ?? '',
    notes:        viewing?.notes ?? '',
    user_ids:     (viewing?.users   ?? []).map(u => u.id),
    friend_ids:   (viewing?.friends ?? []).map(f => f.id),
    ratings:      viewing?.ratings  ?? {},
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleUser = (id) => setForm(f => {
    const on = f.user_ids.includes(id)
    const user_ids = on ? f.user_ids.filter(x => x !== id) : [...f.user_ids, id]
    const ratings = { ...f.ratings }; if (on) delete ratings[id]
    return { ...f, user_ids, ratings }
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
      viewed_at:    form.viewed_at || null,
      venue_type:   form.venue_type,
      theater_name: form.venue_type === 'theater' ? form.theater_name.trim() || null : null,
      notes:        form.notes.trim() || null,
      user_ids:     form.user_ids,
      friend_ids:   form.friend_ids,
      ratings:      form.ratings,
    }
    try {
      if (editing) {
        await moviesApi.updateViewing(viewing.id, payload)
      } else {
        await moviesApi.addViewing(movie.id, payload)
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
    <Modal title={editing ? `Edit Viewing — ${movie.title}` : `Log Viewing — ${movie.title}`}
      onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div>
          <label className="label">Date watched</label>
          <input type="date" className="input" value={form.viewed_at}
            onChange={e => set('viewed_at', e.target.value)} />
        </div>

        <div>
          <label className="label">Where watched</label>
          <div className="flex gap-3">
            {[['home','🏠 At home'], ['theater','🎬 Theater']].map(([val, lbl]) => (
              <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="venue_type" value={val}
                  checked={form.venue_type === val}
                  onChange={() => set('venue_type', val)}
                  className="accent-indigo-600" />
                {lbl}
              </label>
            ))}
          </div>
        </div>

        {form.venue_type === 'theater' && (
          <div>
            <label className="label">Theater name</label>
            <input className="input" value={form.theater_name}
              onChange={e => set('theater_name', e.target.value)}
              placeholder="e.g. Cineplex Kanata" />
          </div>
        )}

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Thoughts, quotes, favourite scenes…" />
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
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Log Viewing'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
