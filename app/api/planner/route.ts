import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const items = await prisma.plannerItem.findMany({
      where: {
        ...(from && to ? { date: { gte: from, lte: to } } : {}),
      },
      orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('GET /api/planner error:', error)
    return NextResponse.json({ error: 'Failed to fetch planner items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, date, color } = body

    if (!text?.trim() || !date) {
      return NextResponse.json({ error: 'text and date are required' }, { status: 400 })
    }

    const maxSort = await prisma.plannerItem.aggregate({
      where: { date },
      _max: { sortOrder: true },
    })
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1

    const item = await prisma.plannerItem.create({
      data: {
        text: text.trim(),
        date,
        color: color ?? '#6366f1',
        sortOrder: nextSort,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('POST /api/planner error:', error)
    return NextResponse.json({ error: 'Failed to create planner item' }, { status: 500 })
  }
}
