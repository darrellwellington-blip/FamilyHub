export const MEAL_CATEGORIES = [
  'Breakfast', 'Lunch', 'Dinner', 'Side Dish', 'Snack', 'Dessert', 'Soup', 'Salad', 'Other',
]

export const DAY_LABELS    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAY_NAMES     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
export const MEAL_TYPES    = ['breakfast', 'brunch', 'lunch', 'dinner']
export const MEAL_TYPE_LABELS = { breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch', dinner: 'Dinner' }

// ── Week helpers ──────────────────────────────────────────────────────────────

export function getMonday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()                            // 0=Sun … 6=Sat
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  d.setHours(0, 0, 0, 0)
  return d
}

// YYYY-MM-DD in local time (not UTC, so no timezone shift)
export function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function fmtWeekRange(monday) {
  const sunday = addDays(monday, 6)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}, ${monday.getFullYear()}`
}

// ── Date helpers ──────────────────────────────────────────────────────────────

// SQLite: "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS" (always UTC)
export function fmtDate(dt) {
  if (!dt) return null
  const iso = dt.includes('T') ? dt + 'Z' : dt.replace(' ', 'T') + 'Z'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Value for <input type="datetime-local"> in local time
export function localNow() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

// ── Rating helpers ────────────────────────────────────────────────────────────

export function avgRating(ratings) {
  const vals = Object.values(ratings ?? {}).filter(v => v != null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
