import { NextResponse } from 'next/server'
import { getCategories, createCategory, deleteCategory } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function GET() {
  try {
    const categories = await getCategories()
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return apiError('CATEGORIES_FETCH_FAILED', 'Failed to fetch categories', 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const category = await createCategory(body)
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
