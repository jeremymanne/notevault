export interface Tag {
  id: string
  name: string
  color: string
  _count?: { notes: number }
}

export interface NoteTag {
  noteId: string
  tagId: string
  tag: Tag
}

export interface Notebook {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  _count?: { notes: number }
}

export interface Note {
  id: string
  title: string
  content: string
  isPinned: boolean
  isArchived: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  notebookId: string | null
  notebook?: Notebook | null
  tags: NoteTag[]
}

export interface PlannerItem {
  id: string
  text: string
  date: string
  isCompleted: boolean
  color: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CalendarFeed {
  id: string
  name: string
  url: string
  color: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  allDay: boolean
  feedName: string
  feedColor: string
}
