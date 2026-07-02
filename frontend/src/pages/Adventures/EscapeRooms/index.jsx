import { useState, useEffect, useCallback } from 'react'
import { adventuresApi, usersApi } from '../../../api'
import { useUser } from '../../../UserContext'
import { Modal } from '../../Tasks/TaskForm'
import CompletionModal from './CompletionModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function EscapedBadge({ escaped }) {
  if (escaped === 1)    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Escaped ✓</span>
  if (escaped === 0)    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">No escape</span>
  return null
}

function StarRow({ rating }) {
  if (!rating) return null
  return (
    <span className="text-yellow-400 text-xs">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
  )
}

// ── Completion history row ────────────────────────────────────────────────────

function CompletionRow({ comp, onEdit, onDelete }) {
  const names = [
    ...(comp.users   || []).map(u => u.name),
    ...(comp.friends || []).map(f => [f.first_name, f.last_name].filter(Boolean).join(' ')),
  ]
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          {comp.played_at && <span className="text-xs text-gray-500">{fmtDate(comp.played_at)}</span>}
          <EscapedBadge escaped={comp.escaped} />
          {comp.time_taken_mins && (
            <span className="text-xs text-gray-500">{comp.time_taken_mins} min</span>
          )}
          <StarRow rating={comp.rating} />
        </div>
        {names.length > 0 && (
          <p className="text-xs text-gray-500 truncate">{names.join(', ')}</p>
        )}
        {comp.notes && <p className="text-xs text-gray-600 mt-0.5 italic">"{comp.notes}"</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onEdit(comp)}
          className="text-xs text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50">Edit</button>
        <button onClick={() => onDelete(comp.id)}
          className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">Del</button>
      </div>
    </div>
  )
}

// ── Room row ──────────────────────────────────────────────────────────────────

