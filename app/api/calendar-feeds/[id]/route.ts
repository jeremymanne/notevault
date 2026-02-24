import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, url, color, enabled } = body

    const feed = await prisma.calendarFeed.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      },
    })

    return NextResponse.json(feed)
  } catch (error) {
    console.error('PUT /api/calendar-feeds/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update feed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.calendarFeed.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/calendar-feeds/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete feed' }, { status: 500 })
  }
}
