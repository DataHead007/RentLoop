import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import {
  aggregateRentalCompensationStats,
  RENTAL_COMPENSATION_INCOME_CATEGORY,
  RENTAL_MAINTENANCE_EXPENSE_CATEGORY,
} from '@/lib/orders/rentalCompensationStats'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabaseServer
      .from('transactions')
      .select('type, category, amount')
      .eq('business_plate', 'rental')
      .in('category', [RENTAL_COMPENSATION_INCOME_CATEGORY, RENTAL_MAINTENANCE_EXPENSE_CATEGORY])

    if (startDate) query = query.gte('transaction_date', startDate.split('T')[0])
    if (endDate) query = query.lte('transaction_date', endDate.split('T')[0])

    const { data, error } = await query
    if (error) throw error

    const stats = aggregateRentalCompensationStats(data ?? [])
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching rental compensation stats:', error)
    return apiError(
      'RENTAL_COMPENSATION_STATS_FAILED',
      error instanceof Error ? error.message : 'Failed to fetch stats',
      500
    )
  }
}
