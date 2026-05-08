import { NextResponse } from 'next/server'
import { getItemsWithStats, createItem, deleteItem, createTransaction, getItemsAvailableForDateRange, getItemsWithOccupancyInfo } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const excludeOrderId = searchParams.get('excludeOrderId') || undefined
    const includeOccupied = searchParams.get('includeOccupied') === 'true'

    if (startDate && endDate) {
      if (includeOccupied) {
        const items = await getItemsWithOccupancyInfo(startDate, endDate, excludeOrderId)
        return NextResponse.json(items, {
          headers: {
            'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
          },
        })
      }
      const items = await getItemsAvailableForDateRange(startDate, endDate, excludeOrderId)
      return NextResponse.json(items, {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      })
    }

    const items = await getItemsWithStats()
    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('Error fetching items:', error)
    return apiError('ITEMS_FETCH_FAILED', 'Failed to fetch items', 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const item = await createItem(body)
    
    // 自动创建购买支出交易记录
    if (item.purchase_price && item.purchase_price > 0 && item.purchase_date) {
      try {
        // 确保金额是负数（支出类型）
        const purchaseAmount = -Math.abs(item.purchase_price)
        await createTransaction({
          item_id: item.id,
          order_id: null,
          type: 'expense',
          amount: purchaseAmount, // 负数表示支出
          category: '设备购买',
          description: `${item.name} 设备购买`,
          transaction_date: item.purchase_date,
          auto_created: true,
        })
      } catch (transactionError) {
        // 记录错误但不影响资产创建
        console.error('Failed to auto-create purchase transaction:', transactionError)
      }
    }

    // 自动创建售出收入交易记录（如果在创建资产时就已经填写了售出信息）
    if (item.sold_price && item.sold_price > 0 && item.sale_date) {
      try {
        await createTransaction({
          item_id: item.id,
          order_id: null,
          type: 'income',
          amount: item.sold_price,
          category: '设备出售',
          description: `${item.name} 设备出售`,
          transaction_date: item.sale_date,
          auto_created: true,
        })
      } catch (transactionError) {
        // 记录错误但不影响资产创建
        console.error('Failed to auto-create sale transaction:', transactionError)
      }
    }
    
    // 注意：本地缓存更新在客户端组件中处理
    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    console.error('Error creating item:', error)
    
    // 提供更详细的错误信息
    let errorMessage = '创建资产失败，请重试'
    
    if (error?.message) {
      // 如果错误信息包含列名，可能是数据库迁移未执行
      if (error.message.includes('mount') || error.message.includes('column')) {
        errorMessage = '数据库迁移未执行：请先在 Supabase SQL Editor 中执行 supabase/add_mount_field.sql 文件中的 SQL 语句'
      } else {
        errorMessage = error.message
      }
    }
    
    return apiError('ITEM_CREATE_FAILED', errorMessage, 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return apiError('INVALID_REQUEST', 'Item ID is required', 400)
    }
    
    await deleteItem(id)
    
    // 注意：本地缓存删除在客户端组件中处理
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting item:', error)
    
    // 处理外键约束错误
    if (error?.code === '23503' || error?.message?.includes('foreign key')) {
      return apiError('ITEM_DELETE_CONFLICT', '无法删除：该设备下还有关联的订单，请先删除所有关联订单', 400)
    }
    
    return apiError('ITEM_DELETE_FAILED', 'Failed to delete item', 500)
  }
}
