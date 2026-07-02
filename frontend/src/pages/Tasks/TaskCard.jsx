import { taskStatus, daysUntilDue, dueLabel, fmtDate, getRecurrenceLabel } from './taskUtils'

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
}

const PRIORITY_BADGE = {
  High:   'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low:    'bg-green-100 text-green-700',
}

const STATUS_CARD = {
  overdue:   'bg-red-50 border-l-4 border-red-500',
  'due-today': 'bg-amber-50 border-l-4 border-amber-500',
  upcoming:  'bg-white border-l-4 border-indigo-300',
  'no-due':  'bg-white border-l-4 border-gray-200',
  archived:  'bg-gray-50 border-l-4 border-gray-300',
}

const STATUS_DUE_TEXT = {
  overdue:    'text-red-600 font-semibold',
  'due-today':'text-amber-600 font-semibold',
  upcoming:   'text-indigo-600',
  'no-due':   'text-gray-400',
}

export default function TaskCard({ task, onComplete, onEdit, onDelete, onHistory }) {
  const status = taskStatus(task)
  const label  = dueLabel(task)
  const isArchived = status === 'archived'

  return (
    <div className={`rounded-xl shadow-sm p-4 flex flex-col gap-3 ${STATUS_CARD[status] ?? STATUS_CARD['no-due']}`}>

      {/* Top row: title + action icons */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 leading-snug flex-1">{task.title}</h3>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={onEdit}
            title="Edit"
            className="text-gray-400 hover:text-indigo-600 transition-colors p-0.5"
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${task.title}"?`)) onDelete() }}
            title="Delete"
            className="text-gray-400 hover:text-red-600 transition-colors p-0.5"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Description snippet */}
      {task.description && (
        <p className="text-sm text-gray-500 line-clamp-2 -mt-1">{task.description}</p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.Medium}`}>
          {task.priority}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
          {task.category}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {getRecurrenceLabel(task)}
        </span>
        {task.assigned_to_name && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
            {task.assigned_to_name}
          </span>
        )}
        {task.parent_title && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium truncate max-w-[120px]"
            title={`Subtask of: ${task.parent_title}`}>
            ↳ {task.parent_title}
          </span>
        )}
      </div>

      {/* Subtask progress bar */}
      {task.subtask_count > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Subtasks</span>
            <span>{task.subtasks_done}/{task.subtask_count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-400 transition-all"
              style={{ width: `${Math.round((task.subtasks_done / task.subtask_count) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Requirements badge */}
      {task.req_count > 0 && (
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg w-fit
          ${task.req_ready === task.req_count
            ? 'bg-green-50 text-green-700'
            : 'bg-amber-50 text-amber-700'}`}>
          <span>{task.req_ready === task.req_count ? '✓' : '○'}</span>
          <span>
            {task.req_ready}/{task.req_count} requirement{task.req_count !== 1 ? 's' : ''} ready
          </span>
        </div>
      )}

      {/* Due date line */}
      {label && (
        <p className={`text-sm ${STATUS_DUE_TEXT[status] ?? ''}`}>
          {label}{task.due_time ? ` · ${fmtTime(task.due_time)}` : ''}
        </p>
      )}

      {/* Last completed */}
      <p className="text-xs text-gray-400">
        {task.last_completed_at
          ? `Last done: ${fmtDate(task.last_completed_at)}`
          : isArchived ? '' : 'Never completed'}
      </p>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        {!isArchived && (
          <button onClick={onComplete} className="btn-primary text-xs flex-1 justify-center">
            ✓ Complete
          </button>
        )}
        <button onClick={onHistory} className="btn-secondary text-xs flex-1 justify-center">
          History
        </button>
      </div>

    </div>
  )
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.862 3.487a2.25 2.25 0 113.182 3.182L6.75 19.963l-4.5 1.5 1.5-4.5L16.862 3.487z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  )
}
