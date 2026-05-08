import { NextResponse } from 'next/server'
import { getCustomers } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function GET() {
  try {
    const customers = await getCustomers()
    return NextResponse.json(customers)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return apiError('CUSTOMERS_FETCH_FAILED', 'Failed to fetch customers', 500)
  }
}
