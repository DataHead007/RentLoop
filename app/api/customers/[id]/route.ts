import { NextResponse } from 'next/server'
import { getCustomer, deleteCustomer } from '@/lib/supabase/queries'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await getCustomer(params.id)
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteCustomer(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting customer:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete customer'
    const statusCode = errorMessage.includes('关联订单') ? 400 : 500
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
