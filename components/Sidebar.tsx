'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Notebook, Tag } from '@/lib/types'
import { NOTEBOOK_COLORS, tagStyle } from '@/lib/utils'
import { extractTasksFromContent } from '@/lib/taskUtils'

interface SidebarProps {
  view: string
  notebookId: string | null
  tagId: string | null
  refreshKey: number
  onNavigate: (updates: Record<string, string | null>) => void
}

// ─── Color swatch picker (shared by create + edit forms) ─────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {NOTEBOOK_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-5 h-5 rounded-full border-2 transition-transform flex-shrink-0"
          style={{
            backgroundColor: c,
            borderColor: value === c ? 'white' : 'transparent',
            transform: value === c ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )
}

// ─── New notebook inline form ─────────────────────────────────────────────────

function NewNotebookForm({ onCreated, onCancel }: { onCreated: (nb: Notebook) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(NOTEBOOK_COLORS[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      if (res.ok) onCreated(await res.json())
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 px-2 space-y-2">
      <input
        autoFocus
        type="text"
        placeholder="Notebook name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded py-1 transition-colors"
        >
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── New tag inline form ──────────────────────────────────────────────────────

function NewTagForm({ onCreated, onCancel }: { onCreated: (tag: Tag) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(NOTEBOOK_COLORS[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return
    setSaving(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, color }),
      })
      if (res.ok) onCreated(await res.json())
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 px-2 space-y-2">
      <input autoFocus type="text" placeholder="Tag name" value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim()}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded py-1 transition-colors">
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Sortable notebook row with edit/delete ───────────────────────────────────

function SortableNotebookRow({
  notebook,
  isActive,
  onClick,
  onUpdated,
  onDeleted,
}: {
  notebook: Notebook
  isActive: boolean
  onClick: () => void
  onUpdated: (nb: Notebook) => void
  onDeleted: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: notebook.id })

  const [editMode, setEditMode] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editName, setEditName] = useState(notebook.name)
  const [editColor, setEditColor] = useState(notebook.color)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/notebooks/${notebook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      if (res.ok) {
        onUpdated(await res.json())
        setEditMode(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/notebooks/${notebook.id}`, { method: 'DELETE' })
      onDeleted(notebook.id)
    } finally {
      setDeleting(false)
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  if (editMode) {
    return (
      <div ref={setNodeRef} style={style} className="px-2 py-2 space-y-2">
        <form onSubmit={handleSaveEdit} className="space-y-2">
          <input
            autoFocus
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <ColorPicker value={editColor} onChange={setEditColor} />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded py-1 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (deleteConfirm) {
    return (
      <div ref={setNodeRef} style={style} className="px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20">
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">
          Delete &quot;{notebook.name}&quot;? Notes become uncategorized.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded py-1 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={() => setDeleteConfirm(false)}
            className="px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center group rounded"
    >
      <button
        {...attributes}
        {...listeners}
        className="px-1 py-1 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <button
        onClick={onClick}
        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm truncate transition-colors ${
          isActive
            ? 'bg-indigo-600/20 text-indigo-600 dark:text-indigo-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: notebook.color }} />
        <span className="flex-1 truncate text-left">{notebook.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
          {notebook._count?.notes ?? 0}
        </span>
      </button>
      {/* Edit / Delete actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setEditMode(true) }}
          title="Edit notebook"
          className="p-1 text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-xs"
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(true) }}
          title="Delete notebook"
          className="p-1 text-gray-400 dark:text-gray-600 hover:text-red-500 transition-colors text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Tag row with edit/delete ─────────────────────────────────────────────────

function TagRow({ tag, isActive, onClick, onUpdated, onDeleted }: {
  tag: Tag; isActive: boolean; onClick: () => void
  onUpdated: (tag: Tag) => void; onDeleted: (id: string) => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [editColor, setEditColor] = useState(tag.color)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSaveColor() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: editColor }),
      })
      if (res.ok) { onUpdated(await res.json()); setEditMode(false) }
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
      onDeleted(tag.id)
    } finally { setDeleting(false) }
  }

  if (editMode) {
    return (
      <div className="px-2 py-2 space-y-2">
        <ColorPicker value={editColor} onChange={setEditColor} />
        <div className="flex gap-2">
          <button onClick={handleSaveColor} disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded py-1 transition-colors">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => { setEditMode(false); setEditColor(tag.color) }}
            className="px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (confirmDelete) {
    return (
      <div className="px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20">
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">Delete #{tag.name}?</p>
        <div className="flex gap-2">
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded py-1 transition-colors">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button onClick={() => setConfirmDelete(false)}
            className="px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center group rounded">
      <button onClick={onClick}
        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
          isActive
            ? 'bg-indigo-600/20 text-indigo-600 dark:text-indigo-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
        }`}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
        <span className="flex-1 truncate text-left">#{tag.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{tag._count?.notes ?? 0}</span>
      </button>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center flex-shrink-0">
        <button onClick={(e) => { e.stopPropagation(); setEditMode(true) }}
          title="Change color"
          className="p-1 text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-xs">
          ✎
        </button>
        <button onClick={() => setConfirmDelete(true)}
          className="p-1 text-gray-400 dark:text-gray-600 hover:text-red-500 text-xs">
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar({
  view,
  notebookId,
  tagId,
  refreshKey,
  onNavigate,
}: SidebarProps) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isDark, setIsDark] = useState(false)
  const [notebooksOpen, setNotebooksOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [showNewNotebook, setShowNewNotebook] = useState(false)
  const [showNewTag, setShowNewTag] = useState(false)
  const [incompleteTaskCount, setIncompleteTaskCount] = useState(0)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const fetchData = useCallback(async () => {
    const [nbRes, tagRes, noteRes] = await Promise.all([
      fetch('/api/notebooks'),
      fetch('/api/tags'),
      fetch('/api/notes'),
    ])
    if (nbRes.ok) setNotebooks(await nbRes.json())
    if (tagRes.ok) setTags(await tagRes.json())
    if (noteRes.ok) {
      const notes = await noteRes.json()
      let count = 0
      for (const n of notes) {
        const tasks = extractTasksFromContent(n.content, n.id, n.title)
        count += tasks.filter((t) => !t.checked).length
      }
      setIncompleteTaskCount(count)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData, refreshKey])

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  async function handleNotebookDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = notebooks.findIndex((n) => n.id === active.id)
    const newIndex = notebooks.findIndex((n) => n.id === over.id)
    const reordered = arrayMove(notebooks, oldIndex, newIndex)
    setNotebooks(reordered)
    await fetch('/api/notebooks/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((n) => n.id) }),
    })
  }

  function handleNotebookCreated(nb: Notebook) {
    setNotebooks((prev) => [...prev, nb])
    setShowNewNotebook(false)
    onNavigate({ notebookId: nb.id, tagId: null, view: 'all', noteId: null })
  }

  function handleNotebookUpdated(updated: Notebook) {
    setNotebooks((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
  }

  function handleNotebookDeleted(id: string) {
    setNotebooks((prev) => prev.filter((n) => n.id !== id))
    if (notebookId === id) {
      onNavigate({ notebookId: null, view: 'all', noteId: null })
    }
  }

  function handleTagCreated(tag: Tag) {
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
    setShowNewTag(false)
  }

  function handleTagUpdated(updated: Tag) {
    setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  const navBase = 'w-full text-left px-3 py-1.5 rounded text-sm transition-colors'
  const navActive = 'bg-indigo-600/20 text-indigo-600 dark:text-indigo-300'
  const navInactive = 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'

  const isAllNotes = view === 'all' && !notebookId && !tagId
  const isPinned = view === 'pinned'
  const isTasks = view === 'tasks'

  return (
    <aside className="w-full bg-gray-100 dark:bg-gray-900 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between flex-shrink-0">
        <span className="text-gray-900 dark:text-white font-semibold text-base tracking-tight">
          NoteVault
        </span>
        <button
          onClick={toggleDark}
          title="Toggle dark mode"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors text-base"
        >
          {isDark ? '☀' : '☾'}
        </button>
      </div>

      {/* Primary nav */}
      <nav className="px-2 space-y-0.5 flex-shrink-0">
        <button
          onClick={() => onNavigate({ view: 'all', notebookId: null, tagId: null, noteId: null })}
          className={`${navBase} ${isAllNotes ? navActive : navInactive}`}
        >
          All Notes
        </button>
        <button
          onClick={() => onNavigate({ view: 'pinned', notebookId: null, tagId: null, noteId: null })}
          className={`${navBase} ${isPinned ? navActive : navInactive}`}
        >
          Pinned
        </button>
        <button
          onClick={() => onNavigate({ view: 'tasks', notebookId: null, tagId: null, noteId: null })}
          className={`${navBase} ${isTasks ? navActive : navInactive} flex items-center justify-between`}
        >
          <span>Tasks</span>
          {incompleteTaskCount > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-5 text-center">
              {incompleteTaskCount > 99 ? '99+' : incompleteTaskCount}
            </span>
          )}
        </button>
      </nav>

      {/* Export */}
      <div className="px-2 py-2 flex-shrink-0 border-t border-gray-200 dark:border-gray-700/50">
        <a
          href="/api/export"
          download
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <span>↓</span>
          <span>Export backup</span>
        </a>
      </div>

      {/* Scrollable section */}
      <div className="flex-1 overflow-y-auto px-2 mt-4 space-y-4">
        {/* Notebooks */}
        <section>
          <button
            onClick={() => setNotebooksOpen((o) => !o)}
            className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <span>Notebooks</span>
            <span>{notebooksOpen ? '▾' : '▸'}</span>
          </button>

          {notebooksOpen && (
            <div className="mt-1 space-y-0.5">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNotebookDragEnd}>
                <SortableContext items={notebooks.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                  {notebooks.map((nb) => (
                    <SortableNotebookRow
                      key={nb.id}
                      notebook={nb}
                      isActive={notebookId === nb.id}
                      onClick={() => onNavigate({ notebookId: nb.id, tagId: null, view: 'all', noteId: null })}
                      onUpdated={handleNotebookUpdated}
                      onDeleted={handleNotebookDeleted}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {notebooks.length === 0 && !showNewNotebook && (
                <p className="text-xs text-gray-400 dark:text-gray-600 px-2 py-1">No notebooks yet</p>
              )}

              {showNewNotebook ? (
                <NewNotebookForm
                  onCreated={handleNotebookCreated}
                  onCancel={() => setShowNewNotebook(false)}
                />
              ) : (
                <button
                  onClick={() => setShowNewNotebook(true)}
                  className="w-full text-left px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  + New Notebook
                </button>
              )}
            </div>
          )}
        </section>

        {/* Tags */}
        <section>
          <button
            onClick={() => setTagsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <span>Tags</span>
            <div className="flex items-center gap-1">
              <span
                onClick={(e) => { e.stopPropagation(); setShowNewTag((s) => !s); setTagsOpen(true) }}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-1"
                title="New tag"
              >+</span>
              <span>{tagsOpen ? '▾' : '▸'}</span>
            </div>
          </button>

          {tagsOpen && (
            <div className="mt-1 space-y-0.5">
              {tags.length === 0 && !showNewTag && (
                <p className="text-xs text-gray-400 dark:text-gray-600 px-2 py-1">No tags yet</p>
              )}
              {tags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  isActive={tagId === tag.id}
                  onClick={() => onNavigate({ tagId: tag.id, notebookId: null, view: 'all', noteId: null })}
                  onUpdated={handleTagUpdated}
                  onDeleted={(id) => {
                    setTags((prev) => prev.filter((t) => t.id !== id))
                    if (tagId === id) onNavigate({ tagId: null, view: 'all', noteId: null })
                  }}
                />
              ))}

              {showNewTag ? (
                <NewTagForm onCreated={handleTagCreated} onCancel={() => setShowNewTag(false)} />
              ) : (
                <button
                  onClick={() => setShowNewTag(true)}
                  className="w-full text-left px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  + New Tag
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}
