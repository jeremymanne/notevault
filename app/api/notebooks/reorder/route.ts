import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body as { ids: string[] }

    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'ids must be an array' }, { status: 400 })
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.notebook.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/notebooks/reorder error:', error)
    return NextResponse.json({ error: 'Failed to reorder notebooks' }, { status: 500 })
  }
}
