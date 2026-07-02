import { useState, useEffect, useRef } from 'react'
import {
  DndContext, closestCorners, DragOverlay,
  PointerSensor, TouchSensor, useSensor, useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { tasksApi } from '../../api'
import { dueLabel, taskStatus } from './taskUtils'

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIORITIES = ['High', 'Medium', 'Low']

const P_STYLE = {
  High:   { dot: 'bg-red-500',    label: 'text-red-700 bg-red-50 border-red-200',   header: 'text-red-700' },
  Medium: { dot: 'bg-amber-500',  label: 'text-amber-700 bg-amber-50 border-amber-200', header: 'text-amber-700' },
  Low:    { dot: 'bg-green-500',  label: 'text-green-700 bg-green-50 border-green-200', header: 'text-green-700' },
}

const STATUS_DOT = {
  overdue:    'bg-red-500 ring-2 ring-red-200',
  'due-today':'bg-amber-500 ring-2 ring-amber-200',
  upcoming:   'bg-indigo-400',
  'no-due':   'bg-gray-300',
  archived:   'bg-gray-300',
  inactive:   'bg-gray-200',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function groupByPriority(tasks) {
  const groups = { High: [], Medium: [], Low: [] }
  for (const t of tasks) {
    const p = PRIORITIES.includes(t.priority) ? t.priority : 'Medium'
    groups[p].push(t)
  }
  for (const p of PRIORITIES) {
    groups[p].sort((a, b) => {
      const ao = a.sort_order ?? 9999
      const bo = b.sort_order ?? 9999
      return ao !== bo ? ao - bo : a.id - b.id
    })
  }
  return groups
}

function effortLabel(task) {
  if (task.effort_hours != null) return `${task.effort_hours}h`
  if (task.effort_size)          return task.effort_size
  return null
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TaskListView({ tasks, users, onEdit, onComplete, onHistory, onDelete, onChanged }) {
  const [groups,          setGroups]          = useState(() => groupByPriority(tasks))
  const [activeTask,      setActiveTask]      = useState(null)
  const [editingEffort,   setEditingEffort]   = useState(null)
  const [editingAssignee, setEditingAssignee] = useState(null)
  const draggingRef = useRef(false)

  // Sync when tasks reload (skip while dragging)
  useEffect(() => {
    if (!draggingRef.current) setGroups(groupByPriority(tasks))
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const findPriority = (taskId) =>
    PRIORITIES.find(p => groups[p].some(t => t.id === taskId)) ?? null

  const handleDragStart = ({ active }) => {
    draggingRef.current = true
    const task = PRIORITIES.flatMap(p => groups[p]).find(t => t.id === active.id)
    setActiveTask(task ?? null)
    setEditingEffort(null)
    setEditingAssignee(null)
  }

  const handleDragOver = ({ active, over }) => {
    if (!over) return
    const src = findPriority(active.id)
    const dst = PRIORITIES.includes(over.id) ? over.id : findPriority(over.id)
    if (!src || !dst || src === dst) return

    setGroups(prev => {
      const task     = prev[src].find(t => t.id === active.id)
      if (!task) return prev
      const destIdx  = prev[dst].findIndex(t => t.id === over.id)
      const newDst   = [...prev[dst]]
      newDst.splice(destIdx >= 0 ? destIdx : newDst.length, 0, { ...task, priority: dst })
      return {
        ...prev,
        [src]: prev[src].filter(t => t.id !== active.id),
        [dst]: newDst,
      }
    })
  }

  const handleDragEnd = async ({ active, over }) => {
    draggingRef.current = false
    setActiveTask(null)
    if (!over) return

    const src = findPriority(active.id)
    const dst = PRIORITIES.includes(over.id) ? over.id : findPriority(over.id)
    if (!src || !dst) return

    if (src === dst) {
      // Reorder within group
      setGroups(prev => {
        const items    = prev[src]
        const oldIdx   = items.findIndex(t => t.id === active.id)
        const newIdx   = items.findIndex(t => t.id === over.id)
        if (oldIdx === newIdx) return prev
        const reordered = arrayMove(items, oldIdx, newIdx)
        saveOrder(reordered, src)
        return { ...prev, [src]: reordered }
      })
    } else {
      // Cross-group: priority already changed in onDragOver; persist it
      setGroups(prev => {
        saveOrder(prev[dst], dst, active.id)
        return prev
      })
    }
  }

  const saveOrder = async (items, priority, movedId = null) => {
    await Promise.all(items.map((t, i) =>
      tasksApi.update(t.id, {
        sort_order: i,
        ...(t.id === movedId ? { priority } : {}),
      })
    ))
    onChanged?.()
  }

  const handleEffortSave = async (taskId, size, hours) => {
    setGroups(prev => {
      const next = {}
      for (const p of PRIORITIES) {
        next[p] = prev[p].map(t =>
          t.id === taskId ? { ...t, effort_size: size ?? null, effort_hours: hours ?? null } : t
        )
      }
      return next
    })
    setEditingEffort(null)
    await tasksApi.update(taskId, { effort_size: size ?? null, effort_hours: hours ?? null })
    onChanged?.()
  }

  const handleAssigneeSave = async (taskId, userId) => {
    const user = users.find(u => u.id === userId)
    setGroups(prev => {
      const next = {}
      for (const p of PRIORITIES) {
        next[p] = prev[p].map(t =>
          t.id === taskId
            ? { ...t, assigned_to: userId ?? null, assigned_to_name: user?.name ?? null }
            : t
        )
      }
      return next
    })
    setEditingAssignee(null)
    await tasksApi.update(taskId, { assigned_to: userId ?? null })
    onChanged?.()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3">
        {PRIORITIES.map(priority => (
          <PrioritySection
            key={priority}
            priority={priority}
            tasks={groups[priority]}
            users={users}
            style={P_STYLE[priority]}
            editingEffort={editingEffort}
            editingAssignee={editingAssignee}
            onEditEffort={setEditingEffort}
            onEditAssignee={setEditingAssignee}
            onEffortSave={handleEffortSave}
            onAssigneeSave={handleAssigneeSave}
            onEdit={onEdit}
            onComplete={onComplete}
            onHistory={onHistory}
            onDelete={onDelete}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="bg-white rounded-lg shadow-xl border border-indigo-300 px-3 py-2.5 opacity-95">
            <span className="text-sm font-medium text-gray-900">{activeTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ── Priority section ───────────────────────────────────────────────────────────

function PrioritySection({ priority, tasks, users, style, editingEffort, editingAssignee,
  onEditEffort, onEditAssignee, onEffortSave, onAssigneeSave, onEdit, onComplete, onHistory, onDelete }) {

  const { setNodeRef, isOver } = useDroppable({ id: priority })

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
        <span className={`text-xs font-bold uppercase tracking-widest ${style.header}`}>{priority}</span>
        <span className="text-xs text-gray-400">({tasks.length})</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`rounded-xl border transition-colors min-h-[44px] ${
          isOver ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-100 bg-gray-50/50'
        }`}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-300 text-center py-3">Drop here</p>
          ) : (
            tasks.map(task => (
              <SortableTaskRow
                key={task.id}
                task={task}
                users={users}
                style={style}
                editingEffort={editingEffort}
                editingAssignee={editingAssignee}
                onEditEffort={onEditEffort}
                onEditAssignee={onEditAssignee}
                onEffortSave={onEffortSave}
                onAssigneeSave={onAssigneeSave}
                onEdit={onEdit}
                onComplete={onComplete}
                onHistory={onHistory}
                onDelete={onDelete}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

// ── Sortable row wrapper ───────────────────────────────────────────────────────

function SortableTaskRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, users, style, dragHandleProps, editingEffort, editingAssignee,
  onEditEffort, onEditAssignee, onEffortSave, onAssigneeSave, onEdit, onComplete, onHistory, onDelete }) {

  const status  = taskStatus(task)
  const due     = dueLabel(task)
  const effort  = effortLabel(task)

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 group relative">

      {/* Drag handle */}
      <button
        {...dragHandleProps}
        className="text-gray-300 hover:text-gray-500 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        tabIndex={-1}
      >
        <GripIcon />
      </button>

      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status] ?? STATUS_DOT['no-due']}`} />

      {/* Title */}
      <span className="flex-1 min-w-0 text-sm text-gray-900 font-medium truncate">
        {task.title}
        {task.parent_title && (
          <span className="text-xs text-gray-400 font-normal ml-1.5">↳ {task.parent_title}</span>
        )}
      </span>

      {/* Effort badge */}
      <div className="relative shrink-0">
        <button
          onClick={() => onEditEffort(editingEffort === task.id ? null : task.id)}
          className={`text-xs px-1.5 py-0.5 rounded border font-medium transition-colors ${
            effort
              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
          }`}
        >
          {effort ?? '—'}
        </button>
        {editingEffort === task.id && (
          <EffortPopover task={task} onSave={onEffortSave} onClose={() => onEditEffort(null)} />
        )}
      </div>

      {/* Due label — hidden on very small screens */}
      {due && (
        <span className={`hidden sm:block text-xs shrink-0 ${
          status === 'overdue' ? 'text-red-600 font-medium' :
          status === 'due-today' ? 'text-amber-600 font-medium' : 'text-gray-400'
        }`}>
          {due}
        </span>
      )}

      {/* Assignee chip */}
      <div className="relative shrink-0">
        <button
          onClick={() => onEditAssignee(editingAssignee === task.id ? null : task.id)}
          className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
            task.assigned_to_name
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
          }`}
        >
          {task.assigned_to_name ?? 'Anyone'}
        </button>
        {editingAssignee === task.id && (
          <AssigneePopover
            task={task}
            users={users}
            onSave={onAssigneeSave}
            onClose={() => onEditAssignee(null)}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onComplete(task)}
          title="Complete"
          className="text-gray-300 hover:text-green-600 transition-colors p-1"
        >
          <CheckIcon />
        </button>
        <button
          onClick={() => onEdit(task)}
          title="Edit"
          className="text-gray-300 hover:text-indigo-600 transition-colors p-1"
        >
          <PencilIcon />
        </button>
        <button
          onClick={() => onHistory(task)}
          title="History"
          className="hidden sm:block text-gray-300 hover:text-gray-600 transition-colors p-1"
        >
          <HistoryIcon />
        </button>
      </div>
    </div>
  )
}

// ── Effort popover ─────────────────────────────────────────────────────────────

function EffortPopover({ task, onSave, onClose }) {
  const [size,  setSize]  = useState(task.effort_size  ?? null)
  const [hours, setHours] = useState(task.effort_hours != null ? String(task.effort_hours) : '')
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSizeClick = (s) => {
    const next = size === s ? null : s
    setSize(next)
    if (next) setHours('') // clear hours when size selected
  }

  const handleHoursChange = (v) => {
    setHours(v)
    if (v) setSize(null) // clear size when hours entered
  }

  const handleSave = () => {
    const h = hours !== '' ? Number(hours) : null
    onSave(task.id, size ?? null, h)
  }

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-48">
      <p className="text-xs font-medium text-gray-500 mb-2">Effort estimate</p>
      <div className="flex gap-1.5 mb-2">
        {['S', 'M', 'L'].map(s => (
          <button key={s} onClick={() => handleSizeClick(s)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
              size === s
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
            }`}>
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder="Hours"
          value={hours}
          onChange={e => handleHoursChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <span className="text-xs text-gray-400 shrink-0">h</span>
      </div>
      <div className="flex gap-1.5">
        <button onClick={onClose} className="flex-1 py-1 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleSave} className="flex-1 py-1 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700">
          Save
        </button>
      </div>
    </div>
  )
}

// ── Assignee popover ──────────────────────────────────────────────────────────

function AssigneePopover({ task, users, onSave, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-lg border border-gray-200 p-2 min-w-[140px]">
      <button
        onClick={() => onSave(task.id, null)}
        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          !task.assigned_to ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        Anyone
      </button>
      {users.map(u => (
        <button key={u.id}
          onClick={() => onSave(task.id, u.id)}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            task.assigned_to === u.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {u.name}
        </button>
      ))}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <circle cx="7" cy="6"  r="1.2"/><circle cx="13" cy="6"  r="1.2"/>
      <circle cx="7" cy="10" r="1.2"/><circle cx="13" cy="10" r="1.2"/>
      <circle cx="7" cy="14" r="1.2"/><circle cx="13" cy="14" r="1.2"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L6.75 19.963l-4.5 1.5 1.5-4.5L16.862 3.487z" />
    </svg>
  )
}
function HistoryIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
