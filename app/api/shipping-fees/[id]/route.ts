import { NextResponse } from 'next/server'
import { updateShippingFee, getOrder, updateOrder } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const fee = await updateShippingFee(id, body)
    const orderId = fee.order_id
    if (orderId) {
      const order = await getOrder(orderId)
      const total = (order?.shipping_fees ?? []).reduce((s, f) => s + (Number((f as any).amount) || 0), 0)
      await updateOrder(orderId, { total_shipping_cost: total })
    }
    return NextResponse.json(fee)
  } catch (error: any) {
    console.error('Error updating shipping fee:', error)
    return apiError('SHIPPING_FEE_UPDATE_FAILED', error.message || 'Failed to update shipping fee', 500)
  }
}
