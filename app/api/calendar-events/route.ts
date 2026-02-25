import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import ical from 'node-ical'

const TZ = 'America/Los_Angeles'

interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  allDay: boolean
  feedName: string
  feedColor: string
}

function toDateStrTz(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')!.value
  const m = parts.find((p) => p.type === 'month')!.value
  const day = parts.find((p) => p.type === 'day')!.value
  return `${y}-${m}-${day}`
}

function toTimeStrTz(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getHourInTz(d: Date): number {
  return parseInt(
    d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }),
    10
  )
}

function getMinuteInTz(d: Date): number {
  return parseInt(
    d.toLocaleTimeString('en-US', { timeZone: TZ, minute: '2-digit' }).replace(/\D/g, ''),
    10
  )
}

function isAllDay(start: Date, end: Date): boolean {
  return (
    getHourInTz(start) === 0 &&
    getMinuteInTz(start) === 0 &&
    getHourInTz(end) === 0 &&
    getMinuteInTz(end) === 0 &&
    end.getTime() - start.getTime() >= 86400000
  )
}

function expandRecurring(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
  rangeStart: Date,
  rangeEnd: Date,
  feedName: string,
  feedColor: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = []

  if (event.type !== 'VEVENT') return events

  const summary = event.summary ?? 'Untitled'
  const uid = event.uid ?? ''

  // Handle recurring events
  if (event.rrule) {
    try {
      const dates = event.rrule.between(rangeStart, rangeEnd, true)
      const duration = event.end && event.start
        ? new Date(event.end).getTime() - new Date(event.start).getTime()
        : 0

      for (const date of dates) {
        const start = new Date(date)
        const end = new Date(start.getTime() + duration)
        const dateStr = toDateStrTz(start)
        const allDay = duration > 0 ? isAllDay(start, end) : true

        events.push({
          id: `${uid}_${dateStr}`,
          title: summary,
          date: dateStr,
          startTime: allDay ? undefined : toTimeStrTz(start),
          endTime: allDay ? undefined : toTimeStrTz(end),
          allDay,
          feedName,
          feedColor,
        })
      }
    } catch {
      // If rrule parsing fails, fall through to single event
    }
  }

  // Single (non-recurring) event or fallback
  if (events.length === 0 && event.start) {
    const start = new Date(event.start)
    const end = event.end ? new Date(event.end) : start
    const dateStr = toDateStrTz(start)
    const rangeFromStr = toDateStrTz(rangeStart)
    const rangeToStr = toDateStrTz(rangeEnd)

    if (dateStr >= rangeFromStr && dateStr <= rangeToStr) {
      const allDay = isAllDay(start, end)

      // Multi-day events: create an entry for each day
      if (allDay && end.getTime() - start.getTime() > 86400000) {
        const current = new Date(start)
        while (current < end) {
          const ds = toDateStrTz(current)
          if (ds >= rangeFromStr && ds <= rangeToStr) {
            events.push({
              id: `${uid}_${ds}`,
              title: summary,
              date: ds,
              allDay: true,
              feedName,
              feedColor,
            })
          }
          current.setDate(current.getDate() + 1)
        }
      } else {
        events.push({
          id: `${uid}_${dateStr}`,
          title: summary,
          date: dateStr,
          startTime: allDay ? undefined : toTimeStrTz(start),
          endTime: allDay ? undefined : toTimeStrTz(end),
          allDay,
          feedName,
          feedColor,
        })
      }
    }
  }

  return events
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to params required' }, { status: 400 })
    }

    const feeds = await prisma.calendarFeed.findMany({
      where: { enabled: true },
    })

    const rangeStart = new Date(from + 'T00:00:00')
    const rangeEnd = new Date(to + 'T23:59:59')

    const allEvents: CalendarEvent[] = []

    await Promise.all(
      feeds.map(async (feed) => {
        try {
          const data = await ical.async.fromURL(feed.url)
          for (const key of Object.keys(data)) {
            const event = data[key]
            const expanded = expandRecurring(event, rangeStart, rangeEnd, feed.name, feed.color)
            allEvents.push(...expanded)
          }
        } catch (err) {
          console.error(`Failed to fetch calendar feed "${feed.name}":`, err)
        }
      })
    )

    allEvents.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
      return (a.startTime ?? '').localeCompare(b.startTime ?? '')
    })

    return NextResponse.json(allEvents)
  } catch (error) {
    console.error('GET /api/calendar-events error:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 })
  }
}
