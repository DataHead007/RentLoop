import { NextResponse } from 'next/server'
import {
  createBadmintonMatchRecord,
  getBadmintonMatchRecords,
} from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import { parseBadmintonMatchPayload } from '@/lib/badminton/matchRecordPayload'
import { syncBadmintonMatchTransactions } from '@/lib/badminton/syncMatchTransactions'

export async function GET() {
  try {
    const records = await getBadmintonMatchRecords()
    return NextResponse.json(records)
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : '加载失败'
    if (msg.includes('badminton_match_records') || msg.includes('does not exist')) {
      return apiError(
        'BADMINTON_MATCHES_TABLE_MISSING',
        '比赛记录表尚未创建，请在 Supabase 执行 supabase/migration_badminton_match_records.sql',
        500
      )
    }
    return apiError('BADMINTON_MATCHES_FETCH_FAILED', msg, 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = parseBadmintonMatchPayload(body)
    if (!parsed.ok) {
      return apiError('INVALID_REQUEST', parsed.message, 400)
    }

    const record = await createBadmintonMatchRecord(parsed.data)

    let transaction_sync_warning: string | null = null
    let transactions_synced: number | null = null
    try {
      transactions_synced = await syncBadmintonMatchTransactions(record)
    } catch (syncErr) {
      console.error('Failed to sync badminton match transactions:', syncErr)
      transaction_sync_warning =
        '比赛已保存，但同步羽毛球交易失败。请确认已执行 supabase/migration_badminton_match_transactions_sync.sql，保存后可再次编辑以重试。'
    }

    return NextResponse.json(
      {
        ...record,
        transactions_synced,
        transaction_sync_warning,
      },
      { status: 201 }
    )
  } catch (e) {
    console.error(e)
    return apiError(
      'BADMINTON_MATCH_CREATE_FAILED',
      e instanceof Error ? e.message : '创建失败',
      500
    )
  }
}
