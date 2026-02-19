'use client'

import { useState, useEffect, useCallback, useId, useRef } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Note, Notebook } from '@/lib/types'
import {
  ExtractedTask, ExtractedHeading, NoteGroupItem,
  extractTasksFromContent, extractItemsFromContent,
  toggleTaskInContent, reorderTasksInContent,
  copyTaskToContent, noteIdFromTaskId,
  addTaskToContent,
} from '@/lib/taskUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NoteGroup {
  noteId: string
  noteTitle: string
  notebookName?: string
  tasks: ExtractedTask[]
  items: NoteGroupItem[]
  content: string
}

type Filter = 'incomplete' | 'all'

interface TaskViewProps {
  onNavigate: (updates: Record<string, string | null>) => void
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl animate-in slide-in-from-bottom-2">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-gray-400 hover:text-white ml-1 leading-none">×</button>
    </div>
  )
}

// ─── Sortable task row ────────────────────────────────────────────────────────

function SortableTaskRow({
  task, onToggle, onGoToNote,
}: {
  task: ExtractedTask; onToggle: (t: ExtractedTask) => void; onGoToNote: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      className="flex items-center gap-2 px-3 py-2 group hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-md transition-colors"
    >
      <button {...attributes} {...listeners} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-xs" aria-label="Drag">
        ⠿
      </button>
      <input
        type="checkbox"
        checked={task.checked}
        onChange={() => onToggle(task)}
        className="flex-shrink-0 w-4 h-4 cursor-pointer accent-indigo-500 rounded"
      />
      <span className={`flex-1 text-sm ${task.checked ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
        {task.text || <em className="text-gray-400 dark:text-gray-600">Empty task</em>}
      </span>
      <button
        onClick={() => onGoToNote(task.noteId)}
        className="flex-shrink-0 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
      >
        Go to note →
      </button>
    </div>
  )
}

// ─── Heading row ──────────────────────────────────────────────────────────────

function HeadingRow({ item }: { item: ExtractedHeading }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {item.text}
      </span>
    </div>
  )
}

// ─── Add item form ────────────────────────────────────────────────────────────

function AddItemForm({
  mode, onSubmit, onCancel,
}: {
  mode: 'task' | 'heading'
  onSubmit: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); if (text.trim()) onSubmit(text.trim()) }
    else if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={mode === 'task' ? 'New task...' : 'Section heading...'}
        className="flex-1 text-sm bg-transparent border-b border-indigo-400 outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 pb-0.5"
      />
      <button
        onClick={() => { if (text.trim()) onSubmit(text.trim()) }}
        className="text-xs text-indigo-500 hover:text-indigo-400 font-medium"
      >
        Add
      </button>
      <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        Cancel
      </button>
    </div>
  )
}

// ─── Note group ───────────────────────────────────────────────────────────────

function NoteGroup({
  group, filter, onTaskToggle, onGoToNote, onAddItem, onCreateNote, isNew, onNewGroupSettled,
}: {
  group: NoteGroup
  filter: Filter
  onTaskToggle: (t: ExtractedTask) => void
  onGoToNote: (id: string) => void
  onAddItem: (noteId: string, text: string) => void
  onCreateNote: () => void
  isNew?: boolean
  onNewGroupSettled?: () => void
}) {
  const { setNodeRef } = useDroppable({ id: `group__${group.noteId}` })
  const [addingTask, setAddingTask] = useState<boolean>(isNew ? true : false)

  const visibleTasks = filter === 'incomplete' ? group.tasks.filter((t) => !t.checked) : group.tasks
  const hasContent = filter === 'all' ? group.items.length > 0 : visibleTasks.length > 0
  if (!hasContent && !addingTask) return null

  function closeForm() {
    setAddingTask(false)
    onNewGroupSettled?.()
  }

  const taskIdsInOrder = group.items
    .filter((item): item is ExtractedTask => item.type === 'task')
    .map((item) => item.id)

  return (
    <div ref={setNodeRef} className="mb-6">
      <div className="flex items-baseline gap-2 mb-1.5 px-3">
        <button
          onClick={() => onGoToNote(group.noteId)}
          className="text-gray-800 dark:text-white font-semibold text-sm hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
        >
          {group.noteTitle || 'Untitled'}
        </button>
        {group.notebookName && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{group.notebookName}</span>
        )}
      </div>

      {filter === 'all' ? (
        <SortableContext items={taskIdsInOrder} strategy={verticalListSortingStrategy}>
          {group.items.map((item) =>
            item.type === 'heading' ? (
              <HeadingRow key={item.id} item={item} />
            ) : (
              <SortableTaskRow key={item.id} task={item} onToggle={onTaskToggle} onGoToNote={onGoToNote} />
            )
          )}
        </SortableContext>
      ) : (
        <SortableContext items={visibleTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {visibleTasks.map((task) => (
            <SortableTaskRow key={task.id} task={task} onToggle={onTaskToggle} onGoToNote={onGoToNote} />
          ))}
        </SortableContext>
      )}

      {addingTask && (
        <AddItemForm
          mode="task"
          onSubmit={(text) => { onAddItem(group.noteId, text); closeForm() }}
          onCancel={closeForm}
        />
      )}

      <div className="flex items-center gap-2 px-3 pt-1">
        <button
          onClick={() => setAddingTask(true)}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
          + Task
        </button>
        <button
          onClick={onCreateNote}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
          + Note
        </button>
      </div>
    </div>
  )
}

// ─── Drag overlay card ────────────────────────────────────────────────────────

function DragCard({ task }: { task: ExtractedTask }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-indigo-400/40 rounded-lg shadow-2xl text-sm text-gray-800 dark:text-white opacity-95 max-w-sm">
      <span className="text-gray-400 text-xs">⠿</span>
      <input type="checkbox" checked={task.checked} readOnly className="w-4 h-4 accent-indigo-500" />
      <span className="truncate">{task.text || 'Empty task'}</span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TaskSkeleton() {
  return (
    <div className="mb-6 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3 mx-3" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded flex-1" />
        </div>
      ))}
    </div>
  )
}

// ─── New group form ───────────────────────────────────────────────────────────

function NewGroupForm({
  notebooks, onSubmit, onCancel,
}: {
  notebooks: Notebook[]
  onSubmit: (title: string, notebookId: string | null) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [notebookId, setNotebookId] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); if (title.trim()) onSubmit(title.trim(), notebookId || null) }
    else if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="mb-4 p-3 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-800">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Note title..."
        className="w-full text-sm bg-transparent border-b border-indigo-400 outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 pb-0.5 mb-2"
      />
      {notebooks.length > 0 && (
        <select
          value={notebookId}
          onChange={(e) => setNotebookId(e.target.value)}
          className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 w-full mb-2"
        >
          <option value="">No notebook</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>{nb.name}</option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { if (title.trim()) onSubmit(title.trim(), notebookId || null) }}
          disabled={!title.trim()}
          className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Create
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Main TaskView ────────────────────────────────────────────────────────────

export default function TaskView({ onNavigate }: TaskViewProps) {
  const uid = useId()
  const [groups, setGroups] = useState<NoteGroup[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTask, setActiveTask] = useState<ExtractedTask | null>(null)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([])
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [pendingNewGroupId, setPendingNewGroupId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const loadTasks = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const [notesRes, notebooksRes] = await Promise.all([
        fetch('/api/notes'),
        fetch('/api/notebooks'),
      ])
      if (!notesRes.ok) { setError(true); return }
      const notes: Note[] = await notesRes.json()
      if (notebooksRes.ok) setNotebooks(await notebooksRes.json())
      setGroups(
        notes
          .map((note) => ({
            noteId: note.id,
            noteTitle: note.title,
            notebookName: note.notebook?.name,
            tasks: extractTasksFromContent(note.content, note.id, note.title, note.notebook?.name),
            items: extractItemsFromContent(note.content, note.id, note.title, note.notebook?.name),
            content: note.content,
          }))
          .filter((g) => g.tasks.length > 0 || g.items.length > 0)
      )
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  function buildTaskMap() {
    const map = new Map<string, ExtractedTask>()
    for (const g of groups) for (const t of g.tasks) map.set(t.id, t)
    return map
  }

  function addToast(message: string) {
    setToasts((prev) => [...prev, { id: `${uid}-${Date.now()}`, message }])
  }

  function updateGroupContent(noteId: string, newContent: string) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.noteId !== noteId) return g
        return {
          ...g,
          content: newContent,
          tasks: extractTasksFromContent(newContent, noteId, g.noteTitle, g.notebookName),
          items: extractItemsFromContent(newContent, noteId, g.noteTitle, g.notebookName),
        }
      })
    )
  }

  async function saveNoteContent(noteId: string, content: string) {
    await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  }

  async function handleToggle(task: ExtractedTask) {
    const group = groups.find((g) => g.noteId === task.noteId)
    if (!group) return
    const newContent = toggleTaskInContent(group.content, task.taskListIndex, task.taskItemIndex, !task.checked)
    updateGroupContent(task.noteId, newContent)
    await saveNoteContent(task.noteId, newContent)
  }

  async function handleAddItem(noteId: string, text: string) {
    const group = groups.find((g) => g.noteId === noteId)
    if (!group) return
    const newContent = addTaskToContent(group.content, text)
    updateGroupContent(noteId, newContent)
    await saveNoteContent(noteId, newContent)
  }

  async function handleCreateGroup(title: string, notebookId: string | null) {
    const initialContent = JSON.stringify({ type: 'doc', content: [{ type: 'taskList', content: [] }] })
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notebookId, content: initialContent }),
      })
      if (!res.ok) { addToast('Failed to create note'); return }
      const note: Note = await res.json()
      const newGroup: NoteGroup = {
        noteId: note.id,
        noteTitle: note.title,
        notebookName: note.notebook?.name,
        tasks: [],
        items: [],
        content: initialContent,
      }
      setGroups((prev) => [...prev, newGroup])
      setShowNewGroup(false)
      setPendingNewGroupId(note.id)
    } catch {
      addToast('Failed to create note')
    }
  }

  function goToNote(noteId: string) {
    onNavigate({ view: 'all', noteId, notebookId: null, tagId: null })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(buildTaskMap().get(String(event.active.id)) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over || active.id === over.id) return

    const sourceNoteId = noteIdFromTaskId(String(active.id))
    const overId = String(over.id)
    const destNoteId = overId.startsWith('group__') ? overId.slice(7) : noteIdFromTaskId(overId)

    if (sourceNoteId === destNoteId) {
      const group = groups.find((g) => g.noteId === sourceNoteId)
      if (!group) return
      const visible = filter === 'incomplete' ? group.tasks.filter((t) => !t.checked) : group.tasks
      const oldIdx = visible.findIndex((t) => t.id === active.id)
      const newIdx = visible.findIndex((t) => t.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(visible, oldIdx, newIdx)
      const newContent = reorderTasksInContent(group.content, reordered[newIdx].taskListIndex, oldIdx, newIdx)
      updateGroupContent(sourceNoteId, newContent)
      await saveNoteContent(sourceNoteId, newContent)
    } else {
      const sourceTask = buildTaskMap().get(String(active.id))
      const destGroup = groups.find((g) => g.noteId === destNoteId)
      if (!sourceTask || !destGroup) return
      const newContent = copyTaskToContent(destGroup.content, sourceTask.node)
      updateGroupContent(destNoteId, newContent)
      await saveNoteContent(destNoteId, newContent)
      addToast(`Copied to "${destGroup.noteTitle || 'Untitled'}"`)
    }
  }

  const allTasks = groups.flatMap((g) => g.tasks)
  const incompleteTasks = allTasks.filter((t) => !t.checked)
  const notesWithIncompleteTasks = new Set(incompleteTasks.map((t) => t.noteId)).size
  const visibleGroups = groups.filter((g) => {
    if (g.noteId === pendingNewGroupId) return true
    return filter === 'incomplete' ? g.tasks.some((t) => !t.checked) : g.items.length > 0 || g.tasks.length > 0
  })

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-gray-900 dark:text-white font-semibold text-base">Tasks</h2>
            <button
              onClick={() => setShowNewGroup(true)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors font-medium"
            >
              + New Group
            </button>
          </div>
          <div className="flex items-center bg-gray-200 dark:bg-gray-800 rounded-lg p-0.5">
            {(['incomplete', 'all'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                  filter === f ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {!loading && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {incompleteTasks.length === 0 ? (
              <span className="text-green-600 dark:text-green-400">No incomplete tasks — you&apos;re all caught up! 🎉</span>
            ) : (
              <>
                <span className="text-gray-800 dark:text-white font-medium">{incompleteTasks.length}</span>
                {' task'}{incompleteTasks.length !== 1 ? 's' : ''}{' remaining across '}
                <span className="text-gray-800 dark:text-white font-medium">{notesWithIncompleteTasks}</span>
                {' note'}{notesWithIncompleteTasks !== 1 ? 's' : ''}
              </>
            )}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <>{[...Array(3)].map((_, i) => <TaskSkeleton key={i} />)}</>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <p className="text-red-500 dark:text-red-400 text-sm">Failed to load tasks.</p>
            <button onClick={loadTasks} className="text-indigo-500 text-sm underline">Try again</button>
          </div>
        ) : (
          <>
            {showNewGroup && (
              <NewGroupForm
                notebooks={notebooks}
                onSubmit={handleCreateGroup}
                onCancel={() => setShowNewGroup(false)}
              />
            )}
            {visibleGroups.length === 0 && !showNewGroup ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-400 dark:text-gray-500 text-sm">No tasks yet — create a group to get started.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                {visibleGroups.map((group) => (
                  <NoteGroup
                    key={group.noteId}
                    group={group}
                    filter={filter}
                    onTaskToggle={handleToggle}
                    onGoToNote={goToNote}
                    onAddItem={handleAddItem}
                    onCreateNote={() => setShowNewGroup(true)}
                    isNew={pendingNewGroupId === group.noteId}
                    onNewGroupSettled={pendingNewGroupId === group.noteId ? () => setPendingNewGroupId(null) : undefined}
                  />
                ))}
                <DragOverlay>{activeTask && <DragCard task={activeTask} />}</DragOverlay>
              </DndContext>
            )}
          </>
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} onDismiss={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </div>
  )
}
