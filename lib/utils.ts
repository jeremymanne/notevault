import type React from 'react'

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function extractTextPreview(content: string, maxChars = 120): string {
  if (!content) return ''

  // Try TipTap JSON
  try {
    const doc = JSON.parse(content)
    if (doc.type === 'doc' && Array.isArray(doc.content)) {
      return extractTextFromNodes(doc.content).slice(0, maxChars)
    }
  } catch {
    // fall through
  }

  // Strip HTML tags
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromNodes(nodes: any[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text ?? ''
      if (Array.isArray(node.content)) return extractTextFromNodes(node.content)
      return ''
    })
    .join('')
}

export const NOTEBOOK_COLORS = [
  '#6366f1',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#3b82f6',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#84cc16',
]

export const TAG_COLOR_CLASSES = [
  'bg-indigo-500/20 text-indigo-400',
  'bg-pink-500/20 text-pink-400',
  'bg-emerald-500/20 text-emerald-400',
  'bg-amber-500/20 text-amber-400',
  'bg-sky-500/20 text-sky-400',
  'bg-purple-500/20 text-purple-400',
  'bg-rose-500/20 text-rose-400',
  'bg-teal-500/20 text-teal-400',
]

export function tagColorClass(tagName: string): string {
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLOR_CLASSES[Math.abs(hash) % TAG_COLOR_CLASSES.length]
}

export function tagStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color + '33',
    color: color,
  }
}
