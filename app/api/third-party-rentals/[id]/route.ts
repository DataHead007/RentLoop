import { NextResponse } from 'next/server'
import { updateThirdPartyRental } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const rental = await updateThirdPartyRental(id, body)
    return NextResponse.json(rental)
  } catch (error: any) {
    console.error('Error updating third-party rental:', error)
    return apiError('THIRD_PARTY_RENTAL_UPDATE_FAILED', error.message || 'Failed to update third-party rental', 500)
  }
}
