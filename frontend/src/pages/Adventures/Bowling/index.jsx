import { useState, useEffect, useCallback } from 'react'
import { bowlingApi, adventuresApi, usersApi } from '../../../api'
import { useUser } from '../../../UserContext'
import { Modal } from '../../Tasks/TaskForm'
import BowlingSessionModal from './SessionModal'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function SessionRow({ session, venue, users, friends, onEdit, onDelete }) {
  const names = [
    ...(session.users   || []).map(u => u.name),
    ...(session.friends || []).map(f => [f.first_name, f.last_name].filter(Boolean).join(' ')),
  ]
  const scores = session.scores || {}
  const totals = Object.entries(scores).map(([uid, s]) => ({
    name: s.name,
    total: s.games.reduce((a, b) => a + (Number(b) || 0), 0),
  })).sort((a, b) => b.total - a.total)
  const winner = totals[0]

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          {session.played_at && <span className="text-xs text-gray-500">{fmtDate(session.played_at)}</span>}
          {winner && winner.total > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              🏆 {winner.name} ({winner.total})
            </span>
          )}
        </div>
        {totals.length > 0 && totals[0].total > 0 && (
          <div className="flex flex-wrap gap-3 mb-0.5">
            {totals.map(t => (
              <span key={t.name} className="text-xs text-gray-500">
                {t.name}: <strong>{t.total}</strong>
                {scores[Object.keys(scores).find(k => scores[k].name === t.name)]?.games.length > 1 && (
                  <span className="text-gray-400 ml-1">
                    ({scores[Object.keys(scores).find(k => scores[k].name === t.name)].games.join(' / ')})
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
        {names.length > 0 && <p className="text-xs text-gray-400">{names.join(', ')}</p>}
        {session.notes && <p className="text-xs text-gray-500 italic">"{session.notes}"</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onEdit(session)} className="text-xs text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50">Edit</button>
        <button onClick={() => onDelete(session.id)} className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">Del</button>
      </div>
    </div>
  )
}

function VenueCard({ venue, users, friends }) {
  const [open,     setOpen]     = useState(false)
  const [sessions, setSessions] = useState(null)
  const [modal,    setModal]    = useState(null)

  const load = useCallback(async () => {
    setSessions(await bowlingApi.listSessions(venue.id))
  }, [venue.id])

  const handleToggle = async () => {
    if (!open && sessions === null) await load()
    setOpen(o => !o)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this session?')) return
    await bowlingApi.deleteSession(id)
    await load()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900">{venue.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {venue.session_count} session{venue.session_count !== 1 ? 's' : ''}
            {venue.last_played_at && ` · last ${fmtDate(venue.last_played_at)}`}
          </div>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary text-sm">+ Log Session</button>
        {venue.session_count > 0 && (
          <button onClick={handleToggle} className="text-sm text-gray-400 hover:text-gray-600">
            {open ? '▲ Hide' : '▼ History'}
          </button>
        )}
      </div>

      {open && sessions !== null && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3">
          {sessions.map(s => (
            <SessionRow key={s.id} session={s} venue={venue} users={users} friends={friends}
              onEdit={s => setModal(s)} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {modal !== null && (
        <BowlingSessionModal venue={venue} session={modal === 'new' ? null : modal}
          users={users} friends={friends}
          onClose={() => setModal(null)}
          onSaved={async () => { await load() }} />
      )}
    </div>
  )
}

function AddVenueModal({ cityId, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await bowlingApi.createVenue({ city_id: cityId, name: name.trim() })
    await onSaved()
    onClose()
  }

  return (
    <Modal title="Add Bowling Venue" onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="label">Venue name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add Venue'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Bowling() {
  const { currentUser } = useUser()
  const [cities,  setCities]  = useState([])
  const [cityId,  setCityId]  = useState(null)
  const [venues,  setVenues]  = useState([])
  const [users,   setUsers]   = useState([])
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const loadVenues = useCallback(async () => {
    if (!cityId) return
    setVenues(await bowlingApi.listVenues(cityId))
  }, [cityId])

  useEffect(() => {
    async function init() {
      const [cityList, prefs, userList, friendList] = await Promise.all([
        adventuresApi.listCities(),
        currentUser ? adventuresApi.getPrefs(currentUser.id) : Promise.resolve({}),
        usersApi.list(),
        adventuresApi.listFriends(),
      ])
      setCities(cityList); setUsers(userList); setFriends(friendList)
      setCityId(prefs.default_city_id ?? cityList[0]?.id ?? null)
      setLoading(false)
    }
    init()
  }, [currentUser])

  useEffect(() => { loadVenues() }, [loadVenues])

  if (loading) return <div className="text-gray-400 text-sm p-8">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Bowling</h1>
        <div className="flex gap-2">
          <select className="input w-auto text-sm" value={cityId ?? ''}
            onChange={e => setCityId(Number(e.target.value))}>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">+ Add Venue</button>
        </div>
      </div>
      {venues.length === 0
        ? <p className="text-gray-400 text-sm">No bowling venues yet. Add one above!</p>
        : venues.map(v => <VenueCard key={v.id} venue={v} users={users} friends={friends} />)
      }
      {showAdd && <AddVenueModal cityId={cityId} onClose={() => setShowAdd(false)} onSaved={loadVenues} />}
    </div>
  )
}
