import { NextResponse } from 'next/server'
import { getAccountBindings } from '@/lib/supabase/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    
    const bindings = await getAccountBindings(activeOnly)
    return NextResponse.json(bindings)
  } catch (error) {
    console.error('Error fetching account bindings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account bindings' },
      { status: 500 }
    )
  }
}
