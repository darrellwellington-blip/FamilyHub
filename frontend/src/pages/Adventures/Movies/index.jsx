import { useState, useEffect, useCallback } from 'react'
import { moviesApi, adventuresApi, usersApi } from '../../../api'
import { Modal } from '../../Tasks/TaskForm'
import ViewingModal from './ViewingModal'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function Stars({ value }) {
  if (!value) return null
  return <span className="text-yellow-400 text-xs">{'★'.repeat(Math.round(value))}{'☆'.repeat(5 - Math.round(value))}</span>
}

function ViewingRow({ viewing, onEdit, onDelete }) {
  const names = [
    ...(viewing.users   || []).map(u => u.name),
    ...(viewing.friends || []).map(f => [f.first_name, f.last_name].filter(Boolean).join(' ')),
  ]
  const ratings = Object.values(viewing.ratings || {})

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          {viewing.viewed_at && <span className="text-xs text-gray-500">{fmtDate(viewing.viewed_at)}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            viewing.venue_type === 'theater'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {viewing.venue_type === 'theater' ? `🎬 ${viewing.theater_name || 'Theater'}` : '🏠 Home'}
          </span>
        </div>
        {Object.keys(viewing.ratings || {}).length > 0 && (
          <div className="flex flex-wrap gap-3 mb-0.5">
            {Object.entries(viewing.ratings).map(([uid, rating]) => {
              const user = (viewing.users || []).find(u => String(u.id) === uid)
              if (!user) return null
              return (
                <span key={uid} className="text-xs text-gray-500">
                  {user.name}: <Stars value={rating} />
                </span>
              )
            })}
          </div>
        )}
        {names.length > 0 && <p className="text-xs text-gray-400">{names.join(', ')}</p>}
        {viewing.notes && <p className="text-xs text-gray-500 italic">"{viewing.notes}"</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onEdit(viewing)} className="text-xs text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50">Edit</button>
        <button onClick={() => onDelete(viewing.id)} className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">Del</button>
      </div>
    </div>
  )
}

function MovieRow({ movie, users, friends, onDeleted }) {
  const [open,     setOpen]     = useState(false)
  const [viewings, setViewings] = useState(null)
  const [modal,    setModal]    = useState(null)

  const load = useCallback(async () => {
    setViewings(await moviesApi.listViewings(movie.id))
  }, [movie.id])

  const handleToggle = async () => {
    if (!open && viewings === null) await load()
    setOpen(o => !o)
  }

  const handleDeleteViewing = async (id) => {
    if (!confirm('Delete this viewing?')) return
    await moviesApi.deleteViewing(id)
    await load()
  }

  const handleDeleteMovie = async () => {
    if (!confirm(`Delete "${movie.title}" and all its viewings?`)) return
    await moviesApi.delete(movie.id)
    onDeleted()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900">{movie.title}</span>
          {movie.year && <span className="ml-2 text-xs text-gray-400">({movie.year})</span>}
          {movie.genre && <span className="ml-2 text-xs text-gray-400">· {movie.genre}</span>}
          {movie.avg_rating && <span className="ml-2"><Stars value={movie.avg_rating} /></span>}
          <span className="ml-2 text-xs text-gray-400">
            · {movie.viewing_count} viewing{movie.viewing_count !== 1 ? 's' : ''}
            {movie.last_viewed_at && ` · last ${fmtDate(movie.last_viewed_at)}`}
          </span>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary text-xs py-1 px-2.5 shrink-0">+ Log</button>
        {movie.viewing_count > 0 && (
          <button onClick={handleToggle} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
            {open ? '▲' : '▼'}
          </button>
        )}
        <button onClick={handleDeleteMovie} className="text-xs text-red-400 hover:text-red-600 shrink-0">✕</button>
      </div>

      {open && viewings !== null && (
        <div className="px-4 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
          {viewings.map(v => (
            <ViewingRow key={v.id} viewing={v}
              onEdit={v => setModal(v)}
              onDelete={handleDeleteViewing} />
          ))}
        </div>
      )}

      {modal !== null && (
        <ViewingModal movie={movie} viewing={modal === 'new' ? null : modal}
          users={users} friends={friends}
          onClose={() => setModal(null)}
          onSaved={async () => { await load() }} />
      )}
    </div>
  )
}

function AddMovieModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', year: '', genre: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await moviesApi.create({
      title: form.title.trim(),
      year:  form.year ? Number(form.year) : null,
      genre: form.genre.trim() || null,
    })
    await onSaved()
    onClose()
  }

  return (
    <Modal title="Add Movie" onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="label">Title *</label>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">Year</label>
            <input type="number" className="input" placeholder="2024"
              value={form.year} onChange={e => set('year', e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="label">Genre</label>
            <input className="input" placeholder="Comedy"
              value={form.genre} onChange={e => set('genre', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add Movie'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Movies() {
  const [movies,   setMovies]   = useState([])
  const [users,    setUsers]    = useState([])
  const [friends,  setFriends]  = useState([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)

  const loadMovies = useCallback(async () => {
    setMovies(await moviesApi.list(search))
  }, [search])

  useEffect(() => {
    async function init() {
      const [userList, friendList] = await Promise.all([
        usersApi.list(),
        adventuresApi.listFriends(),
      ])
      setUsers(userList); setFriends(friendList)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => { loadMovies() }, [loadMovies])

  if (loading) return <div className="text-gray-400 text-sm p-8">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Movies</h1>
        <div className="flex gap-2">
          <input className="input w-48 text-sm" placeholder="Search movies…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">+ Add Movie</button>
        </div>
      </div>

      {movies.length === 0
        ? <p className="text-gray-400 text-sm">{search ? 'No movies match your search.' : 'No movies yet. Add one above!'}</p>
        : movies.map(m => (
            <MovieRow key={m.id} movie={m} users={users} friends={friends}
              onDeleted={loadMovies} />
          ))
      }

      {showAdd && <AddMovieModal onClose={() => setShowAdd(false)} onSaved={loadMovies} />}
    </div>
  )
}
