'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PlannerItem, CalendarEvent, CalendarFeed } from '@/lib/types'
import { NOTEBOOK_COLORS } from '@/lib/utils'

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dayIndex(d: Date): number {
  return d.getDay() === 0 ? 6 : d.getDay() - 1
}

// ─── Inline add form ────────────────────────────────────────────────────────

function InlineAddForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (text.trim()) onSubmit(text.trim())
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => { if (!text.trim()) onCancel() }}
      placeholder="Add..."
      className="w-full text-xs bg-transparent border-b border-indigo-400/50 dark:border-indigo-600/50 outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 pb-0.5 mt-0.5"
    />
  )
}

// ─── Calendar event row ─────────────────────────────────────────────────────

function CalendarEventRow({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5 ml-1">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: event.feedColor }}
      />
      <span className="flex-1 text-xs truncate text-gray-600 dark:text-gray-400">
        {event.title}
      </span>
      {event.startTime && (
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
          {event.startTime}
        </span>
      )}
    </div>
  )
}

// ─── Day row ────────────────────────────────────────────────────────────────

function DayRow({
  date,
  items,
  events,
  isToday,
  isPast,
  onAdd,
  onToggle,
  onDelete,
}: {
  date: Date
  items: PlannerItem[]
  events: CalendarEvent[]
  isToday: boolean
  isPast: boolean
  onAdd: (date: string, text: string) => void
  onToggle: (item: PlannerItem) => void
  onDelete: (item: PlannerItem) => void
}) {
  const [adding, setAdding] = useState(false)
  const dateStr = toDateStr(date)
  const dayName = DAY_NAMES_SHORT[dayIndex(date)]
  const dayNum = date.getDate()

  return (
    <div className={`px-3 py-1.5 ${
      isToday
        ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
        : isPast
          ? 'opacity-60'
          : ''
    }`}>
      {/* Day label */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`text-xs font-medium w-7 ${
          isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
        }`}>
          {dayName}
        </span>
        <span className={`text-xs font-semibold ${
          isToday
            ? 'bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]'
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {dayNum}
        </span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="ml-auto text-gray-300 dark:text-gray-600 hover:text-indigo-500 dark:hover:text-indigo-400 text-xs transition-colors"
          >
            +
          </button>
        )}
      </div>

      {/* Calendar events */}
      {events.map((event) => (
        <CalendarEventRow key={event.id} event={event} />
      ))}

      {/* Planner items */}
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1.5 py-0.5 group ml-1">
          <input
            type="checkbox"
            checked={item.isCompleted}
            onChange={() => onToggle(item)}
            className="flex-shrink-0 w-3 h-3 cursor-pointer accent-indigo-500 rounded"
          />
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className={`flex-1 text-xs truncate ${
            item.isCompleted
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-700 dark:text-gray-300'
          }`}>
            {item.text}
          </span>
          <button
            onClick={() => onDelete(item)}
            className="flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] leading-none"
            aria-label="Delete"
          >
            ×
          </button>
        </div>
      ))}

      {/* Add form */}
      {adding && (
        <div className="ml-1">
          <InlineAddForm
            onSubmit={(text) => { onAdd(dateStr, text); setAdding(false) }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Feed management panel ──────────────────────────────────────────────────

function FeedManager({ onClose }: { onClose: () => void }) {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/calendar-feeds')
      .then((r) => r.ok ? r.json() : [])
      .then(setFeeds)
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/calendar-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), url: newUrl.trim(), color: newColor }),
      })
      if (res.ok) {
        const feed: CalendarFeed = await res.json()
        setFeeds((prev) => [...prev, feed])
        setNewName('')
        setNewUrl('')
        setNewColor('#3b82f6')
        setShowAdd(false)
      }
    } finally { setSaving(false) }
  }

  async function handleToggle(feed: CalendarFeed) {
    const newEnabled = !feed.enabled
    setFeeds((prev) => prev.map((f) => f.id === feed.id ? { ...f, enabled: newEnabled } : f))
    await fetch(`/api/calendar-feeds/${feed.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newEnabled }),
    })
  }

  async function handleDelete(id: string) {
    setFeeds((prev) => prev.filter((f) => f.id !== id))
    await fetch(`/api/calendar-feeds/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Calendar Feeds</span>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Done</button>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400">Loading...</div>
      ) : (
        <>
          {feeds.length === 0 && !showAdd && (
            <p className="text-xs text-gray-400 dark:text-gray-500">No calendars added yet.</p>
          )}

          {feeds.map((feed) => (
            <div key={feed.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={feed.enabled}
                onChange={() => handleToggle(feed)}
                className="w-3 h-3 accent-indigo-500 rounded flex-shrink-0"
              />
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: feed.color }}
              />
              <span className={`flex-1 text-xs truncate ${feed.enabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                {feed.name}
              </span>
              <button
                onClick={() => handleDelete(feed.id)}
                className="text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
              >
                ×
              </button>
            </div>
          ))}

          {showAdd ? (
            <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Calendar name"
                className="w-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="ICS feed URL"
                className="w-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <div className="flex gap-1.5 flex-wrap">
                {NOTEBOOK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className="w-4 h-4 rounded-full border-2 transition-transform flex-shrink-0"
                    style={{
                      backgroundColor: c,
                      borderColor: newColor === c ? 'white' : 'transparent',
                      transform: newColor === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim() || !newUrl.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded py-1 transition-colors"
                >
                  {saving ? 'Adding...' : 'Add'}
                </button>
                <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              + Add calendar
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main PlannerPanel ──────────────────────────────────────────────────────

interface PlannerPanelProps {
  onNavigateToPlanner: () => void
}

export default function PlannerPanel({ onNavigateToPlanner }: PlannerPanelProps) {
  const [items, setItems] = useState<PlannerItem[]>([])
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showFeeds, setShowFeeds] = useState(false)

  const now = new Date()
  const today = toDateStr(now)
  const monday = getMonday(now)
  const rangeFrom = toDateStr(monday)
  const rangeTo = toDateStr(addDays(monday, 13))

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [plannerRes, eventsRes] = await Promise.all([
        fetch(`/api/planner?from=${rangeFrom}&to=${rangeTo}`),
        fetch(`/api/calendar-events?from=${rangeFrom}&to=${rangeTo}`),
      ])
      if (plannerRes.ok) setItems(await plannerRes.json())
      if (eventsRes.ok) setCalEvents(await eventsRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [rangeFrom, rangeTo])

  useEffect(() => { loadData() }, [loadData])

  // Reload events when feed manager closes
  function handleFeedsClose() {
    setShowFeeds(false)
    fetch(`/api/calendar-events?from=${rangeFrom}&to=${rangeTo}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setCalEvents)
  }

  async function handleAdd(date: string, text: string) {
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, date, color: '#6366f1' }),
      })
      if (res.ok) {
        const item: PlannerItem = await res.json()
        setItems((prev) => [...prev, item])
      }
    } catch { /* ignore */ }
  }

  async function handleToggle(item: PlannerItem) {
    const newCompleted = !item.isCompleted
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isCompleted: newCompleted } : i))
    )
    try {
      await fetch(`/api/planner/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: newCompleted }),
      })
    } catch { /* ignore */ }
  }

  async function handleDelete(item: PlannerItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    try {
      await fetch(`/api/planner/${item.id}`, { method: 'DELETE' })
    } catch { /* ignore */ }
  }

  const itemsByDate = new Map<string, PlannerItem[]>()
  for (const item of items) {
    const existing = itemsByDate.get(item.date) ?? []
    existing.push(item)
    itemsByDate.set(item.date, existing)
  }

  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const event of calEvents) {
    const existing = eventsByDate.get(event.date) ?? []
    existing.push(event)
    eventsByDate.set(event.date, existing)
  }

  const week1Days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const week2Days = Array.from({ length: 7 }, (_, i) => addDays(monday, 7 + i))

  const week1End = addDays(monday, 6)
  const week2Start = addDays(monday, 7)
  const week2End = addDays(monday, 13)
  const fmtOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 flex items-center justify-between flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">Planner</span>
          <button
            onClick={() => setShowFeeds((o) => !o)}
            title="Manage calendar feeds"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xs"
          >
            ⚙
          </button>
        </div>
        <button
          onClick={onNavigateToPlanner}
          className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
        >
          Full view →
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {showFeeds ? (
          <FeedManager onClose={handleFeedsClose} />
        ) : loading ? (
          <div className="p-3 space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 bg-gray-200 dark:bg-gray-800 rounded" />
            ))}
          </div>
        ) : (
          <>
            {/* This Week */}
            <div className="pt-2 pb-1">
              <div className="px-3 pb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  This Week
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-600">
                  {monday.toLocaleDateString('en-US', fmtOpts)} – {week1End.toLocaleDateString('en-US', fmtOpts)}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {week1Days.map((day) => {
                  const dateStr = toDateStr(day)
                  return (
                    <DayRow
                      key={dateStr}
                      date={day}
                      items={itemsByDate.get(dateStr) ?? []}
                      events={eventsByDate.get(dateStr) ?? []}
                      isToday={dateStr === today}
                      isPast={dateStr < today}
                      onAdd={handleAdd}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  )
                })}
              </div>
            </div>

            {/* Next Week */}
            <div className="pt-2 pb-1 border-t border-gray-200 dark:border-gray-700">
              <div className="px-3 pb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Next Week
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-600">
                  {week2Start.toLocaleDateString('en-US', fmtOpts)} – {week2End.toLocaleDateString('en-US', fmtOpts)}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {week2Days.map((day) => {
                  const dateStr = toDateStr(day)
                  return (
                    <DayRow
                      key={dateStr}
                      date={day}
                      items={itemsByDate.get(dateStr) ?? []}
                      events={eventsByDate.get(dateStr) ?? []}
                      isToday={dateStr === today}
                      isPast={dateStr < today}
                      onAdd={handleAdd}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
