export interface Tag {
  id: string
  name: string
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
  sortOrder: number
  createdAt: string
  updatedAt: string
  notebookId: string | null
  notebook?: Notebook | null
  tags: NoteTag[]
}
