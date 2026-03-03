import { NextResponse } from 'next/server'
import { updateCategory } from '@/lib/supabase/queries'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, description } = body as { name?: string; description?: string | null }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: '品类名称不能为空' },
        { status: 400 }
      )
    }

    const category = await updateCategory(id, {
      name: name.trim(),
      description: description?.trim() || null,
    })
    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}
