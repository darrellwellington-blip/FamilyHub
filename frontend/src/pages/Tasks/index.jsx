import { useState, useEffect, useCallback, useRef } from 'react'
import { tasksApi, categoriesApi, usersApi } from '../../api'
import { useUser } from '../../UserContext'
import { filterAndSort, countsByFilter } from './taskUtils'
import TaskCard from './TaskCard'
import TaskListView from './TaskListView'
import TaskForm from './TaskForm'
import CompleteModal from './CompleteModal'
import HistoryModal from './HistoryModal'

const FILTERS = [
  { key: 'overdue', label: 'Overdue',   countKey: 'overdue',   danger: true },
  { key: 'today',   label: 'Due Today', countKey: 'today',     warn: true },
  { key: 'week',    label: '1 Week',    countKey: 'week' },
  { key: '2weeks',  label: '2 Weeks',   countKey: 'twoWeeks' },
  { key: 'month',   label: '1 Month',   countKey: 'month' },
  { key: 'all',     label: 'All',       countKey: 'all' },
  { key: 'archived',label: 'Archived',  countKey: 'archived',  muted: true },
]

export default function Tasks() {
  const { users, reloadUsers } = useUser()
  const [tasks,          setTasks]          = useState([])
  const [categories,     setCategories]     = useState([])
  const [loading,        setLoading]        = useState(true)
  const [filter,         setFilter]         = useState('all')
  const [catFilter,      setCatFilter]      = useState('')
  const [personFilter,   setPersonFilter]   = useState(null)
  const [viewMode,       setViewMode]       = useState('list') // 'list' | 'cards'
  const [showForm,       setShowForm]       = useState(false)
  const [editingTask,    setEditingTask]    = useState(null)
  const [completingTask, setCompletingTask] = useState(null)
  const [historyTask,    setHistoryTask]    = useState(null)
  const [newSubtaskParent, setNewSubtaskParent] = useState(null)

  // Quick-add popovers
  const [newCatName,    setNewCatName]    = useState('')
  const [showNewCat,    setShowNewCat]    = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [showNewPerson, setShowNewPerson] = useState(false)
  const catInputRef    = useRef(null)
  const personInputRef = useRef(null)

  const loadTasks = useCallback(async () => {
    try {
      const data = await tasksApi.list()
      setTasks(data)
    } catch {
      // keep existing task list on refresh failure; only clear on initial load
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const data = await categoriesApi.list()
      setCategories(data.map(c => c.name))
    } catch { /* non-fatal — preset categories still available */ }
  }, [])

  useEffect(() => { loadTasks(); loadCategories() }, [loadTasks, loadCategories])

  // Focus input when popovers open
  useEffect(() => { if (showNewCat)    setTimeout(() => catInputRef.current?.focus(), 50) },    [showNewCat])
  useEffect(() => { if (showNewPerson) setTimeout(() => personInputRef.current?.focus(), 50) }, [showNewPerson])

  const handleDelete = async (id) => {
    await tasksApi.delete(id)
    setTasks(ts => ts.filter(t => t.id !== id))
  }

  const openEdit = (task) => { setEditingTask(task); setShowForm(true) }
  const openAdd  = ()     => { setEditingTask(null);  setShowForm(true) }

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    try {
      await categoriesApi.create({ name })
      setNewCatName('')
      setShowNewCat(false)
      await loadCategories()
    } catch (e) {
      // If it already exists in DB just close and refresh
      if (e?.message?.includes('409') || e?.message?.includes('already exists')) {
        setNewCatName('')
        setShowNewCat(false)
        await loadCategories()
      } else {
        alert(`Could not add category: ${e?.message || e}`)
      }
    }
  }

  const handleAddPerson = async () => {
    const name = newPersonName.trim()
    if (!name) return
    try {
      await usersApi.create({ name })
      setNewPersonName('')
      setShowNewPerson(false)
      await reloadUsers()
    } catch (e) {
      alert(`Could not add person: ${e?.message || e}`)
    }
  }

  // Merge DB categories with any used on tasks (in case of legacy data)
  const allCategories = [...new Set([
    ...categories,
    ...tasks.map(t => t.category).filter(Boolean),
  ])].sort()

  const counts   = countsByFilter(tasks)
  const filtered = filterAndSort(tasks, filter)
    .filter(t => !catFilter    || t.category    === catFilter)
    .filter(t => !personFilter || t.assigned_to === personFilter)

  return (
    <div>

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-2.5 py-1.5 text-sm transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >☰</button>
            <button
              onClick={() => setViewMode('cards')}
              title="Card view"
              className={`px-2.5 py-1.5 text-sm transition-colors ${viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >⊞</button>
          </div>
          <button className="btn-primary" onClick={openAdd}>+ Add Task</button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map(f => {
          const count  = counts[f.countKey] ?? 0
          const active = filter === f.key
          let cls = 'btn border '
          if (active) {
            cls += f.danger  ? 'bg-red-600 text-white border-red-600 ' :
                   f.warn    ? 'bg-amber-500 text-white border-amber-500 ' :
                   f.muted   ? 'bg-gray-500 text-white border-gray-500 ' :
                               'bg-indigo-600 text-white border-indigo-600 '
          } else {
            cls += f.danger  ? 'border-red-200 text-red-600 hover:bg-red-50 ' :
                   f.warn    ? 'border-amber-200 text-amber-600 hover:bg-amber-50 ' :
                   f.muted   ? 'border-gray-200 text-gray-500 hover:bg-gray-50 ' :
                               'border-gray-200 text-gray-600 hover:bg-gray-50 '
          }
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} className={cls}>
              {f.label}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs leading-none
                  ${active ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Category filter ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Category:</span>
        <button
          onClick={() => setCatFilter('')}
          className={`btn border text-sm ${!catFilter
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          All
        </button>
        {allCategories.map(cat => (
          <button key={cat}
            onClick={() => setCatFilter(c => c === cat ? '' : cat)}
            className={`btn border text-sm ${catFilter === cat
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {cat}
          </button>
        ))}
        <div className="relative">
          <button onClick={() => { setShowNewCat(v => !v); setShowNewPerson(false) }}
            className="btn border text-sm border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500">
            + New
          </button>
          {showNewCat && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 p-3 flex gap-2 min-w-[200px]">
              <input ref={catInputRef} className="input flex-1 text-sm py-1"
                placeholder="Category name"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowNewCat(false) }} />
              <button onClick={handleAddCategory} className="btn-primary text-sm py-1">Add</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Person filter ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Person:</span>
        <button
          onClick={() => setPersonFilter(null)}
          className={`btn border text-sm ${personFilter === null
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          All
        </button>
        {users.map(u => (
          <button key={u.id}
            onClick={() => setPersonFilter(f => f === u.id ? null : u.id)}
            className={`btn border text-sm ${personFilter === u.id
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {u.name}
          </button>
        ))}
        <div className="relative">
          <button onClick={() => { setShowNewPerson(v => !v); setShowNewCat(false) }}
            className="btn border text-sm border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500">
            + New
          </button>
          {showNewPerson && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 p-3 flex gap-2 min-w-[200px]">
              <input ref={personInputRef} className="input flex-1 text-sm py-1"
                placeholder="Person's name"
                value={newPersonName}
                onChange={e => setNewPersonName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddPerson(); if (e.key === 'Escape') setShowNewPerson(false) }} />
              <button onClick={handleAddPerson} className="btn-primary text-sm py-1">Add</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Task content ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading tasks…</div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} onAdd={openAdd} />
      ) : viewMode === 'list' ? (
        <TaskListView
          key={filtered.map(t => t.id).join(',')}
          tasks={filtered}
          users={users}
          onEdit={openEdit}
          onComplete={(task) => setCompletingTask(task)}
          onHistory={(task) => setHistoryTask(task)}
          onDelete={(task) => handleDelete(task.id)}
          onChanged={loadTasks}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={() => setCompletingTask(task)}
              onEdit={() => openEdit(task)}
              onDelete={() => handleDelete(task.id)}
              onHistory={() => setHistoryTask(task)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {showForm && (
        <TaskForm
          task={editingTask}
          categories={allCategories}
          allTasks={tasks}
          onClose={() => setShowForm(false)}
          onSaved={loadTasks}
          onDelete={editingTask ? async () => {
            await handleDelete(editingTask.id)
            setShowForm(false)
          } : undefined}
          onAddSubtask={editingTask ? () => {
            // Open a new-task form pre-set as a subtask of the current task
            setNewSubtaskParent(editingTask)
            setShowForm(false)
          } : undefined}
        />
      )}
      {newSubtaskParent && (
        <TaskForm
          task={{ parent_task_id: newSubtaskParent.id }}
          categories={allCategories}
          allTasks={tasks}
          onClose={() => setNewSubtaskParent(null)}
          onSaved={async () => { await loadTasks(); setNewSubtaskParent(null) }}
        />
      )}
      {completingTask && (
        <CompleteModal
          task={completingTask}
          onClose={() => setCompletingTask(null)}
          onSaved={loadTasks}
        />
      )}
      {historyTask && (
        <HistoryModal
          task={historyTask}
          onClose={() => setHistoryTask(null)}
          onChanged={loadTasks}
        />
      )}

    </div>
  )
}

function EmptyState({ filter, onAdd }) {
  const messages = {
    overdue:  { icon: '✅', text: 'Nothing is overdue.' },
    today:    { icon: '☀️', text: 'Nothing due today.' },
    week:     { icon: '📅', text: 'Nothing due this week.' },
    '2weeks': { icon: '📅', text: 'Nothing due in the next two weeks.' },
    month:    { icon: '📅', text: 'Nothing due this month.' },
    archived: { icon: '📦', text: 'No archived tasks yet.' },
    all:      { icon: '✨', text: 'No tasks yet.' },
  }
  const { icon, text } = messages[filter] ?? messages.all
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
      <span className="text-4xl">{icon}</span>
      <p className="text-base">{text}</p>
      {filter === 'all' && (
        <button className="btn-primary mt-2" onClick={onAdd}>Add your first task</button>
      )}
    </div>
  )
}
