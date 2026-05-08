import { NextResponse } from 'next/server'
import { createThirdPartyRental, deleteThirdPartyRental } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rental = await createThirdPartyRental(body)
    return NextResponse.json(rental, { status: 201 })
  } catch (error: any) {
    console.error('Error creating third-party rental:', error)
    return apiError('THIRD_PARTY_RENTAL_CREATE_FAILED', error.message || 'Failed to create third-party rental', 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return apiError('INVALID_REQUEST', 'Third-party rental ID is required', 400)
    }
    
    await deleteThirdPartyRental(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting third-party rental:', error)
    return apiError('THIRD_PARTY_RENTAL_DELETE_FAILED', error.message || 'Failed to delete third-party rental', 500)
  }
}
