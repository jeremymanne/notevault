import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, color } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (color !== undefined) updateData.color = color

    const notebook = await prisma.notebook.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { notes: true } },
      },
    })

    return NextResponse.json(notebook)
  } catch (error) {
    console.error('PUT /api/notebooks/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update notebook' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Unlink notes from this notebook (set notebookId to null) before deleting
    await prisma.note.updateMany({
      where: { notebookId: id },
      data: { notebookId: null },
    })

    await prisma.notebook.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/notebooks/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete notebook' }, { status: 500 })
  }
}
