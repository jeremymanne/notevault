'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import Sidebar from './Sidebar'
import NoteList from './NoteList'
import Editor from './Editor'
import TaskView from './TaskView'
import PlannerView from './PlannerView'

type MobilePanel = 'sidebar' | 'list' | 'editor'

export default function AppShell() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('list')
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [noteListRefreshKey, setNoteListRefreshKey] = useState(0)

  const view = searchParams.get('view') ?? 'all'
  const notebookId = searchParams.get('notebookId') ?? null
  const tagId = searchParams.get('tagId') ?? null
  const noteId = searchParams.get('noteId') ?? null

  const navigate = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [searchParams, router]
  )

  function refreshSidebar() {
    setSidebarRefreshKey((k) => k + 1)
  }

  function refreshNoteList() {
    setNoteListRefreshKey((k) => k + 1)
  }

  const isTasksView = view === 'tasks'
  const isPlannerView = view === 'planner'
  const isFullWidthView = isTasksView || isPlannerView
  const divider = 'border-gray-200 dark:border-gray-700'

  return (
    <div className="flex h-dvh overflow-hidden bg-white dark:bg-gray-950">
      {/* Sidebar — 240px */}
      <div className={`w-60 flex-shrink-0 ${mobilePanel === 'sidebar' ? 'flex' : 'hidden'} md:flex`}>
        <Sidebar
          view={view}
          notebookId={notebookId}
          tagId={tagId}
          refreshKey={sidebarRefreshKey}
          onNavigate={(updates) => {
            navigate(updates)
            setMobilePanel('list')
          }}
        />
      </div>

      {/* Note List — 320px */}
      {!isFullWidthView && (
        <div className={`w-80 flex-shrink-0 ${mobilePanel === 'list' ? 'flex' : 'hidden'} md:flex border-l ${divider}`}>
          <NoteList
            view={view}
            notebookId={notebookId}
            tagId={tagId}
            selectedNoteId={noteId}
            refreshKey={noteListRefreshKey}
            onSelectNote={(id) => {
              navigate({ noteId: id })
              setMobilePanel('editor')
            }}
            onMobileSidebar={() => setMobilePanel('sidebar')}
            onNotesChanged={refreshSidebar}
          />
        </div>
      )}

      {/* Editor — flex-1 */}
      {!isFullWidthView && (
        <div className={`flex-1 min-w-0 ${mobilePanel === 'editor' ? 'flex' : 'hidden'} md:flex border-l ${divider}`}>
          <Editor
            noteId={noteId}
            onMobileBack={() => setMobilePanel('list')}
            onNoteDeleted={() => {
              navigate({ noteId: null })
              setMobilePanel('list')
              refreshSidebar()
              refreshNoteList()
            }}
            onNoteArchived={() => {
              navigate({ noteId: null })
              setMobilePanel('list')
              refreshSidebar()
              refreshNoteList()
            }}
            onNoteChanged={refreshSidebar}
            onNotePinChanged={refreshNoteList}
          />
        </div>
      )}

      {/* Tasks View */}
      {isTasksView && (
        <div className={`flex-1 min-w-0 border-l ${divider} flex overflow-hidden`}>
          <TaskView onNavigate={navigate} />
        </div>
      )}

      {/* Planner View */}
      {isPlannerView && (
        <div className={`flex-1 min-w-0 border-l ${divider} flex overflow-hidden`}>
          <PlannerView />
        </div>
      )}
    </div>
  )
}
