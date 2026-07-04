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

const DATE_FMT  = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const MONEY_FMT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export const fmtDate  = (s) => s ? DATE_FMT.format(new Date(s + 'T12:00:00')) : '—'
export const fmtMoney = (n) => n != null ? MONEY_FMT.format(n) : '—'

// ── Expiry helpers ────────────────────────────────────────────────────────────

export function daysUntilExpiry(item) {
  if (!item.best_before_date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(item.best_before_date + 'T12:00:00')
  return Math.round((exp - today) / 86_400_000)
}

export function expiryInfo(item) {
  const days = daysUntilExpiry(item)
  if (days === null) return null
  if (days < 0)   return { days, label: `Expired ${Math.abs(days)}d ago`,   status: 'expired' }
  if (days === 0) return { days, label: 'Expires today',                     status: 'expiring-soon' }
  if (days <= 7)  return { days, label: `Expires in ${days} day${days !== 1 ? 's' : ''}`, status: 'expiring-soon' }
  return           { days, label: `Best before ${fmtDate(item.best_before_date)}`, status: 'ok' }
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
