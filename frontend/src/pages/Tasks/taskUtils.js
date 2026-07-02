// ─── Date helpers ────────────────────────────────────────────────────────────

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

// ─── Seasonal ────────────────────────────────────────────────────────────────

function nextSeasonalDate(base, months) {
  if (!months.length) return null
  const today = startOfDay(new Date())
  const sorted = [...months].sort((a, b) => a - b)
  for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
    const year = today.getFullYear() + yearOffset
    for (const m of sorted) {
      const candidate = new Date(year, m - 1, 1)
      if (candidate > base && candidate >= today) return candidate
    }
  }
  return null
}

// ─── Core: compute the next due date for a task ──────────────────────────────

export function getNextDueDate(task) {
  const {
    recurrence_type, recurrence_unit, recurrence_interval, recurrence_months,
    recurrence_days, recurrence_start, recurrence_end_type, recurrence_end_date,
    recurrence_end_count, due_date, last_completed_at, created_at, is_active,
    completion_count,
  } = task

  if (!is_active) return null

  if (recurrence_type === 'One-time') {
    if (last_completed_at) return null
    return due_date ? new Date(due_date) : new Date(created_at)
  }

  if (recurrence_type === 'Seasonal') {
    const base = last_completed_at ? new Date(last_completed_at) : new Date(created_at)
    let months = []
    try { months = JSON.parse(recurrence_months || '[]') } catch {}
    return nextSeasonalDate(base, months)
  }

  if (recurrence_type === 'Recurring') {
    const n      = recurrence_interval || 1
    const anchor = recurrence_start ? new Date(recurrence_start) : new Date(created_at)
    // base = the last completed date, or just before anchor so first result = anchor
    const base   = last_completed_at ? new Date(last_completed_at) : addDays(anchor, -1)
    const today  = startOfDay(new Date())

    // Check end conditions before computing next
    if (recurrence_end_type === 'on_date' && recurrence_end_date) {
      if (today > startOfDay(new Date(recurrence_end_date))) return null
    }
    if (recurrence_end_type === 'after' && recurrence_end_count) {
      if ((completion_count || 0) >= recurrence_end_count) return null
    }

    if (recurrence_unit === 'days') {
      if (startOfDay(base) < startOfDay(anchor)) return anchor
      const elapsed = Math.round((startOfDay(base) - startOfDay(anchor)) / 86_400_000)
      const next = addDays(anchor, (Math.floor(elapsed / n) + 1) * n)
      // Daily tasks (every 1 day) always show as due today if missed — never accumulate overdue
      if (n === 1 && startOfDay(next) < startOfDay(new Date())) return new Date()
      return next
    }

    if (recurrence_unit === 'weeks') {
      let days = []
      try { days = JSON.parse(recurrence_days || '[]') } catch {}

      if (!days.length) {
        if (startOfDay(base) < startOfDay(anchor)) return anchor
        const elapsed = Math.round((startOfDay(base) - startOfDay(anchor)) / 86_400_000)
        return addDays(anchor, (Math.floor(elapsed / (n * 7)) + 1) * n * 7)
      }

      // With specific days: find occurrences within n-week cycles anchored to anchor's Monday
      const sorted = [...days].sort((a, b) => a - b)
      const anchorDow = (anchor.getDay() + 6) % 7         // 0=Mon
      const anchorMonday = addDays(anchor, -anchorDow)
      const cycleLen = n * 7

      const msSinceMonday = startOfDay(base) - startOfDay(anchorMonday)
      const daysSinceMonday = Math.max(0, Math.floor(msSinceMonday / 86_400_000))
      const currentCycle = Math.floor(daysSinceMonday / cycleLen)

      for (let ck = currentCycle; ck <= currentCycle + 1; ck++) {
        const cycleStart = addDays(anchorMonday, ck * cycleLen)
        for (const d of sorted) {
          const candidate = addDays(cycleStart, d)
          if (startOfDay(candidate) > startOfDay(base)) return candidate
        }
      }
      // Fallback: next cycle's first day
      return addDays(anchorMonday, (currentCycle + 2) * cycleLen + sorted[0])
    }

    if (recurrence_unit === 'months') {
      const dom = anchor.getDate()
      if (startOfDay(base) < startOfDay(anchor)) return anchor
      const elapsedMonths = (base.getFullYear() - anchor.getFullYear()) * 12
                          + (base.getMonth() - anchor.getMonth())
      const k = Math.floor(elapsedMonths / n) + 1
      let candidate = new Date(anchor.getFullYear(), anchor.getMonth() + k * n, dom)
      // Roll forward if still not past base (edge case: month had fewer days)
      while (startOfDay(candidate) <= startOfDay(base)) {
        candidate = new Date(candidate.getFullYear(), candidate.getMonth() + n, dom)
      }
      return candidate
    }

    if (recurrence_unit === 'years') {
      const dom   = anchor.getDate()
      const month = anchor.getMonth()
      if (startOfDay(base) < startOfDay(anchor)) return anchor
      const elapsedYears = base.getFullYear() - anchor.getFullYear()
      const k = Math.floor(elapsedYears / n) + 1
      let candidate = new Date(anchor.getFullYear() + k * n, month, dom)
      while (startOfDay(candidate) <= startOfDay(base)) {
        candidate = new Date(candidate.getFullYear() + n, month, dom)
      }
      return candidate
    }
  }

  return null
}

