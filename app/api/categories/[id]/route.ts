import { NextResponse } from 'next/server'
import { updateCategory } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description } = body as { name?: string; description?: string | null }

    if (!name?.trim()) {
      return apiError('INVALID_REQUEST', '品类名称不能为空', 400)
    }

    const category = await updateCategory(id, {
      name: name.trim(),
      description: description?.trim() || null,
    })
    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return apiError('CATEGORY_UPDATE_FAILED', 'Failed to update category', 500)
  }
}
