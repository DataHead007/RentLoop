import { NextResponse } from 'next/server'
import { getOrder, replaceOrderCompensations } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import type { OrderCompensationLineInput } from '@/lib/orders/orderCompensation'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const order = await getOrder(id)
    if (!order) {
      return apiError('NOT_FOUND', 'Order not found', 404)
    }
    return NextResponse.json(order.order_compensations ?? [])
  } catch (error) {
    console.error('Error fetching order compensations:', error)
    return apiError(
      'ORDER_COMPENSATIONS_FETCH_FAILED',
      error instanceof Error ? error.message : 'Failed to fetch compensations',
      500
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const order = await getOrder(orderId)
    if (!order) {
      return apiError('NOT_FOUND', 'Order not found', 404)
    }
    if ((order as { order_type?: string }).order_type === 'badminton') {
      return apiError('INVALID_REQUEST', '羽毛球订单不支持赔偿记录', 400)
    }

    const body = await request.json()
    const transactionDate =
      typeof body.transaction_date === 'string' && body.transaction_date.trim()
        ? body.transaction_date.split('T')[0]
        : order.end_date?.split('T')[0]

    if (!transactionDate) {
      return apiError('INVALID_REQUEST', '缺少记账日期', 400)
    }

    const rawLines = Array.isArray(body.lines) ? body.lines : []
    const lines: OrderCompensationLineInput[] = rawLines.map(
      (line: Record<string, unknown>) => ({
        order_item_id: String(line.order_item_id ?? ''),
        item_id:
          line.item_id == null || line.item_id === ''
            ? null
            : String(line.item_id),
        direction: line.direction === 'expense' ? 'expense' : 'income',
        category: String(line.category ?? '赔偿收入'),
        amount: Math.max(0, Number(line.amount) || 0),
        reason:
          line.reason == null || line.reason === '' ? null : String(line.reason),
        allocation_method:
          line.allocation_method === 'rent_ratio' ||
          line.allocation_method === 'purchase_ratio' ||
          line.allocation_method === 'manual'
            ? line.allocation_method
            : 'manual',
      })
    )

    await replaceOrderCompensations(orderId, lines, transactionDate)
    const updated = await getOrder(orderId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error saving order compensations:', error)
    const message = error instanceof Error ? error.message : 'Failed to save compensations'
    if (message.includes('order_compensations')) {
      return apiError(
        'DB_MIGRATION_REQUIRED',
        '请先执行 supabase/migration_order_compensations.sql 创建 order_compensations 表',
        400
      )
    }
    return apiError('ORDER_COMPENSATIONS_SAVE_FAILED', message, 500)
  }
}
