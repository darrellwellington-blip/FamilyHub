import { useState, useEffect, useCallback } from 'react'
import { miniGolfApi, adventuresApi, usersApi } from '../../../api'
import { useUser } from '../../../UserContext'
import { Modal } from '../../Tasks/TaskForm'
import SessionModal from './SessionModal'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function SessionRow({ session, users, friends, course, venueName, onEdit, onDelete }) {
  const names = [
    ...(session.users   || []).map(u => u.name),
    ...(session.friends || []).map(f => [f.first_name, f.last_name].filter(Boolean).join(' ')),
  ]
  const scores = Object.values(session.scores || {})
  const winner = scores.length > 0
    ? scores.reduce((a, b) => a.total_score < b.total_score ? a : b)
    : null

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          {session.played_at && <span className="text-xs text-gray-500">{fmtDate(session.played_at)}</span>}
          {winner && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">🏆 {winner.name} ({winner.total_score})</span>}
        </div>
        {scores.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-0.5">
            {Object.values(session.scores).map(s => (
              <span key={s.user_id} className="text-xs text-gray-500">{s.name}: <strong>{s.total_score}</strong></span>
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

function CourseRow({ course, venueName, users, friends }) {
  const [open,     setOpen]     = useState(false)
  const [sessions, setSessions] = useState(null)
  const [modal,    setModal]    = useState(null)

  const load = useCallback(async () => {
    setSessions(await miniGolfApi.listSessions(course.id))
  }, [course.id])

  const handleToggle = async () => {
    if (!open && sessions === null) await load()
    setOpen(o => !o)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this session?')) return
    await miniGolfApi.deleteSession(id)
    await load()
  }

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${course.session_count > 0 ? 'bg-green-400' : 'bg-gray-200'}`} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800">{course.name}</span>
          <span className="ml-2 text-xs text-gray-400">{course.holes} holes</span>
          {course.session_count > 0 && (
            <span className="ml-2 text-xs text-gray-400">
              · {course.session_count}× played
              {course.last_played_at && ` · last ${fmtDate(course.last_played_at)}`}
            </span>
          )}
        </div>
        <button onClick={() => setModal('new')} className="btn-primary text-xs py-1 px-2.5 shrink-0">+ Log</button>
        {course.session_count > 0 && (
          <button onClick={handleToggle} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
            {open ? '▲ Hide' : '▼ History'}
          </button>
        )}
      </div>
      {open && sessions !== null && (
        <div className="px-4 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
          {sessions.map(s => (
            <SessionRow key={s.id} session={s} users={users} friends={friends}
              course={course} venueName={venueName}
              onEdit={s => setModal(s)} onDelete={handleDelete} />
          ))}
        </div>
      )}
      {modal !== null && (
        <SessionModal course={course} venueName={venueName}
          session={modal === 'new' ? null : modal}
          users={users} friends={friends}
          onClose={() => setModal(null)}
          onSaved={async () => { await load() }} />
      )}
    </div>
  )
}

function VenueCard({ venue, users, friends, onUpdated }) {
  const [open,    setOpen]    = useState(false)
  const [courses, setCourses] = useState(null)

  const load = useCallback(async () => {
    setCourses(await miniGolfApi.listCourses(venue.id))
  }, [venue.id])

  const handleToggle = async () => {
    if (!open && courses === null) await load()
    setOpen(o => !o)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <button onClick={handleToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900">{venue.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {venue.course_count} course{venue.course_count !== 1 ? 's' : ''}
            {venue.session_count > 0 && ` · ${venue.session_count} sessions played`}
          </div>
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && courses !== null && (
        <div className="px-4 pb-4 border-t border-gray-100 mt-0 pt-3">
          {courses.map(c => (
            <CourseRow key={c.id} course={c} venueName={venue.name}
              users={users} friends={friends} />
          ))}
        </div>
      )}
    </div>
  )
}

function AddVenueModal({ cityId, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [courseName, setCourseName] = useState('18-Hole Course')
  const [holes, setHoles] = useState(18)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const venue = await miniGolfApi.createVenue({ city_id: cityId, name: name.trim() })
    if (courseName.trim()) {
      await miniGolfApi.createCourse({ venue_id: venue.id, name: courseName.trim(), holes: Number(holes) })
    }
    await onSaved()
    onClose()
  }

  return (
    <Modal title="Add Mini Golf Venue" onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="label">Venue name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">First course name</label>
          <input className="input" value={courseName} onChange={e => setCourseName(e.target.value)} />
        </div>
        <div>
          <label className="label">Holes</label>
          <input type="number" className="input w-24" value={holes} onChange={e => setHoles(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add Venue'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function MiniGolf() {
  const { currentUser } = useUser()
  const [cities,   setCities]   = useState([])
  const [cityId,   setCityId]   = useState(null)
  const [venues,   setVenues]   = useState([])
  const [users,    setUsers]    = useState([])
  const [friends,  setFriends]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)

  const loadVenues = useCallback(async () => {
    if (!cityId) return
    setVenues(await miniGolfApi.listVenues(cityId))
  }, [cityId])

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
        <h1 className="text-2xl font-bold text-gray-900">Mini Golf</h1>
        <div className="flex gap-2">
          <select className="input w-auto text-sm" value={cityId ?? ''}
            onChange={e => setCityId(Number(e.target.value))}>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">+ Add Venue</button>
        </div>
      </div>

      {venues.length === 0
        ? <p className="text-gray-400 text-sm">No mini golf venues yet. Add one above!</p>
        : venues.map(v => (
            <VenueCard key={v.id} venue={v} users={users} friends={friends} onUpdated={loadVenues} />
          ))
      }

      {showAdd && (
        <AddVenueModal cityId={cityId} onClose={() => setShowAdd(false)} onSaved={loadVenues} />
      )}
    </div>
  )
}
