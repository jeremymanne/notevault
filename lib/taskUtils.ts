// ─── TipTap JSON types ────────────────────────────────────────────────────────

export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export interface TiptapDoc {
  type: 'doc'
  content: TiptapNode[]
}

// ─── Extracted task type ──────────────────────────────────────────────────────

export interface ExtractedTask {
  type: 'task'
  /** Unique drag ID: `${noteId}__${taskListIndex}__${taskItemIndex}` */
  id: string
  noteId: string
  noteTitle: string
  notebookName?: string
  text: string
  checked: boolean
  taskListIndex: number
  taskItemIndex: number
  /** Raw taskItem node — used for copy operations */
  node: TiptapNode
}

export interface ExtractedHeading {
  type: 'heading'
  /** `${noteId}__h__${nodeIndex}` */
  id: string
  noteId: string
  noteTitle: string
  notebookName?: string
  text: string
  level: number
  nodeIndex: number
}

export type NoteGroupItem = ExtractedTask | ExtractedHeading

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getTextFromNode(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (Array.isArray(node.content)) return node.content.map(getTextFromNode).join('')
  return ''
}

function parseDoc(content: string): TiptapDoc | null {
  if (!content) return null
  try {
    const doc = JSON.parse(content)
    if (doc?.type === 'doc' && Array.isArray(doc.content)) return doc as TiptapDoc
    return null
  } catch {
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all task list items from a note's TipTap JSON content.
 * Unchanged — still used by Sidebar for badge counts.
 */
export function extractTasksFromContent(
  content: string,
  noteId: string,
  noteTitle: string,
  notebookName?: string
): ExtractedTask[] {
  const doc = parseDoc(content)
  if (!doc) return []

  const tasks: ExtractedTask[] = []

  doc.content.forEach((node, taskListIndex) => {
    if (node.type !== 'taskList' || !Array.isArray(node.content)) return

    node.content.forEach((item, taskItemIndex) => {
      if (item.type !== 'taskItem') return

      tasks.push({
        type: 'task',
        id: `${noteId}__${taskListIndex}__${taskItemIndex}`,
        noteId,
        noteTitle,
        notebookName,
        text: getTextFromNode(item),
        checked: (item.attrs?.checked as boolean) ?? false,
        taskListIndex,
        taskItemIndex,
        node: item,
      })
    })
  })

  return tasks
}

/**
 * Extract all tasks and headings from a note's TipTap JSON content, in document order.
 */
export function extractItemsFromContent(
  content: string,
  noteId: string,
  noteTitle: string,
  notebookName?: string
): NoteGroupItem[] {
  const doc = parseDoc(content)
  if (!doc) return []

  const items: NoteGroupItem[] = []

  doc.content.forEach((node, nodeIndex) => {
    if (node.type === 'taskList' && Array.isArray(node.content)) {
      let taskItemIndex = 0
      node.content.forEach((item) => {
        if (item.type !== 'taskItem') return
        items.push({
          type: 'task',
          id: `${noteId}__${nodeIndex}__${taskItemIndex}`,
          noteId,
          noteTitle,
          notebookName,
          text: getTextFromNode(item),
          checked: (item.attrs?.checked as boolean) ?? false,
          taskListIndex: nodeIndex,
          taskItemIndex,
          node: item,
        })
        taskItemIndex++
      })
    } else if (node.type === 'heading') {
      items.push({
        type: 'heading',
        id: `${noteId}__h__${nodeIndex}`,
        noteId,
        noteTitle,
        notebookName,
        text: getTextFromNode(node),
        level: (node.attrs?.level as number) ?? 2,
        nodeIndex,
      })
    }
  })

  return items
}

/**
 * Toggle a specific task item's checked state and return the updated JSON string.
 */
export function toggleTaskInContent(
  content: string,
  taskListIndex: number,
  taskItemIndex: number,
  checked: boolean
): string {
  const doc = parseDoc(content)
  if (!doc) return content

  const taskList = doc.content[taskListIndex]
  if (!taskList?.content?.[taskItemIndex]) return content

  taskList.content[taskItemIndex] = {
    ...taskList.content[taskItemIndex],
    attrs: {
      ...taskList.content[taskItemIndex].attrs,
      checked,
    },
  }

  return JSON.stringify(doc)
}

/**
 * Reorder task items within a specific taskList node and return updated JSON string.
 */
export function reorderTasksInContent(
  content: string,
  taskListIndex: number,
  fromIndex: number,
  toIndex: number
): string {
  const doc = parseDoc(content)
  if (!doc) return content

  const taskList = doc.content[taskListIndex]
  if (!taskList?.content) return content

  const items = [...taskList.content]
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved)
  taskList.content = items

  return JSON.stringify(doc)
}

/**
 * Copy a task node (appended, unchecked) into the target content's last taskList.
 * Creates a new taskList at the end if none exists.
 */
export function copyTaskToContent(targetContent: string, taskNode: TiptapNode): string {
  const doc = parseDoc(targetContent) ?? ({ type: 'doc', content: [] } as TiptapDoc)

  const copiedNode: TiptapNode = {
    ...taskNode,
    attrs: { ...taskNode.attrs, checked: false },
  }

  let lastTaskListIndex = -1
  doc.content.forEach((node, i) => {
    if (node.type === 'taskList') lastTaskListIndex = i
  })

  if (lastTaskListIndex === -1) {
    doc.content.push({ type: 'taskList', content: [copiedNode] })
  } else {
    const taskList = doc.content[lastTaskListIndex]
    if (!taskList.content) taskList.content = []
    taskList.content.push(copiedNode)
  }

  return JSON.stringify(doc)
}

/**
 * Append a new unchecked taskItem to the last taskList, or create a new taskList at the end.
 */
export function addTaskToContent(content: string, text: string): string {
  const doc = parseDoc(content) ?? ({ type: 'doc', content: [] } as TiptapDoc)

  const newItem: TiptapNode = {
    type: 'taskItem',
    attrs: { checked: false },
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }

  let lastTaskListIndex = -1
  doc.content.forEach((node, i) => {
    if (node.type === 'taskList') lastTaskListIndex = i
  })

  if (lastTaskListIndex === -1) {
    doc.content.push({ type: 'taskList', content: [newItem] })
  } else {
    const taskList = doc.content[lastTaskListIndex]
    if (!taskList.content) taskList.content = []
    taskList.content.push(newItem)
  }

  return JSON.stringify(doc)
}

/**
 * Append a heading node to the end of doc.content.
 */
export function addHeadingToContent(content: string, text: string, level = 2): string {
  const doc = parseDoc(content) ?? ({ type: 'doc', content: [] } as TiptapDoc)

  doc.content.push({
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  })

  return JSON.stringify(doc)
}

/**
 * Delete a specific task item from a taskList and return the updated JSON string.
 */
export function deleteTaskFromContent(
  content: string,
  taskListIndex: number,
  taskItemIndex: number
): string {
  const doc = parseDoc(content)
  if (!doc) return content

  const taskList = doc.content[taskListIndex]
  if (!taskList?.content) return content

  taskList.content = taskList.content.filter((_, i) => i !== taskItemIndex)

  return JSON.stringify(doc)
}

/**
 * Parse the noteId out of a task drag ID (`noteId__taskListIndex__taskItemIndex`).
 */
export function noteIdFromTaskId(taskId: string): string {
  return taskId.split('__')[0]
}
