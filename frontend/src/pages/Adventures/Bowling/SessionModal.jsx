import { useState } from 'react'
import { bowlingApi } from '../../../api'
import { Modal } from '../../Tasks/TaskForm'
import StarPicker from '../shared/StarPicker'
import ParticipantsSection from '../shared/ParticipantsSection'

export default function BowlingSessionModal({ venue, session, users, friends, onClose, onSaved }) {
  const editing = Boolean(session)
  const initScores = () => {
    if (!session?.scores) return {}
    return Object.fromEntries(
      Object.entries(session.scores).map(([uid, s]) => [uid, s.games])
    )
  }
  const [numGames, setNumGames] = useState(() => {
    if (!session?.scores) return 2
    const first = Object.values(session.scores)[0]
    return first ? first.games.length : 2
  })
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

  const setScore = (uid, gameIdx, val) => setForm(f => {
    const games = [...(f.scores[uid] || Array(numGames).fill(''))]
    games[gameIdx] = val
    return { ...f, scores: { ...f.scores, [uid]: games } }
  })

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
        await bowlingApi.updateSession(session.id, payload)
      } else {
        await bowlingApi.addSession(venue.id, payload)
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
    <Modal title={editing ? `Edit Session — ${venue.name}` : `Log Session — ${venue.name}`}
      onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div>
          <label className="label">Date played</label>
          <input type="date" className="input" value={form.played_at}
            onChange={e => set('played_at', e.target.value)} />
        </div>

        <div>
          <label className="label">Number of games</label>
          <div className="flex gap-2">
            {[1,2,3].map(n => (
              <button key={n} type="button"
                onClick={() => setNumGames(n)}
                className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${
                  numGames === n ? 'bg-indigo-600 text-white border-indigo-600'
                                 : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                }`}>{n} game{n > 1 ? 's' : ''}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes}
            onChange={e => set('notes', e.target.value)} placeholder="Lane, highlights…" />
        </div>

        <ParticipantsSection
          users={users} friends={friends}
          userIds={form.user_ids} friendIds={form.friend_ids}
          onToggleUser={toggleUser} onToggleFriend={toggleFriend}
        />

        {selectedUsers.length > 0 && (
          <div>
            <label className="label">Scores</label>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pr-4 py-1 font-medium">Player</th>
                    {Array.from({ length: numGames }, (_, i) => (
                      <th key={i} className="pr-3 py-1 font-medium">Game {i + 1}</th>
                    ))}
                    <th className="py-1 font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUsers.map(u => {
                    const games = form.scores[u.id] || []
                    const total = games.reduce((s, v) => s + (Number(v) || 0), 0)
                    return (
                      <tr key={u.id}>
                        <td className="pr-4 py-1 text-gray-700">{u.name}</td>
                        {Array.from({ length: numGames }, (_, i) => (
                          <td key={i} className="pr-3 py-1">
                            <input type="number" min={0} max={300} className="input w-20 py-1"
                              placeholder="—"
                              value={games[i] ?? ''}
                              onChange={e => setScore(u.id, i, e.target.value)} />
                          </td>
                        ))}
                        <td className="py-1 font-semibold text-gray-800">
                          {total > 0 ? total : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
