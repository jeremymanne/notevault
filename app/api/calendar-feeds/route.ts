import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const feeds = await prisma.calendarFeed.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(feeds)
  } catch (error) {
    console.error('GET /api/calendar-feeds error:', error)
    return NextResponse.json({ error: 'Failed to fetch feeds' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, url, color } = body

    if (!name?.trim() || !url?.trim()) {
      return NextResponse.json({ error: 'name and url are required' }, { status: 400 })
    }

    const feed = await prisma.calendarFeed.create({
      data: {
        name: name.trim(),
        url: url.trim(),
        color: color ?? '#3b82f6',
      },
    })

    return NextResponse.json(feed, { status: 201 })
  } catch (error) {
    console.error('POST /api/calendar-feeds error:', error)
    return NextResponse.json({ error: 'Failed to create feed' }, { status: 500 })
  }
}
