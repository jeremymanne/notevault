'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import type { Note } from '@/lib/types'
import { formatRelativeTime, extractTextPreview, tagStyle } from '@/lib/utils'

interface NoteListProps {
  view: string
  notebookId: string | null
  tagId: string | null
  selectedNoteId: string | null
  refreshKey: number
  onSelectNote: (id: string) => void
  onMobileSidebar: () => void
  onNotesChanged: () => void
}

// ─── Note card ────────────────────────────────────────────────────────────────

function SortableNoteCard({
  note,
  isSelected,
  onClick,
}: {
  note: Note
  isSelected: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id })

  const preview = extractTextPreview(note.content)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={onClick}
      className={`flex items-stretch group border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-indigo-50 dark:bg-gray-700/60'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
      } ${note.isPinned ? 'border-l-2 border-amber-400' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="w-5 flex-shrink-0 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-20 group-hover:opacity-100 transition-opacity text-xs"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>

      {/* Content */}
      <div className="flex-1 px-3 py-3 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">
            {note.title || 'Untitled'}
          </span>
          {note.isPinned && (
            <span className="flex items-center gap-0.5 text-xs text-amber-500 font-medium flex-shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
              📌 Pinned
            </span>
          )}
        </div>

        {preview && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1.5 leading-relaxed">
            {preview}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1">
            {note.notebook && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={tagStyle(note.notebook.color)}
              >
                {note.notebook.name}
              </span>
            )}
            {note.tags.slice(0, 3).map((nt) => (
              <span
                key={nt.tagId}
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={tagStyle(nt.tag.color ?? '#6366f1')}
              >
                {nt.tag.name}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">+{note.tags.length - 3}</span>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {formatRelativeTime(note.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function NoteCardSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 animate-pulse">
      <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full mb-1" />
      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
    </div>
  )
}

// ─── Group label ──────────────────────────────────────────────────────────────

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700/50">
      {children}
    </div>
  )
}

// ─── Main NoteList ────────────────────────────────────────────────────────────

export default function NoteList({
  view,
  notebookId,
  tagId,
  selectedNoteId,
  refreshKey,
  onSelectNote,
  onMobileSidebar,
  onNotesChanged,
}: NoteListProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [creating, setCreating] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams()
    if (notebookId) params.set('notebookId', notebookId)
    if (tagId) params.set('tagId', tagId)
    if (view === 'pinned') params.set('pinned', 'true')
    if (view === 'archive') params.set('archive', 'true')
    if (debouncedSearch) params.set('search', debouncedSearch)
    try {
      const res = await fetch(`/api/notes?${params}`)
      if (!res.ok) { setError(true); return }
      setNotes(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [view, notebookId, tagId, debouncedSearch, refreshKey])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  async function createNote() {
    setCreating(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled', notebookId: notebookId ?? null }),
      })
      if (res.ok) {
        const note = await res.json()
        setNotes((prev) => [note, ...prev])
        onSelectNote(note.id)
        onNotesChanged()
      }
    } finally {
      setCreating(false)
    }
  }

  const pinnedNotes = notes.filter((n) => n.isPinned)
  const unpinnedNotes = notes.filter((n) => !n.isPinned)

  async function persistReorder(reordered: Note[]) {
    await fetch('/api/notes/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((n) => n.id) }),
    })
  }

  function handlePinnedDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const reordered = arrayMove(
      pinnedNotes,
      pinnedNotes.findIndex((n) => n.id === active.id),
      pinnedNotes.findIndex((n) => n.id === over.id)
    )
    const next = [...reordered, ...unpinnedNotes]
    setNotes(next)
    persistReorder(next)
  }

  function handleUnpinnedDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const reordered = arrayMove(
      unpinnedNotes,
      unpinnedNotes.findIndex((n) => n.id === active.id),
      unpinnedNotes.findIndex((n) => n.id === over.id)
    )
    const next = [...pinnedNotes, ...reordered]
    setNotes(next)
    persistReorder(next)
  }

  function viewTitle() {
    if (view === 'pinned') return 'Pinned'
    if (view === 'archive') return 'Archive'
    if (tagId) return 'Tagged'
    if (notebookId) return ''
    return 'Open Notes'
  }

  return (
    <div className="w-full bg-gray-50 dark:bg-gray-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-2 gap-2">
          <button
            onClick={onMobileSidebar}
            className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-white flex-shrink-0"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-800 dark:text-white truncate flex-1">{viewTitle()}</span>
          {view !== 'archive' && (
            <button
              onClick={createNote}
              disabled={creating}
              className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors"
            >
              {creating ? '…' : '+ New'}
            </button>
          )}
        </div>
        <input
          type="text"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-transparent"
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div>
            {[...Array(5)].map((_, i) => <NoteCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 px-4 text-center">
            <p className="text-red-500 dark:text-red-400 text-sm">Failed to load notes.</p>
            <button onClick={fetchNotes} className="text-indigo-500 text-sm underline">
              Try again
            </button>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 px-4 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              {debouncedSearch ? 'No notes match your search.' : 'No notes here yet.'}
            </p>
            {!debouncedSearch && (
              <button onClick={createNote} className="text-indigo-500 hover:text-indigo-400 text-sm underline">
                Create your first note
              </button>
            )}
          </div>
        ) : (
          <>
            {pinnedNotes.length > 0 && (
              <div>
                <GroupLabel>Pinned</GroupLabel>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePinnedDragEnd}>
                  <SortableContext items={pinnedNotes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                    {pinnedNotes.map((note) => (
                      <SortableNoteCard key={note.id} note={note} isSelected={note.id === selectedNoteId} onClick={() => onSelectNote(note.id)} />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {unpinnedNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && <GroupLabel>Notes</GroupLabel>}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleUnpinnedDragEnd}>
                  <SortableContext items={unpinnedNotes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                    {unpinnedNotes.map((note) => (
                      <SortableNoteCard key={note.id} note={note} isSelected={note.id === selectedNoteId} onClick={() => onSelectNote(note.id)} />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
