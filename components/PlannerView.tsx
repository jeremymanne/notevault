'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PlannerItem, CalendarEvent } from '@/lib/types'
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

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Color picker (mini) ────────────────────────────────────────────────────

function MiniColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
        style={{ backgroundColor: value }}
        title="Change color"
      />
      {open && (
        <div className="absolute top-6 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 flex gap-1.5 flex-wrap w-36">
          {NOTEBOOK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false) }}
              className="w-5 h-5 rounded-full border-2 transition-transform flex-shrink-0"
              style={{
                backgroundColor: c,
                borderColor: value === c ? 'white' : 'transparent',
                transform: value === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add item form ──────────────────────────────────────────────────────────

function AddItemForm({
  date,
  onSubmit,
  onCancel,
}: {
  date: string
  onSubmit: (text: string, color: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [color, setColor] = useState('#6366f1')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (text.trim()) onSubmit(text.trim(), color)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <MiniColorPicker value={color} onChange={setColor} />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (!text.trim()) onCancel() }}
        placeholder="Add item..."
        className="flex-1 text-xs bg-transparent border-b border-indigo-400 dark:border-indigo-600 outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 pb-0.5"
      />
      <button
        onClick={() => { if (text.trim()) onSubmit(text.trim(), color) }}
        className="text-xs text-indigo-500 hover:text-indigo-400 font-medium"
      >
        Add
      </button>
    </div>
  )
}

// ─── Single planner item row ────────────────────────────────────────────────

function PlannerItemRow({
  item,
  onToggle,
  onDelete,
  onUpdate,
}: {
  item: PlannerItem
  onToggle: () => void
  onDelete: () => void
  onUpdate: (updates: Partial<PlannerItem>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function handleSave() {
    if (editText.trim() && editText.trim() !== item.text) {
      onUpdate({ text: editText.trim() })
    }
    setEditing(false)
  }

  return (
    <div className="flex items-start gap-1.5 group py-0.5">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
        style={{ backgroundColor: item.color }}
      />
      <input
        type="checkbox"
        checked={item.isCompleted}
        onChange={onToggle}
        className="flex-shrink-0 w-3.5 h-3.5 cursor-pointer accent-indigo-500 rounded mt-0.5"
      />
      {editing ? (
        <input
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') { setEditText(item.text); setEditing(false) }
          }}
          onBlur={handleSave}
          className="flex-1 text-xs bg-transparent border-b border-indigo-400 outline-none text-gray-800 dark:text-gray-200 min-w-0"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-xs cursor-text min-w-0 break-words ${
            item.isCompleted
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {item.text}
        </span>
      )}
      <button
        onClick={onDelete}
        className="flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none mt-0.5"
        aria-label="Delete"
      >
        ×
      </button>
    </div>
  )
}

// ─── Day column ─────────────────────────────────────────────────────────────

function DayColumn({
  date,
  items,
  events,
  isToday,
  isPast,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
}: {
  date: Date
  items: PlannerItem[]
  events: CalendarEvent[]
  isToday: boolean
  isPast: boolean
  onAdd: (date: string, text: string, color: string) => void
  onToggle: (item: PlannerItem) => void
  onDelete: (item: PlannerItem) => void
  onUpdate: (item: PlannerItem, updates: Partial<PlannerItem>) => void
}) {
  const [adding, setAdding] = useState(false)
  const dateStr = toDateStr(date)
  const dayName = DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]
  const dayNum = date.getDate()

  const incomplete = items.filter((i) => !i.isCompleted).length
  const total = items.length

  return (
    <div
      className={`flex flex-col rounded-lg border transition-colors min-h-[140px] ${
        isToday
          ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
          : isPast
            ? 'border-gray-200 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30 opacity-75'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
      }`}
    >
      {/* Day header */}
      <div className={`px-2.5 py-1.5 border-b flex items-center justify-between ${
        isToday
          ? 'border-indigo-200 dark:border-indigo-800'
          : 'border-gray-100 dark:border-gray-700/50'
      }`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${
            isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {dayName}
          </span>
          <span className={`text-sm font-semibold ${
            isToday
              ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs'
              : 'text-gray-800 dark:text-gray-200'
          }`}>
            {dayNum}
          </span>
        </div>
        {total > 0 && (
          <span className={`text-xs ${
            incomplete > 0
              ? 'text-indigo-500 dark:text-indigo-400 font-medium'
              : 'text-green-500 dark:text-green-400'
          }`}>
            {incomplete > 0 ? `${incomplete} left` : 'done'}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="px-2 py-1.5 flex-1 space-y-0.5">
        {/* Calendar events */}
        {events.map((event) => (
          <div key={event.id} className="flex items-center gap-1.5 py-0.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
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
        ))}

        {/* Planner items */}
        {items.map((item) => (
          <PlannerItemRow
            key={item.id}
            item={item}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(item)}
            onUpdate={(updates) => onUpdate(item, updates)}
          />
        ))}

        {adding ? (
          <AddItemForm
            date={dateStr}
            onSubmit={(text, color) => {
              onAdd(dateStr, text, color)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-left text-xs text-gray-400 dark:text-gray-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors py-0.5"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Week row ───────────────────────────────────────────────────────────────

function WeekRow({
  weekStart,
  items,
  events,
  today,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  label,
}: {
  weekStart: Date
  items: PlannerItem[]
  events: CalendarEvent[]
  today: string
  onAdd: (date: string, text: string, color: string) => void
  onToggle: (item: PlannerItem) => void
  onDelete: (item: PlannerItem) => void
  onUpdate: (item: PlannerItem, updates: Partial<PlannerItem>) => void
  label: string
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const itemsByDate = new Map<string, PlannerItem[]>()
  for (const item of items) {
    const existing = itemsByDate.get(item.date) ?? []
    existing.push(item)
    itemsByDate.set(item.date, existing)
  }

  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const existing = eventsByDate.get(event.date) ?? []
    existing.push(event)
    eventsByDate.set(event.date, existing)
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {label}
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatWeekRange(weekStart)}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateStr = toDateStr(day)
          return (
            <DayColumn
              key={dateStr}
              date={day}
              items={itemsByDate.get(dateStr) ?? []}
              events={eventsByDate.get(dateStr) ?? []}
              isToday={dateStr === today}
              isPast={dateStr < today}
              onAdd={onAdd}
              onToggle={onToggle}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function PlannerSkeleton() {
  return (
    <div className="mb-6 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-3" />
      <div className="grid grid-cols-7 gap-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ─── Main PlannerView ───────────────────────────────────────────────────────

export default function PlannerView() {
  const [items, setItems] = useState<PlannerItem[]>([])
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const now = new Date()
  const today = toDateStr(now)
  const baseMonday = getMonday(now)
  const week1Start = addDays(baseMonday, weekOffset * 7)
  const week2Start = addDays(week1Start, 7)
  const rangeFrom = toDateStr(week1Start)
  const rangeTo = toDateStr(addDays(week2Start, 6))

  const isCurrentWeeks = weekOffset === 0

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [plannerRes, eventsRes] = await Promise.all([
        fetch(`/api/planner?from=${rangeFrom}&to=${rangeTo}`),
        fetch(`/api/calendar-events?from=${rangeFrom}&to=${rangeTo}`),
      ])
      if (!plannerRes.ok) { setError(true); return }
      setItems(await plannerRes.json())
      if (eventsRes.ok) setCalEvents(await eventsRes.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [rangeFrom, rangeTo])

  useEffect(() => { loadItems() }, [loadItems])

  async function handleAdd(date: string, text: string, color: string) {
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, date, color }),
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

  async function handleUpdate(item: PlannerItem, updates: Partial<PlannerItem>) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, ...updates } : i))
    )
    try {
      await fetch(`/api/planner/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    } catch { /* ignore */ }
  }

  const w2StartStr = toDateStr(week2Start)
  const week1Items = items.filter((i) => i.date < w2StartStr)
  const week2Items = items.filter((i) => i.date >= w2StartStr)
  const week1Events = calEvents.filter((e) => e.date < w2StartStr)
  const week2Events = calEvents.filter((e) => e.date >= w2StartStr)

  const totalIncomplete = items.filter((i) => !i.isCompleted).length

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-gray-900 dark:text-white font-semibold text-base">Weekly Planner</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((o) => o - 2)}
              className="px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="Previous 2 weeks"
            >
              ‹
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              disabled={isCurrentWeeks}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                isCurrentWeeks
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 2)}
              className="px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="Next 2 weeks"
            >
              ›
            </button>
          </div>
        </div>
        {!loading && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalIncomplete === 0 ? (
              <span className="text-green-600 dark:text-green-400">All clear for these two weeks!</span>
            ) : (
              <>
                <span className="text-gray-800 dark:text-white font-medium">{totalIncomplete}</span>
                {' item'}{totalIncomplete !== 1 ? 's' : ''}{' remaining'}
              </>
            )}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <>
            <PlannerSkeleton />
            <PlannerSkeleton />
          </>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <p className="text-red-500 dark:text-red-400 text-sm">Failed to load planner.</p>
            <button onClick={loadItems} className="text-indigo-500 text-sm underline">Try again</button>
          </div>
        ) : (
          <>
            <WeekRow
              weekStart={week1Start}
              items={week1Items}
              events={week1Events}
              today={today}
              onAdd={handleAdd}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              label={isCurrentWeeks ? 'This Week' : 'Week 1'}
            />
            <WeekRow
              weekStart={week2Start}
              items={week2Items}
              events={week2Events}
              today={today}
              onAdd={handleAdd}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              label={isCurrentWeeks ? 'Next Week' : 'Week 2'}
            />
          </>
        )}
      </div>
    </div>
  )
}
