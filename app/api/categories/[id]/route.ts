import { NextResponse } from 'next/server'
import { updateCategory } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import { isRentalLine } from '@/lib/categories/rentalLine'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, rental_line } = body as {
      name?: string
      description?: string | null
      rental_line?: string | null
    }

    if (!name?.trim()) {
      return apiError('INVALID_REQUEST', '品类名称不能为空', 400)
    }

    if (rental_line != null && rental_line !== '' && !isRentalLine(rental_line)) {
      return apiError('INVALID_REQUEST', '无效的业务线', 400)
    }

    const category = await updateCategory(id, {
      name: name.trim(),
      description: description?.trim() || null,
      rental_line: rental_line && isRentalLine(rental_line) ? rental_line : null,
    })
    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return apiError('CATEGORY_UPDATE_FAILED', 'Failed to update category', 500)
  }
}
