import { NextResponse } from 'next/server'
import { getBadmintonMatchRecordById } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import { syncBadmintonMatchTransactions } from '@/lib/badminton/syncMatchTransactions'

/** 手动重试：按当前比赛数据重建自动交易 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const record = await getBadmintonMatchRecordById(id)
    if (!record) {
      return apiError('NOT_FOUND', '比赛记录不存在', 404)
    }

    const transactions_synced = await syncBadmintonMatchTransactions(record)
    return NextResponse.json({ success: true, transactions_synced })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : '同步失败'
    if (msg.includes('badminton_match_record_id') || msg.includes('does not exist')) {
      return apiError(
        'SYNC_MIGRATION_REQUIRED',
        '请先执行 supabase/migration_badminton_match_transactions_sync.sql',
        500
      )
    }
    return apiError('BADMINTON_MATCH_SYNC_FAILED', msg, 500)
  }
}
