import { useState, useEffect, useCallback } from 'react'
import { collectionsApi } from '../../api'
import { Modal } from '../Tasks/TaskForm'
import { PRESET_CATEGORIES } from './inventoryUtils'

// ── Collections list ──────────────────────────────────────────────────────────

export default function CollectionsTab() {
  const [collections, setCollections] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showNew,     setShowNew]     = useState(false)
  const [selected,    setSelected]    = useState(null) // collection obj

  const load = useCallback(async () => {
    setLoading(true)
    try { setCollections(await collectionsApi.list()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (selected) return (
    <CollectionDetail
      collection={selected}
      onBack={() => { setSelected(null); load() }}
    />
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{collections.length} collection{collections.length !== 1 ? 's' : ''}</p>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ New Collection</button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-16">Loading…</p>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
          <span className="text-4xl">🗂️</span>
          <p>No collections yet.</p>
          <button className="btn-primary mt-2" onClick={() => setShowNew(true)}>Create your first collection</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className="w-full text-left bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <span className="text-sm font-medium text-indigo-600">
                  {c.owned_count}/{c.item_count}
                </span>
              </div>
              {c.description && (
                <p className="text-sm text-gray-400 mb-2 line-clamp-1">{c.description}</p>
              )}
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: c.item_count ? `${Math.round((c.owned_count / c.item_count) * 100)}%` : '0%' }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {c.item_count === 0 ? 'No items yet'
                  : c.owned_count === c.item_count ? '✅ Complete!'
                  : `${c.item_count - c.owned_count} still needed`}
              </p>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <CollectionFormModal
          onClose={() => setShowNew(false)}
          onSaved={async () => { setShowNew(false); await load() }}
        />
      )}
    </div>
  )
}

// ── Collection detail ─────────────────────────────────────────────────────────

