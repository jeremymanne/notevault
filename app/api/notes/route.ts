import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const notebookId = searchParams.get('notebookId')
    const tagId = searchParams.get('tagId')
    const pinned = searchParams.get('pinned')
    const archive = searchParams.get('archive')
    const search = searchParams.get('search')

    const notes = await prisma.note.findMany({
      where: {
        isArchived: archive === 'true',
        ...(notebookId ? { notebookId } : {}),
        ...(tagId ? { tags: { some: { tagId } } } : {}),
        ...(pinned === 'true' ? { isPinned: true } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { content: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        tags: {
          include: { tag: true },
        },
        notebook: true,
      },
      orderBy: [{ sortOrder: 'desc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('GET /api/notes error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, notebookId, tags } = body

    const maxSortOrder = await prisma.note.aggregate({ _max: { sortOrder: true } })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

    const note = await prisma.note.create({
      data: {
        title: title ?? 'Untitled',
        content: content ?? '',
        notebookId: notebookId ?? null,
        sortOrder: nextSortOrder,
        ...(tags && tags.length > 0
          ? {
              tags: {
                create: await resolveTagIds(tags),
              },
            }
          : {}),
      },
      include: {
        tags: { include: { tag: true } },
        notebook: true,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('POST /api/notes error:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

async function resolveTagIds(tagNames: string[]) {
  const results = []
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    })
    results.push({ tagId: tag.id })
  }
  return results
}
