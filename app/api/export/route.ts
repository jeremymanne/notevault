import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [notes, notebooks, tags] = await Promise.all([
      prisma.note.findMany({
        include: {
          tags: { include: { tag: true } },
          notebook: true,
        },
        orderBy: [{ sortOrder: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.notebook.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    ])

    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      notebooks,
      tags,
      notes: notes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        isPinned: note.isPinned,
        notebookId: note.notebookId,
        notebookName: note.notebook?.name ?? null,
        tags: note.tags.map((nt) => nt.tag.name),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="notevault-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    console.error('GET /api/export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
