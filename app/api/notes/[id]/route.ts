import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        notebook: true,
      },
    })
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    return NextResponse.json(note)
  } catch (error) {
    console.error('GET /api/notes/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, isPinned, isArchived, notebookId, tags } = body

    // Update note fields
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (isArchived !== undefined) updateData.isArchived = isArchived
    if (notebookId !== undefined) updateData.notebookId = notebookId

    // Handle tags: replace all existing with new set
    if (tags !== undefined) {
      // Delete all existing tag associations
      await prisma.noteTag.deleteMany({ where: { noteId: id } })

      // Create new tag associations
      if (tags.length > 0) {
        for (const name of tags as string[]) {
          const tag = await prisma.tag.upsert({
            where: { name },
            create: { name },
            update: {},
          })
          await prisma.noteTag.upsert({
            where: { noteId_tagId: { noteId: id, tagId: tag.id } },
            create: { noteId: id, tagId: tag.id },
            update: {},
          })
        }
      }
    }

    const note = await prisma.note.update({
      where: { id },
      data: updateData,
      include: {
        tags: { include: { tag: true } },
        notebook: true,
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('PUT /api/notes/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.note.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/notes/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
