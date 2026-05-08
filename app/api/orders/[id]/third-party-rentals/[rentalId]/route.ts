import { NextResponse } from 'next/server'
import { getOrder, updateThirdPartyRental } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

/**
 * PATCH 单条第三方租赁：更新 game_name, rental_cost, deposit, platform, provider, provider_order_id, notes
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rentalId: string }> }
) {
  try {
    const { id: orderId, rentalId } = await params
    const order = await getOrder(orderId)
    if (!order) {
      return apiError('NOT_FOUND', 'Order not found', 404)
    }
    const rental = order.third_party_rentals?.find((r) => r.id === rentalId)
    if (!rental) {
      return apiError('NOT_FOUND', 'Third party rental not found', 404)
    }

    const body = await request.json()
    const payload: Record<string, unknown> = {}
    if (body.game_name !== undefined) payload.game_name = String(body.game_name)
    if (body.rental_cost !== undefined) payload.rental_cost = Number(body.rental_cost)
    if (body.deposit !== undefined) payload.deposit = Number(body.deposit)
    if (body.platform !== undefined) payload.platform = body.platform == null ? null : String(body.platform)
    if (body.provider !== undefined) payload.provider = body.provider == null ? null : String(body.provider)
    if (body.provider_order_id !== undefined) payload.provider_order_id = body.provider_order_id == null ? null : String(body.provider_order_id)
    if (body.notes !== undefined) payload.notes = body.notes == null ? null : String(body.notes)

    if (Object.keys(payload).length === 0) {
      const finalOrder = await getOrder(orderId)
      return NextResponse.json(finalOrder)
    }

    await updateThirdPartyRental(rentalId, payload as any)
    const finalOrder = await getOrder(orderId)
    return NextResponse.json(finalOrder)
  } catch (error: unknown) {
    console.error('Error updating third party rental:', error)
    return apiError('THIRD_PARTY_RENTAL_UPDATE_FAILED', error instanceof Error ? error.message : 'Failed to update third party rental', 500)
  }
}