// ─── Days delta (negative = overdue) ─────────────────────────────────────────

export function daysUntilDue(task) {
  const due = getNextDueDate(task)
  if (due == null) return null
  const today = startOfDay(new Date())
  return Math.round((startOfDay(due) - today) / 86_400_000)
}

// ─── Status string ────────────────────────────────────────────────────────────

export function taskStatus(task) {
  if (!task.is_active) return 'inactive'
  if (task.recurrence_type === 'One-time' && task.last_completed_at) return 'archived'
  const days = daysUntilDue(task)
  if (days == null) return 'no-due'
  if (days < 0)  return 'overdue'
  if (days === 0) return 'due-today'
  return 'upcoming'
}

// ─── Filter + sort ────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 }

function byDueThenPriority(a, b) {
  const da = daysUntilDue(a) ?? 9999
  const db = daysUntilDue(b) ?? 9999
  if (da !== db) return da - db
  return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    || a.title.localeCompare(b.title)
}

export function filterAndSort(tasks, filter) {
  if (filter === 'archived') {
    return tasks
      .filter(t => t.recurrence_type === 'One-time' && t.last_completed_at)
      .sort((a, b) => new Date(b.last_completed_at) - new Date(a.last_completed_at))
  }
  const active = tasks.filter(
    t => t.is_active && !(t.recurrence_type === 'One-time' && t.last_completed_at)
  )
  const filtered = active.filter(t => {
    const days = daysUntilDue(t)
    switch (filter) {
      case 'overdue': return days != null && days < 0
      case 'today':   return days != null && days === 0
      case 'week':    return days != null && days <= 7
      case '2weeks':  return days != null && days <= 14
      case 'month':   return days != null && days <= 30
      default:        return true
    }
  })

  // Sort parents first, then interleave their subtasks immediately after
  const parents   = filtered.filter(t => !t.parent_task_id).sort(byDueThenPriority)
  const subtasks  = filtered.filter(t =>  t.parent_task_id)
  const result = []
  for (const p of parents) {
    result.push(p)
    const children = subtasks.filter(s => s.parent_task_id === p.id).sort(byDueThenPriority)
    result.push(...children)
  }
  // Orphaned subtasks (parent filtered out) go at the end
  const parentIds = new Set(parents.map(p => p.id))
  result.push(...subtasks.filter(s => !parentIds.has(s.parent_task_id)).sort(byDueThenPriority))
  return result
}

// ─── Count badges ─────────────────────────────────────────────────────────────

export function countsByFilter(tasks) {
  const active = tasks.filter(
    t => t.is_active && !(t.recurrence_type === 'One-time' && t.last_completed_at)
  )
  const counts = { overdue: 0, today: 0, week: 0, twoWeeks: 0, month: 0, all: active.length }
  for (const t of active) {
    const days = daysUntilDue(t)
    if (days == null) continue
    if (days < 0)   counts.overdue++
    if (days === 0) counts.today++
    if (days <= 7)  counts.week++
    if (days <= 14) counts.twoWeeks++
    if (days <= 30) counts.month++
  }
  counts.archived = tasks.filter(
    t => t.recurrence_type === 'One-time' && t.last_completed_at
  ).length
  return counts
}

// ─── Human-readable due label ─────────────────────────────────────────────────

export function dueLabel(task) {
  const days = daysUntilDue(task)
  if (days == null) return null
  if (days < 0)  return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days} day${days !== 1 ? 's' : ''}`
}

// ─── Recurrence label for task card ──────────────────────────────────────────

export function getRecurrenceLabel(task) {
  const { recurrence_type, recurrence_unit, recurrence_interval } = task
  if (recurrence_type === 'One-time')  return 'One-time'
  if (recurrence_type === 'Seasonal')  return 'Seasonal'
  if (recurrence_type !== 'Recurring') return recurrence_type

  const n = recurrence_interval || 1

  if (recurrence_unit === 'days')   return n === 1 ? 'Every day'   : `Every ${n} days`
  if (recurrence_unit === 'months') return n === 1 ? 'Every month'  : `Every ${n} months`
  if (recurrence_unit === 'years')  return n === 1 ? 'Every year'   : `Every ${n} years`

  if (recurrence_unit === 'weeks') {
    let days = []
    try { days = JSON.parse(task.recurrence_days || '[]') } catch {}
    const base = n === 1 ? 'Every week' : `Every ${n} weeks`
    if (!days.length) return base
    return base + ' · ' + [...days].sort((a,b)=>a-b).map(d => DAY_NAMES_SHORT[d]).join(', ')
  }
  return 'Recurring'
}

// ─── Formatting ──────────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const DT_FMT   = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export const fmtDate     = (iso) => iso ? DATE_FMT.format(new Date(iso)) : '—'
export const fmtDateTime = (iso) => iso ? DT_FMT.format(new Date(iso))   : '—'

export const DAY_NAMES_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
export const DAY_NAMES_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
export const MONTH_NAMES     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function localNow() {
  const d = new Date()
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
