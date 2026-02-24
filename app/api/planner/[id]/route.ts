import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { text, date, isCompleted, color, sortOrder } = body

    const item = await prisma.plannerItem.update({
      where: { id },
      data: {
        ...(text !== undefined ? { text } : {}),
        ...(date !== undefined ? { date } : {}),
        ...(isCompleted !== undefined ? { isCompleted } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('PUT /api/planner/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update planner item' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.plannerItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/planner/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete planner item' }, { status: 500 })
  }
}
