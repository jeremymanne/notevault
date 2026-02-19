'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import type { Note, Notebook } from '@/lib/types'
import { tagColorClass } from '@/lib/utils'

interface EditorProps {
  noteId: string | null
  onMobileBack: () => void
  onNoteDeleted: () => void
  onNoteChanged: () => void
  onNotePinChanged: () => void
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`px-2 py-1 rounded text-sm transition-colors ${
        active
          ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-700 dark:text-white'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 flex-shrink-0" />
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')

  function addTag() {
    const trimmed = input.trim().toLowerCase()
    if (!trimmed || tags.includes(trimmed)) { setInput(''); return }
    onChange([...tags, trimmed])
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    else if (e.key === 'Backspace' && !input) onChange(tags.slice(0, -1))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${tagColorClass(tag)}`}>
          {tag}
          <button onClick={() => onChange(tags.filter((t) => t !== tag))} className="opacity-60 hover:opacity-100 leading-none">×</button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={tags.length === 0 ? 'Add tags…' : ''}
        className="bg-transparent text-xs text-gray-500 dark:text-gray-400 outline-none placeholder-gray-300 dark:placeholder-gray-600 min-w-16 max-w-32"
      />
    </div>
  )
}

// ─── Note editor (re-mounts on noteId change via key prop) ────────────────────

function NoteEditor({
  note, onNoteDeleted, onNoteChanged, onNotePinChanged, onMobileBack,
}: {
  note: Note; onNoteDeleted: () => void; onNoteChanged: () => void; onNotePinChanged: () => void; onMobileBack: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [notebookId, setNotebookId] = useState<string | null>(note.notebookId)
  const [tagNames, setTagNames] = useState<string[]>(note.tags.map((nt) => nt.tag.name))
  const [isPinned, setIsPinned] = useState(note.isPinned)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const titleRef = useRef(title)
  const notebookIdRef = useRef(notebookId)
  const tagNamesRef = useRef(tagNames)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { notebookIdRef.current = notebookId }, [notebookId])
  useEffect(() => { tagNamesRef.current = tagNames }, [tagNames])

  useEffect(() => {
    fetch('/api/notebooks').then((r) => r.ok ? r.json() : []).then(setNotebooks)
  }, [])

  function parseContent(raw: string) {
    if (!raw) return ''
    try { return JSON.parse(raw) } catch { return raw }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline, TaskList, TaskItem.configure({ nested: true })],
    content: parseContent(note.content),
    editorProps: {
      attributes: { class: 'tiptap px-8 py-6 focus:outline-none min-h-full' },
    },
    onUpdate: () => scheduleSave(),
  })

  const doSave = useCallback(async () => {
    await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titleRef.current,
        content: JSON.stringify(editor?.getJSON()),
        notebookId: notebookIdRef.current,
        tags: tagNamesRef.current,
      }),
    })
    onNoteChanged()
  }, [editor, note.id, onNoteChanged])

  const scheduleSave = useCallback(() => {
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (savedIndicatorTimer.current) clearTimeout(savedIndicatorTimer.current)
    saveTimer.current = setTimeout(async () => {
      await doSave()
      setSaveStatus('saved')
      savedIndicatorTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
    }, 1000)
  }, [doSave])

  function handleTitleChange(val: string) { setTitle(val); scheduleSave() }
  function handleNotebookChange(val: string | null) { setNotebookId(val); scheduleSave() }
  function handleTagsChange(val: string[]) { setTagNames(val); scheduleSave() }

  async function togglePin() {
    const next = !isPinned
    setIsPinned(next)
    await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned: next }),
    })
    onNoteChanged()
    onNotePinChanged()
  }

  async function handleDelete() {
    await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
    onNoteDeleted()
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (savedIndicatorTimer.current) clearTimeout(savedIndicatorTimer.current)
    }
  }, [])

  if (!editor) return null

  return (
    <div className="flex-1 bg-white dark:bg-gray-950 flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 gap-2">
        <button onClick={onMobileBack} className="md:hidden text-gray-400 hover:text-gray-700 dark:hover:text-white flex-shrink-0">‹</button>

        {/* Save status */}
        <span className={`text-xs transition-opacity duration-300 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${saveStatus === 'saved' ? 'text-green-500 dark:text-green-400' : 'text-gray-400'}`}>
          {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={togglePin}
            title={isPinned ? 'Unpin' : 'Pin'}
            className={`px-2 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
              isPinned
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400'
            }`}
          >
            📌
            {isPinned && <span className="text-xs font-medium">Pinned</span>}
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Delete?</span>
              <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded border border-red-300 dark:border-red-500/30">
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete note"
              className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-gray-800"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-8 pt-6 pb-2 flex-shrink-0">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full bg-transparent text-gray-900 dark:text-white text-2xl font-bold outline-none placeholder-gray-300 dark:placeholder-gray-700 leading-tight"
        />
      </div>

      {/* Meta row */}
      <div className="px-8 pb-3 flex-shrink-0 flex items-center gap-4 flex-wrap">
        <select
          value={notebookId ?? ''}
          onChange={(e) => handleNotebookChange(e.target.value || null)}
          className="bg-transparent text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 outline-none cursor-pointer"
        >
          <option value="">No notebook</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>{nb.name}</option>
          ))}
        </select>
        <TagInput tags={tagNames} onChange={handleTagsChange} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-t border-b border-gray-100 dark:border-gray-700/50 flex-shrink-0 flex-wrap bg-gray-50/50 dark:bg-transparent">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><strong>B</strong></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><span className="underline">U</span></ToolbarBtn>
        <ToolbarDivider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarBtn>
        <ToolbarDivider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">•—</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">1.</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task List">☑</ToolbarBtn>
        <ToolbarDivider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">{'</>'}</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">"</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal Rule">―</ToolbarBtn>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}

// ─── Outer wrapper ────────────────────────────────────────────────────────────

export default function Editor({ noteId, onMobileBack, onNoteDeleted, onNoteChanged, onNotePinChanged }: EditorProps) {
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!noteId) { setNote(null); setLoading(false); setNotFound(false); return }
    const controller = new AbortController()
    setLoading(true); setNotFound(false)
    fetch(`/api/notes/${noteId}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) { setNotFound(true); setLoading(false); return } return r.json() })
      .then((data) => { if (data) { setNote(data); setLoading(false) } })
      .catch(() => {})
    return () => controller.abort()
  }, [noteId])

  if (!noteId) {
    return (
      <div className="flex-1 bg-white dark:bg-gray-950 flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">Select a note or create a new one</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 bg-white dark:bg-gray-950 flex flex-col h-full p-8 animate-pulse">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mb-4" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-5/6 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
      </div>
    )
  }

  if (notFound || !note) {
    return (
      <div className="flex-1 bg-white dark:bg-gray-950 flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Note not found.</p>
      </div>
    )
  }

  return (
    <NoteEditor key={noteId} note={note} onNoteDeleted={onNoteDeleted} onNoteChanged={onNoteChanged} onNotePinChanged={onNotePinChanged} onMobileBack={onMobileBack} />
  )
}
