import { NextResponse } from 'next/server'
import { getCategories, createCategory, deleteCategory, getItems } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import type { Category } from '@/lib/types/database'
import { isRentalLine } from '@/lib/categories/rentalLine'

export async function GET() {
  try {
    const categories = await getCategories()
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    // 兜底：当 categories 表不可用时，从 items 关联品类中回填，避免前端完全不可用
    try {
      const items = await getItems()
      const categoryMap = new Map<string, Category>()
      for (const item of items) {
        if (item.category?.id && item.category?.name) {
          categoryMap.set(item.category.id, item.category)
        }
      }
      const fallback = Array.from(categoryMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-CN')
      )
      return NextResponse.json(fallback)
    } catch (fallbackError) {
      console.error('Error building fallback categories from items:', fallbackError)
      return apiError('CATEGORIES_FETCH_FAILED', 'Failed to fetch categories', 500)
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, rental_line } = body as {
      name?: string
      description?: string | null
      rental_line?: string
    }

    if (!name?.trim()) {
      return apiError('INVALID_REQUEST', '品类名称不能为空', 400)
    }
    if (!rental_line || !isRentalLine(rental_line)) {
      return apiError('INVALID_REQUEST', '请选择有效的业务线', 400)
    }

    const category = await createCategory({
      name: name.trim(),
      description: description?.trim() || null,
      rental_line,
    })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return apiError('CATEGORY_CREATE_FAILED', 'Failed to create category', 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return apiError('INVALID_REQUEST', 'Category ID is required', 400)
    }
    
    await deleteCategory(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting category:', error)
    
    // 处理外键约束错误
    if (error?.code === '23503' || error?.message?.includes('foreign key')) {
      return apiError('CATEGORY_DELETE_CONFLICT', '无法删除：该品类下还有关联的设备，请先删除所有关联设备', 400)
    }
    
    return apiError('CATEGORY_DELETE_FAILED', 'Failed to delete category', 500)
  }
}
