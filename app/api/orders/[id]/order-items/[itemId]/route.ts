import { NextResponse } from 'next/server'
import { getOrder, updateOrder, updateOrderItem } from '@/lib/supabase/queries'

/** 计算租赁天数 */
function getRentalDays(startDate: string, endDate: string): number {
  const start = new Date(String(startDate).split('T')[0])
  const end = new Date(String(endDate).split('T')[0])
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.floor(diff) + 1)
}

/**
 * PATCH 单条订单项（数量、日租金、押金、备注），并重算订单总金额与总押金
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const orderId = params.id
    const itemId = params.itemId
    const order = await getOrder(orderId)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const orderItem = order.order_items?.find((i) => i.id === itemId)
    if (!orderItem) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }

    const body = await request.json()
    const quantity = body.quantity !== undefined ? Number(body.quantity) : orderItem.quantity
    const daily_rate = body.daily_rate !== undefined ? Number(body.daily_rate) : orderItem.daily_rate
    const deposit = body.deposit !== undefined ? Number(body.deposit) : orderItem.deposit
    const notes = body.notes !== undefined ? String(body.notes) : orderItem.notes

    const days = getRentalDays(order.start_date, order.end_date)
    // subtotal 为单件总租金（日租金 × 天数），订单项总金额 = subtotal * quantity
    const subtotal = Math.round(daily_rate * days * 100) / 100

    await updateOrderItem(itemId, {
      quantity,
      daily_rate,
      subtotal,
      deposit,
      notes: notes || null,
    })

    // 重新拉取该订单下所有订单项并重算订单总金额、总押金
    const updatedOrder = await getOrder(orderId)
    if (!updatedOrder?.order_items?.length) {
      return NextResponse.json(updatedOrder || order)
    }

    let total_amount = 0
    let total_deposit = 0
    for (const item of updatedOrder.order_items) {
      total_amount += (item.subtotal || 0) * (item.quantity || 1)
      total_deposit += (item.deposit || 0) * (item.quantity || 1)
    }
    total_amount = Math.round(total_amount * 100) / 100
    total_deposit = Math.round(total_deposit * 100) / 100

    await updateOrder(orderId, { total_amount, total_deposit })
    const finalOrder = await getOrder(orderId)
    return NextResponse.json(finalOrder)
  } catch (error: unknown) {
    console.error('Error updating order item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update order item' },
      { status: 500 }
    )
  }
}
