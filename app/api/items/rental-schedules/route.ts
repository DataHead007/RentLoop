import { NextResponse } from 'next/server'
import { getItemRentalSchedules } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function GET() {
  try {
    const schedules = await getItemRentalSchedules()
    return NextResponse.json({ schedules })
  } catch (e) {
    console.error(e)
    return apiError(
      'ITEM_RENTAL_SCHEDULES_FETCH_FAILED',
      e instanceof Error ? e.message : '加载租赁档期失败',
      500
    )
  }
}
