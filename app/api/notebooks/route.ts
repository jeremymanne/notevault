import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const notebooks = await prisma.notebook.findMany({
      include: {
        _count: { select: { notes: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(notebooks)
  } catch (error) {
    console.error('GET /api/notebooks error:', error)
    return NextResponse.json({ error: 'Failed to fetch notebooks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const maxSortOrder = await prisma.notebook.aggregate({ _max: { sortOrder: true } })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

    const notebook = await prisma.notebook.create({
      data: {
        name,
        color: color ?? '#6366f1',
        sortOrder: nextSortOrder,
      },
      include: {
        _count: { select: { notes: true } },
      },
    })

    return NextResponse.json(notebook, { status: 201 })
  } catch (error) {
    console.error('POST /api/notebooks error:', error)
    return NextResponse.json({ error: 'Failed to create notebook' }, { status: 500 })
  }
}
