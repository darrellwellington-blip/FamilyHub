export const PRESET_CATEGORIES = [
  'Food', 'Beverages', 'Electronics',
  'Appliances', 'Furniture', 'Tools', 'Cleaning', 'Personal Care', 'Storage',
]

export const CATEGORY_ICONS = {
  Food:           '🥫',
  Beverages:      '🥤',
  Electronics:    '💻',
  Appliances:     '🔌',
  Furniture:      '🪑',
  Tools:          '🔧',
  Cleaning:       '🧹',
  'Personal Care':'🪥',
  Storage:        '📦',
}

export const PRESET_LOCATIONS = [
  'Pantry', 'Fridge', 'Freezer', 'Kitchen', 'Garage',
  'Basement', 'Bathroom', 'Laundry Room', 'Office',
]

// Which categories use stacked batches (qty + best_before_date per batch)
export const BATCH_CATEGORIES = new Set(['Food', 'Beverages', 'Cleaning', 'Personal Care'])

// Which fields to show in the form per category
// 'batch_fields' applies to individual batch rows (only used when category is batch-capable)
export const CATEGORY_FIELDS = {
  Food:           { item: ['unit', 'location', 'description', 'notes'],                                                     batch: ['quantity', 'best_before_date', 'purchase_date', 'purchase_price', 'store'] },
  Beverages:      { item: ['unit', 'location', 'description', 'notes'],                                                     batch: ['quantity', 'best_before_date', 'purchase_date', 'purchase_price', 'store'] },
  Electronics:    { item: ['serial_number', 'model_number', 'estimated_value', 'purchase_date', 'purchase_price', 'store', 'location', 'description', 'notes'] },
  Appliances:     { item: ['serial_number', 'model_number', 'estimated_value', 'purchase_date', 'purchase_price', 'store', 'location', 'description', 'notes'] },
  Furniture:      { item: ['estimated_value', 'purchase_date', 'purchase_price', 'store', 'location', 'description', 'notes'] },
  Tools:          { item: ['serial_number', 'model_number', 'estimated_value', 'purchase_date', 'purchase_price', 'store', 'location', 'description', 'notes'] },
  Cleaning:       { item: ['unit', 'location', 'description', 'notes'],                                                     batch: ['quantity', 'best_before_date', 'purchase_date', 'purchase_price', 'store'] },
  'Personal Care':{ item: ['unit', 'location', 'description', 'notes'],                                                     batch: ['quantity', 'best_before_date', 'purchase_date', 'purchase_price', 'store'] },
  Storage:        { item: ['estimated_value', 'purchase_date', 'purchase_price', 'store', 'location', 'description', 'notes'] },
}

export function categoryFields(category) {
  return CATEGORY_FIELDS[category] ?? { item: ['quantity', 'unit', 'best_before_date', 'purchase_date', 'purchase_price', 'store', 'serial_number', 'model_number', 'estimated_value', 'location', 'description', 'notes'] }
}

const DATE_FMT  = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const MONEY_FMT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export const fmtDate  = (s) => s ? DATE_FMT.format(new Date(s + 'T12:00:00')) : '—'
export const fmtMoney = (n) => n != null ? MONEY_FMT.format(n) : '—'

// ── Expiry helpers ────────────────────────────────────────────────────────────

export function daysUntilExpiry(item) {
  // Use soonest batch date if batches exist, otherwise fall back to item field
  const dates = (item.batches?.length
    ? item.batches.map(b => b.best_before_date).filter(Boolean)
    : [item.best_before_date].filter(Boolean)
  )
  if (!dates.length) return null
  const soonest = dates.sort()[0]
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(soonest + 'T12:00:00') - today) / 86_400_000)
}

// Total quantity: sum of batches or fall back to item.quantity
export function totalQuantity(item) {
  if (item.batches?.length) {
    const sum = item.batches.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0)
    return sum || null
  }
  return item.quantity ?? null
}

export function expiryInfo(item) {
  const days = daysUntilExpiry(item)
  if (days === null) return null
  if (days < 0)   return { days, label: `Expired ${Math.abs(days)}d ago`,   status: 'expired' }
  if (days === 0) return { days, label: 'Expires today',                     status: 'expiring-soon' }
  if (days <= 7)  return { days, label: `Expires in ${days} day${days !== 1 ? 's' : ''}`, status: 'expiring-soon' }
  // Show soonest batch date
  const dates = (item.batches?.length
    ? item.batches.map(b => b.best_before_date).filter(Boolean)
    : [item.best_before_date].filter(Boolean)
  )
  return { days, label: `Best before ${fmtDate(dates.sort()[0])}`, status: 'ok' }
}

export const EXPIRY_CARD = {
  'expired':       'border-l-4 border-red-500 bg-red-50',
  'expiring-soon': 'border-l-4 border-amber-400 bg-amber-50',
  'ok':            'border-l-4 border-transparent bg-white',
}
export const EXPIRY_BADGE = {
  'expired':       'text-red-700 bg-red-100',
  'expiring-soon': 'text-amber-700 bg-amber-100',
  'ok':            'text-gray-500 bg-gray-100',
}

// ── Sorting & grouping ────────────────────────────────────────────────────────

export function sortItems(items) {
  return [...items].sort((a, b) => {
    const dA = daysUntilExpiry(a)
    const dB = daysUntilExpiry(b)
    if (dA !== null && dB === null)  return -1
    if (dA === null && dB !== null)  return 1
    if (dA !== null && dB !== null && dA !== dB) return dA - dB
    return a.name.localeCompare(b.name)
  })
}

export function groupByCategory(items) {
  const groups = {}
  for (const item of items) {
    const cat = item.category || 'Other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }
  return groups
}

// Preset categories first (in order), then custom alphabetically
export function sortedCategoryKeys(groups) {
  return Object.keys(groups).sort((a, b) => {
    const ia = PRESET_CATEGORIES.indexOf(a)
    const ib = PRESET_CATEGORIES.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
}
