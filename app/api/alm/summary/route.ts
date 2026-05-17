import { NextResponse } from 'next/server'
import { getAlmGlobalSummary } from '@/lib/finance/almService'
import { apiError } from '@/lib/api/response'

export async function GET() {
  try {
    const data = await getAlmGlobalSummary()
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error(e)
    return apiError('ALM_SUMMARY_FAILED', e instanceof Error ? e.message : '加载失败', 500)
  }
}