function RoomRow({ room, venueName, users, friends, onUpdated }) {
  const [open,        setOpen]        = useState(false)
  const [completions, setCompletions] = useState(null)
  const [modal,       setModal]       = useState(null)  // null | 'new' | completion obj

  const loadCompletions = useCallback(async () => {
    const data = await adventuresApi.listCompletions(room.id)
    setCompletions(data)
  }, [room.id])

  const handleToggle = async () => {
    if (!open && completions === null) await loadCompletions()
    setOpen(o => !o)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this completion?')) return
    await adventuresApi.deleteCompletion(id)
    await loadCompletions()
    onUpdated()
  }

  const hasCompleted = room.completion_count > 0

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white">
        {/* Completed indicator */}
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          hasCompleted ? 'bg-green-400' : 'bg-gray-200'
        }`} />

        {/* Room name + meta */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800">{room.name}</span>
          <span className="ml-2 text-xs text-gray-400">
            {room.min_participants}–{room.max_participants} players
          </span>
          {hasCompleted && (
            <span className="ml-2 text-xs text-gray-400">
              · {room.completion_count}× played
              {room.last_played_at && ` · last ${fmtDate(room.last_played_at)}`}
            </span>
          )}
        </div>

        {/* Last escaped badge */}
        {hasCompleted && <EscapedBadge escaped={room.last_escaped} />}

        {/* Actions */}
        <button onClick={() => setModal('new')}
          className="btn-primary text-xs py-1 px-2.5 shrink-0">+ Log</button>
        {hasCompleted && (
          <button onClick={handleToggle}
            className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
            {open ? '▲ Hide' : '▼ History'}
          </button>
        )}
      </div>

      {/* History panel */}
      {open && completions !== null && (
        <div className="px-4 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
          {completions.length === 0
            ? <p className="text-xs text-gray-400">No completions yet.</p>
            : completions.map(c => (
                <CompletionRow key={c.id} comp={c}
                  onEdit={c => setModal(c)}
                  onDelete={handleDelete} />
              ))
          }
        </div>
      )}

      {/* Log / Edit modal */}
      {modal !== null && (
        <CompletionModal
          room={room}
          venueName={venueName}
          completion={modal === 'new' ? null : modal}
          users={users}
          friends={friends}
          onClose={() => setModal(null)}
          onSaved={async () => { await loadCompletions(); onUpdated() }}
        />
      )}
    </div>
  )
}

// ── Venue card ────────────────────────────────────────────────────────────────

function VenueCard({ venue, users, friends, onUpdated }) {
  const [open,  setOpen]  = useState(false)
  const [rooms, setRooms] = useState(null)

  const loadRooms = useCallback(async () => {
    const data = await adventuresApi.listRooms(venue.id)
    setRooms(data)
  }, [venue.id])

  const handleToggle = async () => {
    if (!open && rooms === null) await loadRooms()
    setOpen(o => !o)
  }

  const pct = venue.room_count > 0
    ? Math.round((venue.rooms_completed / venue.room_count) * 100)
    : 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900">{venue.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {venue.rooms_completed}/{venue.room_count} rooms completed
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-24 shrink-0">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-2 bg-indigo-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 text-right mt-0.5">{pct}%</div>
        </div>

        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && rooms !== null && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3">
            {rooms.map(r => (
              <RoomRow
                key={r.id}
                room={r}
                venueName={venue.name}
                users={users}
                friends={friends}
                onUpdated={() => loadRooms()}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Friends manager modal ─────────────────────────────────────────────────────

function FriendsModal({ friends, onClose, onSaved }) {
  const [list,    setList]    = useState(friends)
  const [newForm, setNewForm] = useState({ first_name: '', last_name: '', email: '' })
  const [saving,  setSaving]  = useState(false)

  const handleAdd = async () => {
    if (!newForm.first_name.trim()) return
    setSaving(true)
    const f = await adventuresApi.createFriend(newForm)
    setList(l => [...l, f])
    setNewForm({ first_name: '', last_name: '', email: '' })
    setSaving(false)
    onSaved()
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this friend?')) return
    await adventuresApi.deleteFriend(id)
    setList(l => l.filter(f => f.id !== id))
    onSaved()
  }

  return (
    <Modal title="Manage Friends" onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col gap-3">
        {list.map(f => (
          <div key={f.id} className="flex items-center justify-between text-sm">
            <span>{[f.first_name, f.last_name].filter(Boolean).join(' ')}
              {f.email && <span className="text-gray-400 ml-2 text-xs">{f.email}</span>}
            </span>
            <button onClick={() => handleDelete(f.id)}
              className="text-red-400 hover:text-red-600 text-xs">Remove</button>
          </div>
        ))}

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Add friend</p>
          <div className="flex gap-2 mb-2">
            <input className="input" placeholder="First name *"
              value={newForm.first_name}
              onChange={e => setNewForm(f => ({ ...f, first_name: e.target.value }))} />
            <input className="input" placeholder="Last name"
              value={newForm.last_name}
              onChange={e => setNewForm(f => ({ ...f, last_name: e.target.value }))} />
          </div>
          <input className="input mb-2" placeholder="Email (optional)"
            value={newForm.email}
            onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
          <button onClick={handleAdd} disabled={saving} className="btn-primary w-full">
            {saving ? 'Adding…' : 'Add Friend'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Preferences modal ─────────────────────────────────────────────────────────

function PrefsModal({ cities, currentCityId, userId, onClose, onSaved }) {
  const [cityId, setCityId] = useState(currentCityId ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await adventuresApi.savePrefs(userId, { default_city_id: cityId || null })
    onSaved(Number(cityId))
    onClose()
  }

  return (
    <Modal title="City Preferences" onClose={onClose} maxWidth="max-w-sm">
      <div className="flex flex-col gap-4">
        <div>
          <label className="label">Default city</label>
          <select className="input" value={cityId} onChange={e => setCityId(e.target.value)}>
            <option value="">— select —</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}, {c.province}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Filtered room list ────────────────────────────────────────────────────────

function FilteredView({ cityId, selectedUserIds, selectedFriendIds, mode, users, friends, onUpdated }) {
  const [venues,  setVenues]  = useState(null)
  const [modal,   setModal]   = useState(null) // { room, venueName }

  useEffect(() => {
    if (!cityId) return
    const params = {
      city_id:    cityId,
      mode,
      user_ids:   selectedUserIds.join(','),
      friend_ids: selectedFriendIds.join(','),
    }
    adventuresApi.filterRooms(params).then(setVenues).catch(() => setVenues([]))
  }, [cityId, selectedUserIds, selectedFriendIds, mode])

  if (venues === null) return <p className="text-gray-400 text-sm text-center py-10">Loading…</p>

  const totalRooms = venues.reduce((s, v) => s + v.rooms.length, 0)

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        {totalRooms === 0
          ? (mode === 'new' ? 'No unvisited rooms for the selected people.' : 'No completed rooms for the selected people.')
          : `${totalRooms} room${totalRooms !== 1 ? 's' : ''} found`}
      </p>
      {venues.map(v => v.rooms.length === 0 ? null : (
        <div key={v.id} className="mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">{v.name}</h3>
          {v.rooms.map(room => (
            <div key={room.id} className="border border-gray-100 rounded-lg overflow-hidden mb-2 bg-white">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  room.total_completions > 0 ? 'bg-green-400' : 'bg-gray-200'
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800">{room.name}</span>
                  {room.min_participants && (
                    <span className="ml-2 text-xs text-gray-400">
                      {room.min_participants}–{room.max_participants} players
                    </span>
                  )}
                  {room.difficulty && (
                    <span className="ml-2 text-xs text-gray-400">{room.difficulty}</span>
                  )}
                  {room.total_completions > 0 && (
                    <span className="ml-2 text-xs text-gray-400">
                      · {room.total_completions}× played
                      {room.last_played_at && ` · last ${fmtDate(room.last_played_at)}`}
                    </span>
                  )}
                </div>
                {room.total_completions > 0 && <EscapedBadge escaped={room.last_escaped} />}
                <button onClick={() => setModal({ room, venueName: v.name })}
                  className="btn-primary text-xs py-1 px-2.5 shrink-0">+ Log</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {modal && (
        <CompletionModal
          room={modal.room}
          venueName={modal.venueName}
          completion={null}
          users={users}
          friends={friends}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onUpdated() }}
        />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EscapeRooms() {
  const { currentUser } = useUser()
  const [cities,   setCities]   = useState([])
  const [cityId,   setCityId]   = useState(null)
  const [venues,   setVenues]   = useState([])
  const [users,    setUsers]    = useState([])
  const [friends,  setFriends]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showFriends, setShowFriends] = useState(false)
  const [showPrefs,   setShowPrefs]   = useState(false)
  const [venueKey, setVenueKey] = useState(0)

  // People filter state
  const [selUserIds,   setSelUserIds]   = useState([])
  const [selFriendIds, setSelFriendIds] = useState([])
  const [filterMode,   setFilterMode]   = useState('new') // 'new' | 'completed'
  const isFiltering = selUserIds.length > 0 || selFriendIds.length > 0

  const toggleUser = id => setSelUserIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleFriend = id => setSelFriendIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const loadFriends = useCallback(async () => {
    const data = await adventuresApi.listFriends()
    setFriends(data)
  }, [])

  useEffect(() => {
    async function init() {
      const [cityList, prefs, userList, friendList] = await Promise.all([
        adventuresApi.listCities(),
        currentUser ? adventuresApi.getPrefs(currentUser.id) : Promise.resolve({}),
        usersApi.list(),
        adventuresApi.listFriends(),
      ])
      setCities(cityList)
      setUsers(userList)
      setFriends(friendList)
      const defaultCity = prefs.default_city_id ?? cityList[0]?.id ?? null
      setCityId(defaultCity)
      setLoading(false)
    }
    init()
  }, [currentUser])

  const loadVenues = useCallback(async () => {
    if (!cityId) return
    const data = await adventuresApi.listVenues(cityId)
    setVenues(data)
  }, [cityId])

  useEffect(() => { loadVenues() }, [loadVenues])

  const currentCity = cities.find(c => c.id === cityId)

  if (loading) return <div className="text-gray-400 text-sm p-8">Loading…</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escape Rooms</h1>
          {currentCity && (
            <p className="text-sm text-gray-500 mt-0.5">{currentCity.name}, {currentCity.province}</p>
          )}
        </div>
        <div className="flex gap-2">
          <select className="input w-auto text-sm" value={cityId ?? ''}
            onChange={e => setCityId(Number(e.target.value))}>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowFriends(true)} className="btn-secondary text-sm">Friends</button>
          <button onClick={() => setShowPrefs(true)} className="btn-secondary text-sm">⚙ Prefs</button>
        </div>
      </div>

      {/* ── People picker ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Select people to filter rooms
        </p>

        {/* Family */}
        {users.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1.5">Family</p>
            <div className="flex flex-wrap gap-2">
              {users.map(u => (
                <button key={u.id} type="button" onClick={() => toggleUser(u.id)}
                  className={`btn border text-sm transition-colors ${
                    selUserIds.includes(u.id)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Friends */}
        {friends.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1.5">Friends</p>
            <div className="flex flex-wrap gap-2">
              {friends.map(f => {
                const name = [f.first_name, f.last_name].filter(Boolean).join(' ')
                return (
                  <button key={f.id} type="button" onClick={() => toggleFriend(f.id)}
                    className={`btn border text-sm transition-colors ${
                      selFriendIds.includes(f.id)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-200 text-gray-600 hover:border-purple-300'
                    }`}>
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Mode toggle — only visible when someone is selected */}
        {isFiltering && (
          <div className="border-t border-gray-100 pt-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Show:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {[
                { key: 'new',       label: '✨ New for everyone' },
                { key: 'completed', label: '🏆 Already done' },
              ].map(m => (
                <button key={m.key} type="button" onClick={() => setFilterMode(m.key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    filterMode === m.key
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setSelUserIds([]); setSelFriendIds([]) }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Clear
            </button>
          </div>
        )}

        {!isFiltering && (
          <p className="text-xs text-gray-400 mt-1">
            Select people above to see which rooms are new for the group or which ones you've done together.
          </p>
        )}
      </div>

      {/* ── Filtered view or normal venue list ──────────────────────────── */}
      {isFiltering ? (
        <FilteredView
          key={`${selUserIds.join()}-${selFriendIds.join()}-${filterMode}`}
          cityId={cityId}
          selectedUserIds={selUserIds}
          selectedFriendIds={selFriendIds}
          mode={filterMode}
          users={users}
          friends={friends}
          onUpdated={() => { loadVenues(); setVenueKey(k => k + 1) }}
        />
      ) : (
        <>
          {/* Summary stats */}
          {venues.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Venues',          value: venues.length },
                { label: 'Rooms completed', value: venues.reduce((s,v) => s + v.rooms_completed, 0) },
                { label: 'Total rooms',     value: venues.reduce((s,v) => s + v.room_count, 0) },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {venues.length === 0
            ? <p className="text-gray-400 text-sm">No venues found for this city.</p>
            : venues.map(v => (
                <VenueCard key={`${v.id}-${venueKey}`} venue={v}
                  users={users} friends={friends}
                  onUpdated={() => { loadVenues(); setVenueKey(k => k + 1) }} />
              ))
          }
        </>
      )}

      {showFriends && (
        <FriendsModal friends={friends} onClose={() => setShowFriends(false)} onSaved={loadFriends} />
      )}
      {showPrefs && currentUser && (
        <PrefsModal cities={cities} currentCityId={cityId} userId={currentUser.id}
          onClose={() => setShowPrefs(false)} onSaved={id => setCityId(id)} />
      )}
    </div>
  )
}
