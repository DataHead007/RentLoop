import { NextResponse } from 'next/server'
import { updateShippingFee, getOrder, updateOrder } from '@/lib/supabase/queries'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const fee = await updateShippingFee(params.id, body)
    const orderId = fee.order_id
    if (orderId) {
      const order = await getOrder(orderId)
      const total = (order?.shipping_fees ?? []).reduce((s, f) => s + (Number((f as any).amount) || 0), 0)
      await updateOrder(orderId, { total_shipping_cost: total })
    }
    return NextResponse.json(fee)
  } catch (error: any) {
    console.error('Error updating shipping fee:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update shipping fee' },
      { status: 500 }
    )
  }
}
