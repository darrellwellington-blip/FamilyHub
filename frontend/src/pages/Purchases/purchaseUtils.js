// Safely parse a DB-stored datetime string (SQLite omits the trailing Z)
export function parseIso(s) {
  if (!s) return null
  const normalized = s.replace(' ', 'T')
  return new Date(normalized.includes('Z') || normalized.includes('+') ? normalized : normalized + 'Z')
}

const MONEY_FMT       = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const DATE_HEADER_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const TIME_FMT        = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const DATETIME_FMT    = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export const fmtMoney    = (n)   => MONEY_FMT.format(n ?? 0)
export const fmtTime     = (iso) => iso ? TIME_FMT.format(parseIso(iso))     : '—'
export const fmtDateTime = (iso) => iso ? DATETIME_FMT.format(parseIso(iso)) : '—'

export function fmtDateHeader(dateKey) {
  // dateKey is "YYYY-MM-DD"; parse at noon local to avoid DST edge cases
  const [y, m, d] = dateKey.split('-').map(Number)
  return DATE_HEADER_FMT.format(new Date(y, m - 1, d, 12))
}

// Convert a DB ISO string (UTC, no Z) to the value for a <input type="datetime-local">
export function isoToLocalInput(iso) {
  if (!iso) return localNow()
  const d = parseIso(iso)
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function localNow() {
  const d = new Date()
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Group a sorted-by-date array of purchases into { dateKey: [purchases] }
export function groupByDate(purchases) {
  const groups = {}
  for (const p of purchases) {
    const key = p.purchased_at ? p.purchased_at.slice(0, 10) : 'unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  return groups
}

// Compute running total from form items (not-deleted)
export function formTotal(items) {
  return items
    .filter(i => !i._deleted)
    .reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
}
