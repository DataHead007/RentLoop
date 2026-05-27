import { NextResponse } from 'next/server'
import {
  deleteBadmintonMatchRecord,
  getBadmintonMatchRecordById,
  getTransactionsForBadmintonMatch,
  updateBadmintonMatchRecord,
} from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import { parseBadmintonMatchPayload } from '@/lib/badminton/matchRecordPayload'
import { syncBadmintonMatchTransactions } from '@/lib/badminton/syncMatchTransactions'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const record = await getBadmintonMatchRecordById(id)
    if (!record) {
      return apiError('NOT_FOUND', '比赛记录不存在', 404)
    }
    const linked_transactions = await getTransactionsForBadmintonMatch(id).catch(() => [])
    return NextResponse.json({ ...record, linked_transactions })
  } catch (e) {
    console.error(e)
    return apiError(
      'BADMINTON_MATCH_FETCH_FAILED',
      e instanceof Error ? e.message : '加载失败',
      500
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await getBadmintonMatchRecordById(id)
    if (!existing) {
      return apiError('NOT_FOUND', '比赛记录不存在', 404)
    }

    const body = await request.json()
    const parsed = parseBadmintonMatchPayload(body)
    if (!parsed.ok) {
      return apiError('INVALID_REQUEST', parsed.message, 400)
    }

    const record = await updateBadmintonMatchRecord(id, parsed.data)

    let transaction_sync_warning: string | null = null
    let transactions_synced: number | null = null
    try {
      transactions_synced = await syncBadmintonMatchTransactions(record)
    } catch (syncErr) {
      console.error('Failed to sync badminton match transactions:', syncErr)
      transaction_sync_warning =
        '比赛已更新，但同步羽毛球交易失败。请确认已执行 supabase/migration_badminton_match_transactions_sync.sql，可再次保存以重试。'
    }

    return NextResponse.json({
      ...record,
      transactions_synced,
      transaction_sync_warning,
    })
  } catch (e) {
    console.error(e)
    return apiError(
      'BADMINTON_MATCH_UPDATE_FAILED',
      e instanceof Error ? e.message : '更新失败',
      500
    )
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await getBadmintonMatchRecordById(id)
    if (!existing) {
      return apiError('NOT_FOUND', '比赛记录不存在', 404)
    }
    await deleteBadmintonMatchRecord(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return apiError(
      'BADMINTON_MATCH_DELETE_FAILED',
      e instanceof Error ? e.message : '删除失败',
      500
    )
  }
}
