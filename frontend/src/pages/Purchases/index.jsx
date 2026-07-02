import { useState, useEffect, useCallback } from 'react'
import { purchasesApi, shoppingApi } from '../../api'
import { fmtMoney, fmtTime, fmtDateHeader, groupByDate } from './purchaseUtils'
import PurchaseDetail from './PurchaseDetail'
import PurchaseForm   from './PurchaseForm'

export default function Purchases() {
  const [purchases,  setPurchases]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [viewingId,  setViewingId]  = useState(null)
  const [editing,    setEditing]    = useState(null)   // null=closed | 'new' | purchase obj
  const [storeNames, setStoreNames] = useState([])

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadPurchases = useCallback(async () => {
    try {
      const data = await purchasesApi.list()
      setPurchases(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPurchases() }, [loadPurchases])

  // Load store names for autocomplete (combine purchases + shopping lists)
  useEffect(() => {
    shoppingApi.lists()
      .then(lists => {
        const fromLists = lists.map(l => l.store_name).filter(Boolean)
        setStoreNames(prev => {
          const merged = new Set([...prev, ...fromLists])
          return [...merged].sort()
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const fromPurchases = purchases.map(p => p.store).filter(Boolean)
    setStoreNames(prev => {
      const merged = new Set([...prev, ...fromPurchases])
      return [...merged].sort()
    })
  }, [purchases])

  // ── Filtering & grouping ────────────────────────────────────────────────────

  const filtered = search.trim()
    ? purchases.filter(p => p.store?.toLowerCase().includes(search.toLowerCase()))
    : purchases

  // purchases from API are already sorted newest-first; group by date
  const groups   = groupByDate(filtered)
  const dateKeys = Object.keys(groups).sort().reverse()

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDeleted = useCallback(() => {
    setViewingId(null)
    loadPurchases()
  }, [loadPurchases])

  const handleSaved = useCallback(async () => {
    await loadPurchases()
  }, [loadPurchases])

  const openEdit = (purchase) => {
    setViewingId(null)         // close detail first
    setEditing(purchase)
  }

  // Totals for the summary bar
  const grandTotal  = purchases.reduce((s, p) => s + (p.total ?? 0), 0)
  const thisMonth   = purchases
    .filter(p => {
      if (!p.purchased_at) return false
      const d = new Date(p.purchased_at.replace(' ', 'T') + 'Z')
      const now = new Date()
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((s, p) => s + (p.total ?? 0), 0)

  return (
    <div>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
          {!loading && purchases.length > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">
              {purchases.length} receipt{purchases.length !== 1 ? 's' : ''} ·
              <span className="text-gray-500"> This month: {fmtMoney(thisMonth)}</span>
            </p>
          )}
        </div>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          + Add Purchase
        </button>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="mb-6 max-w-xs">
        <input
          className="input"
          placeholder="Search by store…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <p className="text-center text-gray-400 py-16">Loading…</p>
      ) : dateKeys.length === 0 ? (
        <EmptyState searched={Boolean(search)} onAdd={() => setEditing('new')} />
      ) : (
        <div className="flex flex-col gap-8">
          {dateKeys.map(dateKey => (
            <section key={dateKey}>

              {/* Date heading */}
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                {fmtDateHeader(dateKey)}
              </h2>

              {/* Cards for this date */}
              <div className="flex flex-col gap-2">
                {groups[dateKey].map(purchase => (
                  <PurchaseCard
                    key={purchase.id}
                    purchase={purchase}
                    onClick={() => setViewingId(purchase.id)}
                  />
                ))}
              </div>

            </section>
          ))}
        </div>
      )}

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {viewingId && (
        <PurchaseDetail
          purchaseId={viewingId}
          onClose={() => setViewingId(null)}
          onEdit={openEdit}
          onDeleted={handleDeleted}
        />
      )}

      {/* ── Form modal ────────────────────────────────────────────────────── */}
      {editing && (
        <PurchaseForm
          purchase={editing === 'new' ? null : editing}
          storeNames={storeNames}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

    </div>
  )
}

/* ── Purchase card ─────────────────────────────────────────────────────────── */

function PurchaseCard({ purchase, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100
                 px-5 py-4 flex items-center gap-4 hover:shadow-md hover:border-indigo-200
                 transition-all group"
    >
      {/* Store icon placeholder */}
      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center
                      text-indigo-400 text-base font-bold shrink-0 group-hover:bg-indigo-100">
        {(purchase.store?.[0] ?? '?').toUpperCase()}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-gray-900 truncate">{purchase.store || 'Unknown store'}</span>
          <span className="text-xs text-gray-400 shrink-0">{fmtTime(purchase.purchased_at)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {purchase.item_count} item{purchase.item_count !== 1 ? 's' : ''}
          {purchase.notes ? ` · ${purchase.notes}` : ''}
        </p>
      </div>

      {/* Total + arrow */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-semibold text-gray-800 text-sm">
          {fmtMoney(purchase.total)}
        </span>
        <ChevronRightIcon />
      </div>
    </button>
  )
}

/* ── Empty state ───────────────────────────────────────────────────────────── */

function EmptyState({ searched, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
      <span className="text-4xl">🧾</span>
      <p className="text-base">
        {searched ? 'No purchases match that store.' : 'No purchases logged yet.'}
      </p>
      {!searched && (
        <button className="btn-primary mt-2" onClick={onAdd}>Log your first purchase</button>
      )}
    </div>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors"
         fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
