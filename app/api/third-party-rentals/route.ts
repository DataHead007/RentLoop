import { NextResponse } from 'next/server'
import { createThirdPartyRental, deleteThirdPartyRental } from '@/lib/supabase/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rental = await createThirdPartyRental(body)
    return NextResponse.json(rental, { status: 201 })
  } catch (error: any) {
    console.error('Error creating third-party rental:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create third-party rental' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Third-party rental ID is required' },
        { status: 400 }
      )
    }
    
    await deleteThirdPartyRental(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting third-party rental:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete third-party rental' },
      { status: 500 }
    )
  }
}
