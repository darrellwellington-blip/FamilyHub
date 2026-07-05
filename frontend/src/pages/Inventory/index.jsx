import { useState, useEffect, useCallback } from 'react'
import { inventoryApi } from '../../api'
import {
  sortItems, groupByCategory, sortedCategoryKeys,
  expiryInfo, totalQuantity, EXPIRY_CARD, EXPIRY_BADGE,
  CATEGORY_ICONS, PRESET_CATEGORIES, fmtDate,
} from './inventoryUtils'
import InventoryDetail  from './InventoryDetail'
import InventoryForm    from './InventoryForm'
import RemoveModal      from './RemoveModal'
import CollectionsTab   from './CollectionsTab'
import ReceiptScanner   from './ReceiptScanner'

export default function Inventory() {
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState('active')  // 'active' | 'history' | 'collections'
  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [locFilter,  setLocFilter]  = useState('')
  const [viewing,    setViewing]    = useState(null)   // item obj for detail
  const [editing,    setEditing]    = useState(null)   // null | 'new' | item obj
  const [removing,   setRemoving]   = useState(null)   // item obj for remove modal
  const [scanning,   setScanning]   = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const status = view === 'history' ? 'history' : 'active'
      setItems(await inventoryApi.list({ status }))
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { window.scrollTo(0, 0) }, [])
  useEffect(() => { load() }, [load])

  // ── Derived filter options ──────────────────────────────────────────────────

  const allCats  = [...new Set(items.map(i => i.category).filter(Boolean))].sort((a, b) => {
    const ia = PRESET_CATEGORIES.indexOf(a), ib = PRESET_CATEGORIES.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1; if (ib !== -1) return 1
    return a.localeCompare(b)
  })
  const allLocs  = [...new Set(items.map(i => i.location).filter(Boolean))].sort()
  const allStores = [...new Set(items.map(i => i.store).filter(Boolean))].sort()

  // ── Filter & group ──────────────────────────────────────────────────────────

  const filtered = items.filter(item => {
    if (catFilter && item.category !== catFilter) return false
    if (locFilter && item.location !== locFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !item.name?.toLowerCase().includes(q) &&
        !item.description?.toLowerCase().includes(q) &&
        !item.location?.toLowerCase().includes(q) &&
        !item.notes?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // When a category filter is active, show a flat sorted list.
  // Otherwise group by category.
  const useGrouped = !catFilter

  const groups  = useGrouped ? groupByCategory(filtered) : null
  const catKeys = useGrouped ? sortedCategoryKeys(groups) : null
  const flatList = !useGrouped ? sortItems(filtered) : null

  // Stats for active view
  const expiringSoon = view === 'active'
    ? items.filter(i => { const e = expiryInfo(i); return e && e.status !== 'ok' }).length
    : 0

  // ── Callbacks ───────────────────────────────────────────────────────────────

  const afterChange = useCallback(async () => {
    await load()
    setViewing(null)
    setRemoving(null)
    setEditing(null)
  }, [load])

  const openEdit = (item) => {
    setViewing(null)
    setEditing(item)
  }

  const openRemove = (item) => {
    setViewing(null)
    setRemoving(item)
  }

  const handleSaved = useCallback(async () => { await load() }, [load])

  return (
    <div>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          {!loading && view !== 'collections' && (
            <p className="text-sm text-gray-400 mt-0.5">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {expiringSoon > 0 && (
                <span className="ml-2 text-amber-600 font-medium">· {expiringSoon} expiring soon</span>
              )}
            </p>
          )}
        </div>
        {view !== 'collections' && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setScanning(true)}>🧾 Scan Receipt</button>
            <button className="btn-primary"   onClick={() => setEditing('new')}>+ Add Item</button>
          </div>
        )}
      </div>

      {/* ── View tabs ─────────────────────────────────────────────────────── */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-4 shrink-0 self-start">
        {[{ key: 'active', label: 'Active' }, { key: 'history', label: 'History' }, { key: 'collections', label: '🗂 Collections' }].map(t => (
          <button key={t.key}
            onClick={() => { setView(t.key); setCatFilter(''); setLocFilter(''); setSearch('') }}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              view === t.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Toolbar (hidden on collections tab) ───────────────────────────── */}
      {view !== 'collections' && (
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex gap-2 items-center">
            <input className="input flex-1" placeholder="Search items…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <select className="input flex-1" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">All categories</option>
              {allCats.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] ?? ''} {c}</option>)}
            </select>
            <select className="input flex-1" value={locFilter} onChange={e => setLocFilter(e.target.value)}>
              <option value="">All locations</option>
              {allLocs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ── Collections tab ───────────────────────────────────────────────── */}
      {view === 'collections' && <CollectionsTab />}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {view !== 'collections' && loading ? (
        <p className="text-center text-gray-400 py-16">Loading…</p>
      ) : view !== 'collections' && filtered.length === 0 ? (
        <EmptyState view={view} searched={Boolean(search || catFilter || locFilter)} onAdd={() => setEditing('new')} />
      ) : view !== 'collections' && useGrouped ? (
        /* ── Grouped by category ─────────────────────────────────────── */
        <div className="flex flex-col gap-8">
          {catKeys.map(cat => (
            <section key={cat}>
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                <span>{CATEGORY_ICONS[cat] ?? '📁'}</span>
                <span>{cat}</span>
                <span className="text-gray-300">({groups[cat].length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortItems(groups[cat]).map(item => (
                  <ItemCard key={item.id} item={item} onClick={() => setViewing(item)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : view !== 'collections' ? (
        /* ── Flat list (category filter active) ──────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {flatList.map(item => (
            <ItemCard key={item.id} item={item} onClick={() => setViewing(item)} />
          ))}
        </div>
      ) : null}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {viewing && (
        <InventoryDetail
          item={viewing}
          storeNames={allStores}
          onClose={() => setViewing(null)}
          onEdit={openEdit}
          onRemove={openRemove}
          onDeleted={afterChange}
          onRestored={afterChange}
        />
      )}

      {editing && (
        <InventoryForm
          item={editing === 'new' ? null : editing}
          locationNames={allLocs}
          storeNames={allStores}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {removing && (
        <RemoveModal
          item={removing}
          onClose={() => setRemoving(null)}
          onRemoved={afterChange}
        />
      )}

      {scanning && (
        <ReceiptScanner
          onClose={() => setScanning(false)}
          onAdded={async () => { await load(); setScanning(false) }}
        />
      )}

    </div>
  )
}

/* ── Item card ─────────────────────────────────────────────────────────────── */

function ItemCard({ item, onClick }) {
  const expiry = expiryInfo(item)
  const cardCls = expiry ? EXPIRY_CARD[expiry.status] : 'border-l-4 border-transparent bg-white'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl shadow-sm p-3 flex gap-3
                  hover:shadow-md transition-shadow group ${cardCls}`}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100
                      flex items-center justify-center text-2xl">
        <span>{CATEGORY_ICONS[item.category] ?? '📦'}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm leading-snug truncate">{item.name}</p>

        {/* Location + qty */}
        <p className="text-xs text-gray-400 mt-0.5">
          {[
            item.location,
            totalQuantity(item) != null
              ? `${totalQuantity(item)}${item.unit ? ' ' + item.unit : ''}`
              : null,
          ].filter(Boolean).join(' · ')}
        </p>

        {/* Expiry */}
        {expiry && (
          <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded font-medium ${EXPIRY_BADGE[expiry.status]}`}>
            {expiry.label}
          </span>
        )}

        {/* History status */}
        {item.status !== 'active' && (
          <span className="inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {item.status === 'consumed' ? '✅ Consumed' : '🗑 Disposed'}
            {item.removed_at ? ` · ${fmtDate(item.removed_at.slice(0, 10))}` : ''}
          </span>
        )}
      </div>
    </button>
  )
}

/* ── Empty state ───────────────────────────────────────────────────────────── */

function EmptyState({ view, searched, onAdd }) {
  if (searched) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">🔍</p>
        <p>No items match your filters.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
      <span className="text-4xl">📦</span>
      <p className="text-base">
        {view === 'history' ? 'No consumed or disposed items yet.' : 'No inventory items yet.'}
      </p>
      {view === 'active' && (
        <button className="btn-primary mt-2" onClick={onAdd}>Add your first item</button>
      )}
    </div>
  )
}
