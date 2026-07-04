import { useState, useRef, useEffect } from 'react'
import { inventoryApi } from '../../api'
import { supabase } from '../../supabaseClient'
import { Modal } from '../Tasks/TaskForm'
import { PRESET_CATEGORIES, BATCH_CATEGORIES } from './inventoryUtils'

const SUPABASE_URL = 'https://prewpubkkqoxwvqtxmbv.supabase.co'

// Compress image to max 1200px and JPEG 0.85 quality before sending
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else                { width  = Math.round(width  * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression failed')), 'image/jpeg', 0.75)
    }
    img.onerror = reject
    img.src = url
  })
}

async function scanReceipt(file) {
  const compressed = await compressImage(file)
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(compressed)
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not logged in — please refresh and try again.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  let res
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/scan-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      signal: controller.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request timed out — try a smaller or clearer photo.')
    throw e
  } finally {
    clearTimeout(timeout)
  }

  const json = await res.json()
  if (res.status === 429 && json.error === 'rate_limited') {
    const secs = json.retryAfter ?? 60
    throw Object.assign(new Error(`rate_limited`), { retryAfter: secs })
  }
  if (!res.ok || json.error) throw new Error(json.error ?? `Server error ${res.status}`)
  return json.items
}

function ItemRow({ item, onChange, onToggle, selected }) {
  const isBatch = BATCH_CATEGORIES.has(item.category)
  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-colors ${selected ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => onToggle(e.target.checked)}
          className="mt-1 w-4 h-4 accent-indigo-600 shrink-0"
        />
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Name */}
          <div className="sm:col-span-2">
            <input
              className="input py-1 text-sm w-full"
              value={item.name}
              onChange={e => onChange('name', e.target.value)}
            />
          </div>
          {/* Category */}
          <div>
            <label className="text-xs text-gray-400">Category</label>
            <select className="input py-1 text-sm w-full"
              value={item.category}
              onChange={e => onChange('category', e.target.value)}>
              {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Qty + unit — only for non-batch, or show as first batch hint */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400">Qty</label>
              <input type="number" min="0" step="any" className="input py-1 text-sm w-full"
                value={item.quantity ?? ''}
                onChange={e => onChange('quantity', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400">Unit</label>
              <input className="input py-1 text-sm w-full" placeholder="lb, pkg…"
                value={item.unit ?? ''}
                onChange={e => onChange('unit', e.target.value || null)} />
            </div>
          </div>
          {/* Price */}
          {item.purchase_price != null && (
            <div>
              <label className="text-xs text-gray-400">Price ($)</label>
              <input type="number" min="0" step="0.01" className="input py-1 text-sm w-full"
                value={item.purchase_price ?? ''}
                onChange={e => onChange('purchase_price', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          )}
          {isBatch && (
            <p className="text-xs text-indigo-500 sm:col-span-2">
              Qty/expiry tracked as batches after adding
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReceiptScanner({ onClose, onAdded }) {
  const [stage,    setStage]    = useState('pick')   // pick | scanning | review | saving
  const [items,    setItems]    = useState([])
  const [selected, setSelected] = useState(new Set())
  const [error,    setError]    = useState(null)
  const [preview,  setPreview]  = useState(null)
  const [store,    setStore]    = useState('')
  const [saveProgress, setSaveProgress] = useState(null) // '3 / 8'
  const [countdown,    setCountdown]    = useState(null) // seconds remaining before retry allowed
  const fileRef    = useRef(null)
  const cameraRef  = useRef(null)

  useEffect(() => {
    if (!countdown) return
    if (countdown <= 0) { setCountdown(null); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleFile = async (file) => {
    if (!file) return
    // Reset input values so the same file can be re-selected after a re-scan
    if (fileRef.current)   fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
    setPreview(URL.createObjectURL(file))
    setStage('scanning')
    setError(null)
    try {
      const raw = await scanReceipt(file)
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('No items found on receipt — try a clearer photo.')
      const withIds = raw.map((item, i) => ({ ...item, _id: i }))
      setItems(withIds)
      setSelected(new Set(withIds.map(i => i._id)))
      setStage('review')
    } catch (e) {
      if (e.retryAfter) {
        setCountdown(e.retryAfter)
        setError(`Rate limited by Gemini — please wait before trying again.`)
      } else {
        setError(e.message)
      }
      setStage('pick')
    }
  }

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => it._id === id ? { ...it, [field]: value } : it))
  }

  const toggleAll = (checked) => {
    setSelected(checked ? new Set(items.map(i => i._id)) : new Set())
  }

  const handleAdd = async () => {
    const toAdd = items.filter(i => selected.has(i._id))
    if (!toAdd.length) return
    setStage('saving')
    let done = 0
    for (const item of toAdd) {
      const isBatch = BATCH_CATEGORIES.has(item.category)
      try {
        const created = await inventoryApi.create({
          name:     item.name,
          category: item.category,
          unit:     item.unit ?? null,
          store:    store.trim() || null,
          // For non-batch categories, store qty/price directly on the item
          ...(!isBatch && {
            quantity:       item.quantity ?? null,
            purchase_price: item.purchase_price ?? null,
            purchase_date:  new Date().toISOString().slice(0, 10),
          }),
        })
        // For batch categories, create the first batch automatically
        if (isBatch) {
          await inventoryApi.addBatch(created.id, {
            quantity:       item.quantity ?? 1,
            unit:           item.unit ?? null,
            purchase_price: item.purchase_price ?? null,
            purchase_date:  new Date().toISOString().slice(0, 10),
            store:          store.trim() || null,
          })
        }
      } catch {
        // Skip items that fail (e.g. already exist); continue with the rest
      }
      done++
      setSaveProgress(`${done} / ${toAdd.length}`)
    }
    await onAdded()
    onClose()
  }

  const selectedCount = selected.size

  return (
    <Modal title="Scan Receipt" onClose={onClose} maxWidth="max-w-xl">
      <div className="flex flex-col gap-4">

        {/* ── Pick stage ────────────────────────────────────────────── */}
        {stage === 'pick' && (
          <>
            <p className="text-sm text-gray-500">
              Take a photo of your grocery receipt or choose an existing photo. Gemini will extract the items automatically.
            </p>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {countdown > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <svg className="animate-spin h-4 w-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span className="text-sm text-amber-700">
                  Retry available in <span className="font-bold tabular-nums">{countdown}s</span>
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={!!countdown}
                className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 py-8 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => cameraRef.current?.click()}
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm font-medium text-gray-600">Take Photo</span>
              </button>
              <button
                disabled={!!countdown}
                className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 py-8 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => fileRef.current?.click()}
              >
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-medium text-gray-600">Choose Photo</span>
              </button>
            </div>
            {/* Camera-only input */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            {/* Gallery / file picker — no capture attribute */}
            <input ref={fileRef} type="file" accept="image/*"
              className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          </>
        )}

        {/* ── Scanning stage ────────────────────────────────────────── */}
        {stage === 'scanning' && (
          <div className="flex flex-col items-center gap-4 py-10">
            {preview && <img src={preview} alt="Receipt" className="max-h-40 rounded-lg object-contain border border-gray-100" />}
            <div className="flex items-center gap-2 text-indigo-600">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm font-medium">Scanning receipt…</span>
            </div>
          </div>
        )}

        {/* ── Review stage ──────────────────────────────────────────── */}
        {stage === 'review' && (
          <>
            {preview && (
              <img src={preview} alt="Receipt" className="max-h-28 rounded-lg object-contain border border-gray-100 self-center" />
            )}

            {/* Store name */}
            <div>
              <label className="label text-sm">Store (optional)</label>
              <input className="input" placeholder="e.g. Whole Foods, Costco…"
                value={store} onChange={e => setStore(e.target.value)} />
            </div>

            {/* Select all row */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox"
                  className="w-4 h-4 accent-indigo-600"
                  checked={selectedCount === items.length}
                  onChange={e => toggleAll(e.target.checked)}
                />
                <span>Select all ({selectedCount} / {items.length})</span>
              </label>
              <button className="text-xs text-indigo-500 hover:underline"
                onClick={() => fileRef.current?.click()}>
                Re-scan
              </button>
            </div>

            {/* Item list */}
            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
              {items.map(item => (
                <ItemRow
                  key={item._id}
                  item={item}
                  selected={selected.has(item._id)}
                  onToggle={checked => setSelected(prev => {
                    const next = new Set(prev)
                    checked ? next.add(item._id) : next.delete(item._id)
                    return next
                  })}
                  onChange={(field, value) => updateItem(item._id, field, value)}
                />
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100">
              <button className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary w-full sm:w-auto justify-center"
                onClick={handleAdd}
                disabled={selectedCount === 0}
              >
                Add {selectedCount} item{selectedCount !== 1 ? 's' : ''} to Inventory
              </button>
            </div>
          </>
        )}

        {/* ── Saving stage ──────────────────────────────────────────── */}
        {stage === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="flex items-center gap-2 text-indigo-600">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm font-medium">Adding items… {saveProgress}</span>
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}
