import { NextResponse } from 'next/server'
import { getCustomer, deleteCustomer } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const customer = await getCustomer(id)
    if (!customer) {
      return apiError('NOT_FOUND', 'Customer not found', 404)
    }
    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return apiError('CUSTOMER_FETCH_FAILED', 'Failed to fetch customer', 500)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteCustomer(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting customer:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete customer'
    const statusCode = errorMessage.includes('关联订单') ? 400 : 500
    return apiError('CUSTOMER_DELETE_FAILED', errorMessage, statusCode)
  }
}