function CollectionDetail({ collection, onBack }) {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [marking,  setMarking]  = useState(null)  // item being marked owned
  const [editCol,  setEditCol]  = useState(false)
  const [col,      setCol]      = useState(collection)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await collectionsApi.listItems(col.id)) }
    finally { setLoading(false) }
  }, [col.id])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!confirm(`Delete collection "${col.name}"? This won't delete linked inventory items.`)) return
    await collectionsApi.delete(col.id)
    onBack()
  }

  const handleUnmark = async (item) => {
    if (!confirm(`Mark "${item.name}" as not owned? The inventory item won't be deleted.`)) return
    await collectionsApi.unmarkOwned(item.id)
    await load()
  }

  const owned   = items.filter(i => i.inventory_item_id)
  const needed  = items.filter(i => !i.inventory_item_id)
  const pct     = items.length ? Math.round((owned.length / items.length) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-lg leading-tight truncate">{col.name}</h2>
          {col.description && <p className="text-sm text-gray-400 truncate">{col.description}</p>}
        </div>
        <button onClick={() => setEditCol(true)}
          className="text-xs text-gray-400 hover:text-indigo-600 px-2 py-1">Edit</button>
        <button onClick={handleDelete}
          className="text-xs text-red-400 hover:text-red-600 px-2 py-1">Delete</button>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Progress</span>
          <span className="font-semibold text-indigo-600">{owned.length} / {items.length}</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {items.length === 0 ? 'Add items to track your collection'
            : pct === 100 ? '🎉 Collection complete!'
            : `${needed.length} item${needed.length !== 1 ? 's' : ''} still needed · ${pct}% complete`}
        </p>
      </div>

      {/* Add item */}
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Item</button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No items yet — add items you want to track.</p>
      ) : (
        <div className="flex flex-col gap-5">

          {/* Needed */}
          {needed.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Need ({needed.length})
              </h3>
              <div className="flex flex-col gap-2">
                {needed.map(item => (
                  <CollectionItemRow key={item.id} item={item}
                    onMarkOwned={() => setMarking(item)}
                    onDelete={async () => { await collectionsApi.deleteItem(item.id); load() }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Owned */}
          {owned.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Have ({owned.length})
              </h3>
              <div className="flex flex-col gap-2">
                {owned.map(item => (
                  <CollectionItemRow key={item.id} item={item} owned
                    onUnmark={() => handleUnmark(item)}
                    onDelete={async () => { await collectionsApi.deleteItem(item.id); load() }}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      {showAdd && (
        <AddItemModal collectionId={col.id}
          onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await load() }}
        />
      )}

      {marking && (
        <MarkOwnedModal item={marking}
          onClose={() => setMarking(null)}
          onSaved={async () => { setMarking(null); await load() }}
        />
      )}

      {editCol && (
        <CollectionFormModal collection={col}
          onClose={() => setEditCol(false)}
          onSaved={async (updated) => { setCol(c => ({ ...c, ...updated })); setEditCol(false) }}
        />
      )}
    </div>
  )
}

// ── Collection item row ───────────────────────────────────────────────────────

function CollectionItemRow({ item, owned, onMarkOwned, onUnmark, onDelete }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border
      ${owned ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100 shadow-sm'}`}>
      <span className={`text-lg shrink-0 ${owned ? 'text-green-500' : 'text-gray-300'}`}>
        {owned ? '✓' : '○'}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${owned ? 'text-green-800' : 'text-gray-800'}`}>{item.name}</p>
        {item.notes && <p className="text-xs text-gray-400 truncate">{item.notes}</p>}
        {owned && item.inventory_name && (
          <p className="text-xs text-green-600 truncate">↳ {item.inventory_name}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {!owned && (
          <button onClick={onMarkOwned}
            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700">
            Got it
          </button>
        )}
        {owned && (
          <button onClick={onUnmark}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
            Unmark
          </button>
        )}
        <button onClick={() => { if (confirm(`Remove "${item.name}" from this collection?`)) onDelete() }}
          className="text-xs text-gray-300 hover:text-red-500 px-1 py-1">✕</button>
      </div>
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function CollectionFormModal({ collection, onClose, onSaved }) {
  const [name, setName]   = useState(collection?.name ?? '')
  const [desc, setDesc]   = useState(collection?.description ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      if (collection) {
        await collectionsApi.update(collection.id, { name: name.trim(), description: desc.trim() })
        onSaved({ name: name.trim(), description: desc.trim() })
      } else {
        await collectionsApi.create({ name: name.trim(), description: desc.trim() })
        onSaved()
      }
    } finally { setSaving(false) }
  }

  return (
    <Modal title={collection ? 'Edit Collection' : 'New Collection'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vinyl Records" />
        </div>
        <div>
          <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
          <input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What are you collecting?" />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary w-full sm:w-auto justify-center" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : collection ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AddItemModal({ collectionId, onClose, onSaved }) {
  const [name,  setName]  = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await collectionsApi.createItem(collectionId, { name: name.trim(), notes: notes.trim() })
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Add Item to Collection" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Item name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dark Side of the Moon" />
        </div>
        <div>
          <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Edition, colour, etc." />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary w-full sm:w-auto justify-center" disabled={saving || !name.trim()}>
            {saving ? 'Adding…' : 'Add Item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function MarkOwnedModal({ item, onClose, onSaved }) {
  const [category, setCategory] = useState('Collectibles')
  const [notes,    setNotes]    = useState(item.notes ?? '')
  const [saving,   setSaving]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await collectionsApi.markOwned(item.id, { category, notes: notes.trim() || null })
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Got it: ${item.name}`} onClose={onClose}>
      <p className="text-sm text-gray-500 mb-4">
        This will add <strong>{item.name}</strong> to your inventory and mark it as owned.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Inventory category</label>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            {['Collectibles', ...PRESET_CATEGORIES.filter(c => c !== 'Collectibles')].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condition, where you got it…" />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary w-full sm:w-auto justify-center" disabled={saving}>
            {saving ? 'Saving…' : '✓ Mark as Owned'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
