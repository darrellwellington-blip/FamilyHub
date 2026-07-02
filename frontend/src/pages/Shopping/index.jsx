import { useState, useEffect, useCallback, useRef } from 'react'
import { shoppingApi } from '../../api'
import { useUser } from '../../UserContext'
import { Modal } from '../Tasks/TaskForm'

function fmtDate(dt) {
  if (!dt) return ''
  return new Date(dt.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
function fmtDateTime(dt) {
  if (!dt) return ''
  return new Date(dt.replace(' ', 'T') + 'Z').toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Shopping() {
  const { currentUser } = useUser()
  const [lists,       setLists]       = useState([])
  const [selectedId,  setSelectedId]  = useState(null)
  const [openList,    setOpenList]    = useState(null)
  const [editingList, setEditingList] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [library,     setLibrary]     = useState([])
  const [completing,  setCompleting]  = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const loadLists = useCallback(async () => {
    setLoading(true)
    try {
      const data = await shoppingApi.lists({ archived: 'false' })
      setLists(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadLists() }, [loadLists])

  useEffect(() => {
    if (!selectedId) { setOpenList(null); return }
    shoppingApi.getList(selectedId).then(setOpenList).catch(() => setOpenList(null))
  }, [selectedId])

  useEffect(() => {
    if (!openList?.store_name) { setLibrary([]); return }
    shoppingApi.library(openList.store_name).then(setLibrary).catch(() => setLibrary([]))
  }, [openList?.store_name])

  const handleListSaved = useCallback(async (saved) => {
    setEditingList(null)
    setOpenList(saved)
    await loadLists()
    setSelectedId(saved.id)
  }, [loadLists])

  const handleDeleteList = useCallback(async () => {
    if (!openList) return
    if (!confirm(`Delete "${openList.name}" permanently?`)) return
    await shoppingApi.deleteList(openList.id)
    setOpenList(null); setSelectedId(null)
    await loadLists()
  }, [openList, loadLists])

  const handleToggleRecurring = useCallback(async (itemId, val) => {
    setOpenList(prev => prev ? ({
      ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, is_recurring: val ? 1 : 0 } : i),
    }) : null)
    await shoppingApi.updateItem(itemId, { is_recurring: val ? 1 : 0 })
  }, [])

  const handleCheckItem = useCallback(async (itemId, checked) => {
    setOpenList(prev => prev ? ({
      ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, is_checked: checked ? 1 : 0 } : i),
    }) : null)
    setLists(prev => prev.map(l => l.id === openList?.id
      ? { ...l, checked_count: Math.max(0, (l.checked_count ?? 0) + (checked ? 1 : -1)) } : l))
    try {
      await shoppingApi.checkItem(itemId, { is_checked: checked, checked_by: currentUser?.id ?? null })
    } catch {
      setOpenList(prev => prev ? ({
        ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, is_checked: checked ? 0 : 1 } : i),
      }) : null)
    }
  }, [currentUser, openList])

  const handleAddItem = useCallback(async (name, quantity, unit, isRecurring) => {
    if (!openList || !name.trim()) return
    const added = await shoppingApi.addItem(openList.id, {
      name: name.trim(), quantity: quantity || 1, unit: unit || null,
      is_recurring: isRecurring ? 1 : 0,
      added_by: currentUser?.id ?? null,
    })
    setOpenList(prev => prev ? ({ ...prev, items: [...(prev.items ?? []), added] }) : null)
    setLists(prev => prev.map(l => l.id === openList.id ? { ...l, item_count: (l.item_count ?? 0) + 1 } : l))
  }, [openList, currentUser])

  const handleDeleteItem = useCallback(async (itemId) => {
    const item = openList?.items?.find(i => i.id === itemId)
    if (!item) return
    await shoppingApi.deleteItem(itemId)
    setOpenList(prev => prev ? ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }) : null)
    setLists(prev => prev.map(l => l.id === openList.id ? {
      ...l,
      item_count:    Math.max(0, (l.item_count    ?? 0) - 1),
      checked_count: Math.max(0, (l.checked_count ?? 0) - (item.is_checked ? 1 : 0)),
    } : l))
  }, [openList])

  // Record a purchase: save history, remove bought items (or uncheck recurring), keep unpurchased items
  const handleRecordPurchase = useCallback(async (purchasedIds, carryBackIds) => {
    if (!openList) return
    await shoppingApi.recordPurchase(openList.id, {
      purchased_ids:  purchasedIds,
      carry_back_ids: carryBackIds,
    })
    setCompleting(false)
    // Reload the list — purchased items gone, carry-backs unchecked, unpurchased items remain
    const updated = await shoppingApi.getList(openList.id)
    setOpenList(updated)
    await loadLists()
  }, [openList, loadLists])

  const checkedItems = openList?.items?.filter(i => i.is_checked) ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Shopping</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-sm" onClick={() => setShowHistory(true)}>
            📋 Purchase History
          </button>
          <button className="btn-primary" onClick={() => setEditingList('new')}>+ New List</button>
        </div>
      </div>

      <div className="flex gap-5 items-start">

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
          ) : lists.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🛒</p>
              <p className="text-sm">No lists yet.</p>
              <button className="btn-primary mt-3" onClick={() => setEditingList('new')}>
                Create first list
              </button>
            </div>
          ) : lists.map(list => (
            <SidebarItem key={list.id} list={list} selected={selectedId === list.id}
              onSelect={() => setSelectedId(list.id)} />
          ))}
        </div>

        {/* ── Right panel ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {openList ? (
            <ListPanel
              list={openList}
              library={library}
              checkedCount={checkedItems.length}
              onCheckItem={handleCheckItem}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onToggleRecurring={handleToggleRecurring}
              onDeleteList={handleDeleteList}
              onEdit={() => setEditingList(openList)}
              onCompletePurchase={() => setCompleting(true)}
            />
          ) : !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-2">
              <span className="text-4xl">🛒</span>
              <p className="text-sm">{lists.length > 0 ? 'Select a list to see its items' : ''}</p>
            </div>
          )}
        </div>
      </div>

      {editingList && (
        <ListFormModal
          list={editingList === 'new' ? null : editingList}
          onClose={() => setEditingList(null)}
          onSaved={handleListSaved}
          currentUser={currentUser}
        />
      )}

      {completing && openList && (
        <CompletePurchaseModal
          list={openList}
          onClose={() => setCompleting(false)}
          onComplete={handleRecordPurchase}
        />
      )}

      {showHistory && (
        <PurchaseHistoryModal onClose={() => setShowHistory(false)} lists={lists} />
      )}
    </div>
  )
}

// ── Sidebar item ──────────────────────────────────────────────────────────────

function SidebarItem({ list, selected, onSelect }) {
  const total   = list.item_count   ?? 0
  const checked = list.checked_count ?? 0
  const pct     = total > 0 ? (checked / total) * 100 : 0
  return (
    <button onClick={onSelect}
      className={`w-full text-left rounded-xl px-4 py-3 border transition-colors ${
        selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}>
      <p className="font-semibold text-sm text-gray-900 truncate">{list.name}</p>
      {list.store_name && (
        <p className="text-xs text-gray-400 mt-0.5 truncate">📍 {list.store_name}</p>
      )}
      {total > 0 && (
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">{checked}/{total} items</span>
            {checked === total && total > 0 && (
              <span className="text-green-600 font-medium">Ready!</span>
            )}
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </button>
  )
}

// ── List panel ────────────────────────────────────────────────────────────────

function ListPanel({ list, library, checkedCount, onCheckItem, onAddItem, onDeleteItem,
  onToggleRecurring, onDeleteList, onEdit, onCompletePurchase }) {

  const [name,      setName]      = useState('')
  const [qty,       setQty]       = useState('')
  const [unit,      setUnit]      = useState('')
  const [recurring, setRecurring] = useState(false)
  const [adding,    setAdding]    = useState(false)
  const nameRef = useRef(null)

  const handleAdd = async (e) => {
    e?.preventDefault()
    if (!name.trim() || adding) return
    setAdding(true)
    try {
      await onAddItem(name.trim(), qty ? Number(qty) : 1, unit.trim() || null, recurring)
      setName(''); setQty(''); setUnit(''); setRecurring(false)
      nameRef.current?.focus()
    } finally {
      setAdding(false)
    }
  }

  const unchecked = (list.items ?? []).filter(i => !i.is_checked)
  const checked   = (list.items ?? []).filter(i =>  i.is_checked)
  const listNames  = new Set((list.items ?? []).map(i => i.name.toLowerCase()))
  const suggestions = library.filter(l => !listNames.has(l.item_name.toLowerCase()))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{list.name}</h2>
          {list.store_name && <p className="text-sm text-gray-400 mt-0.5">📍 {list.store_name}</p>}
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <button className="btn-secondary" onClick={onEdit}>Edit</button>
          <button className="btn-danger" onClick={onDeleteList}>Delete</button>
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">

        {/* Complete purchase banner */}
        {checkedCount > 0 && (
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
            checkedCount === (list.items?.length ?? 0)
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div>
              <p className={`text-sm font-semibold ${
                checkedCount === (list.items?.length ?? 0) ? 'text-green-800' : 'text-amber-800'
              }`}>
                {checkedCount === (list.items?.length ?? 0)
                  ? 'All items checked! 🎉'
                  : `${checkedCount} item${checkedCount !== 1 ? 's' : ''} checked off`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Record what you bought — unpurchased items stay on the list.
              </p>
            </div>
            <button className="btn bg-green-600 text-white hover:bg-green-700 shrink-0 text-sm"
              onClick={onCompletePurchase}>
              ✓ Complete Purchase
            </button>
          </div>
        )}

        {/* Add item form */}
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <input ref={nameRef} className="input flex-1" placeholder="Add item…"
              value={name} onChange={e => setName(e.target.value)} />
            <input type="number" min="0" step="any" className="input w-16 text-center" placeholder="Qty"
              value={qty} onChange={e => setQty(e.target.value)} />
            <input className="input w-20" placeholder="Unit"
              value={unit} onChange={e => setUnit(e.target.value)} />
            <button type="submit" className="btn-primary shrink-0"
              disabled={!name.trim() || adding}>Add</button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input type="checkbox" className="rounded border-gray-300" checked={recurring}
              onChange={e => setRecurring(e.target.checked)} />
            <span className="text-xs text-gray-500">Recurring (auto-restore after each purchase)</span>
          </label>
        </form>

        {/* Library suggestions */}
        {suggestions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1.5">
              Quick add from {list.store_name}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 16).map(l => (
                <button key={l.id} type="button"
                  onClick={() => onAddItem(l.item_name, l.default_quantity ?? 1, l.default_unit ?? null, false)}
                  className="btn border border-gray-200 text-gray-600 text-xs hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                  + {l.item_name}
                  {l.default_quantity && l.default_quantity !== 1 && (
                    <span className="text-gray-400 ml-1">×{l.default_quantity}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Items */}
        {(list.items ?? []).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Add your first item above.</p>
        ) : (
          <div>
            {unchecked.map(item => (
              <ItemRow key={item.id} item={item}
                onCheck={c => onCheckItem(item.id, c)}
                onDelete={() => onDeleteItem(item.id)}
                onToggleRecurring={v => onToggleRecurring(item.id, v)} />
            ))}

            {unchecked.length > 0 && checked.length > 0 && (
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">Checked off</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            )}

            {checked.map(item => (
              <ItemRow key={item.id} item={item}
                onCheck={c => onCheckItem(item.id, c)}
                onDelete={() => onDeleteItem(item.id)}
                onToggleRecurring={v => onToggleRecurring(item.id, v)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({ item, onCheck, onDelete, onToggleRecurring }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 group
      ${!!item.is_checked ? 'opacity-60' : ''}`}>

      <button type="button" onClick={() => onCheck(!item.is_checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
          ${!!item.is_checked
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'border-gray-300 hover:border-indigo-400'}`}>
        {!!item.is_checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm ${!!item.is_checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {item.name}
        </span>
        {(item.quantity != null && item.quantity !== 1 || item.unit) && (
          <span className="text-xs text-gray-400 ml-2">
            {item.quantity}{item.unit ? ' ' + item.unit : ''}
          </span>
        )}
        {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
      </div>

      {/* Recurring badge/toggle */}
      <button type="button"
        onClick={() => onToggleRecurring(!item.is_recurring)}
        title={!!item.is_recurring ? 'Recurring — click to remove' : 'Click to make recurring'}
        className={`shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors ${
          !!item.is_recurring
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
            : 'bg-white text-gray-300 border-gray-200 opacity-0 group-hover:opacity-100'
        }`}>
        🔁{!!item.is_recurring ? ' recurring' : ''}
      </button>

      <button type="button" onClick={onDelete}
        className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Complete purchase modal ───────────────────────────────────────────────────

function CompletePurchaseModal({ list, onClose, onComplete }) {
  const purchased    = (list.items ?? []).filter(i => !!i.is_checked)
  const notPurchased = (list.items ?? []).filter(i => !i.is_checked)
  const recurring    = purchased.filter(i => !!i.is_recurring)

  const [carryBack, setCarryBack] = useState(() => new Set(recurring.map(i => i.id)))
  const [saving,    setSaving]    = useState(false)

  const toggle = id => setCarryBack(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const handleDone = async () => {
    setSaving(true)
    try {
      await onComplete(purchased.map(i => i.id), [...carryBack])
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Complete Purchase" onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">

        {/* Summary counts */}
        <div className="flex gap-3">
          <div className="flex-1 bg-green-50 rounded-xl py-3 text-center">
            <p className="text-2xl font-bold text-green-700">{purchased.length}</p>
            <p className="text-xs text-green-600">Purchased</p>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl py-3 text-center">
            <p className="text-2xl font-bold text-gray-500">{notPurchased.length}</p>
            <p className="text-xs text-gray-500">Staying on list</p>
          </div>
        </div>

        {/* Not purchased */}
        {notPurchased.length > 0 && (
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-xs font-semibold text-gray-500 mb-1">Staying on list (not found):</p>
            {notPurchased.map(i => (
              <p key={i.id} className="text-sm text-gray-600">• {i.name}</p>
            ))}
          </div>
        )}

        {/* Purchased list */}
        {purchased.length > 0 && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2">
            <p className="text-xs font-semibold text-green-700 mb-1">Purchased (will be removed from list):</p>
            {purchased.map(i => (
              <p key={i.id} className="text-sm text-green-800">• {i.name}</p>
            ))}
          </div>
        )}

        {/* Recurring carry-back */}
        {recurring.length > 0 && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
            <p className="text-sm font-semibold text-indigo-800 mb-1">Restore recurring items?</p>
            <p className="text-xs text-indigo-600 mb-3">
              These are marked recurring — check any you want back on the list for next time.
            </p>
            <div className="flex flex-col gap-2">
              {recurring.map(i => (
                <label key={i.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-indigo-300"
                    checked={carryBack.has(i.id)} onChange={() => toggle(i.id)} />
                  <span className="text-sm text-indigo-900">{i.name}</span>
                  {(i.quantity !== 1 || i.unit) && (
                    <span className="text-xs text-indigo-400">{i.quantity}{i.unit ? ' ' + i.unit : ''}</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-3 pt-2 border-t border-indigo-100">
              <button type="button" className="text-xs text-indigo-600 hover:underline"
                onClick={() => setCarryBack(new Set(recurring.map(i => i.id)))}>All</button>
              <button type="button" className="text-xs text-indigo-600 hover:underline"
                onClick={() => setCarryBack(new Set())}>None</button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleDone} disabled={saving || purchased.length === 0}>
            {saving ? 'Saving…' : 'Record Purchase'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Purchase history modal ────────────────────────────────────────────────────

function PurchaseHistoryModal({ onClose, lists }) {
  const [purchases,  setPurchases]  = useState(null)
  const [filterList, setFilterList] = useState('')
  const [filterStore,setFilterStore]= useState('')
  const [expanded,   setExpanded]   = useState(null)

  useEffect(() => {
    const params = {}
    if (filterList)  params.list_id    = filterList
    if (filterStore) params.store_name = filterStore
    shoppingApi.listPurchases(params).then(setPurchases).catch(() => setPurchases([]))
  }, [filterList, filterStore])

  const allStores = [...new Set(lists.map(l => l.store_name).filter(Boolean))].sort()

  return (
    <Modal title="Purchase History" onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">

        {/* Filters */}
        <div className="flex gap-2">
          <select className="input flex-1" value={filterList} onChange={e => setFilterList(e.target.value)}>
            <option value="">All lists</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="input flex-1" value={filterStore} onChange={e => setFilterStore(e.target.value)}>
            <option value="">All stores</option>
            {allStores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Results */}
        {purchases === null ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No purchases recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
            {purchases.map(p => {
              const listName = lists.find(l => l.id === p.list_id)?.name
              return (
                <div key={p.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                  <button type="button"
                    className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {p.store_name ?? listName ?? 'Shopping trip'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmtDateTime(p.purchased_at)}
                        {listName && p.store_name ? ` · ${listName}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {p.items.length} item{p.items.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-400 text-xs">{expanded === p.id ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {expanded === p.id && (
                    <div className="border-t border-gray-100 px-4 py-2 bg-white">
                      {p.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                          <span className="text-green-500 text-xs">✓</span>
                          <span className="text-sm text-gray-700 flex-1">{item.name}</span>
                          {(item.quantity !== 1 || item.unit) && (
                            <span className="text-xs text-gray-400">
                              {item.quantity}{item.unit ? ' ' + item.unit : ''}
                            </span>
                          )}
                          {!!item.is_recurring && (
                            <span className="text-xs text-indigo-400">🔁</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  )
}

// ── List form modal ───────────────────────────────────────────────────────────

function ListFormModal({ list, onClose, onSaved, currentUser }) {
  const [name,      setName]      = useState(list?.name       ?? '')
  const [storeName, setStoreName] = useState(list?.store_name ?? '')
  const [storeNames,setStoreNames]= useState([])
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    shoppingApi.lists({}).then(data => {
      setStoreNames([...new Set(data.map(l => l.store_name).filter(Boolean))].sort())
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('List name is required'); return }
    setSaving(true); setError(null)
    try {
      const body = { name: name.trim(), store_name: storeName.trim() || null }
      const saved = list
        ? await shoppingApi.updateList(list.id, body)
        : await shoppingApi.createList({ ...body, created_by: currentUser?.id ?? null })
      onSaved(saved)
    } catch (err) {
      setError(err.message); setSaving(false)
    }
  }

  return (
    <Modal title={list ? 'Edit List' : 'New Shopping List'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">List name <span className="text-red-500">*</span></label>
          <input className="input" placeholder="e.g. Farm Boy" value={name}
            onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Store <span className="text-gray-400 font-normal">(optional)</span></label>
          <input list="known-stores-sl" className="input" placeholder="e.g. Farm Boy, Costco…"
            value={storeName} onChange={e => setStoreName(e.target.value)} />
          <datalist id="known-stores-sl">
            {storeNames.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : list ? 'Save Changes' : 'Create List'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
