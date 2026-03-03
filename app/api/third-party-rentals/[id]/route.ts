import { NextResponse } from 'next/server'
import { updateThirdPartyRental } from '@/lib/supabase/queries'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const rental = await updateThirdPartyRental(params.id, body)
    return NextResponse.json(rental)
  } catch (error: any) {
    console.error('Error updating third-party rental:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update third-party rental' },
      { status: 500 }
    )
  }
}
