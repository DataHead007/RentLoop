import { NextResponse } from 'next/server'
import { getAccountBindings } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    
    const bindings = await getAccountBindings(activeOnly)
    return NextResponse.json(bindings)
  } catch (error) {
    console.error('Error fetching account bindings:', error)
    return apiError('ACCOUNT_BINDINGS_FETCH_FAILED', 'Failed to fetch account bindings', 500)
  }
}
