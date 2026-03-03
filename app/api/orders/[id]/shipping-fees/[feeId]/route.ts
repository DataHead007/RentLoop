import { NextResponse } from 'next/server'
import { getOrder, updateOrder, updateShippingFee } from '@/lib/supabase/queries'

/**
 * PATCH 单条物流费用，并重算订单 total_shipping_cost
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; feeId: string } }
) {
  try {
    const orderId = params.id
    const feeId = params.feeId
    const order = await getOrder(orderId)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const fee = order.shipping_fees?.find((f) => f.id === feeId)
    if (!fee) {
      return NextResponse.json({ error: 'Shipping fee not found' }, { status: 404 })
    }

    const body = await request.json()
    const payload: Record<string, unknown> = {}
    if (body.shipping_type !== undefined) payload.shipping_type = body.shipping_type
    if (body.shipping_company !== undefined) payload.shipping_company = body.shipping_company == null ? null : String(body.shipping_company)
    if (body.tracking_number !== undefined) payload.tracking_number = body.tracking_number == null ? null : String(body.tracking_number)
    if (body.amount !== undefined) payload.amount = Number(body.amount)
    if (body.notes !== undefined) payload.notes = body.notes == null ? null : String(body.notes)

    if (Object.keys(payload).length > 0) {
      await updateShippingFee(feeId, payload as any)
    }

    // 重新拉取订单下所有物流费用，重算 total_shipping_cost
    const updatedOrder = await getOrder(orderId)
    const total_shipping_cost = (updatedOrder?.shipping_fees ?? []).reduce(
      (sum, f) => sum + (Number(f.amount) || 0),
      0
    )
    await updateOrder(orderId, { total_shipping_cost })
    const finalOrder = await getOrder(orderId)
    return NextResponse.json(finalOrder)
  } catch (error: unknown) {
    console.error('Error updating shipping fee:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update shipping fee' },
      { status: 500 }
    )
  }
}
