import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { isPlateMigrationMissingFromDbError } from '@/lib/supabase/plateMigrationErrors'
import {
  aggregateScopeBreakdown,
  aggregateTransactionSummaryRows,
  buildSummaryRowsFromTransactions,
  dbErrorMessage,
  type TransactionSummaryRow,
} from '@/lib/transactions/aggregateStats'

function resolvePlateFilters(searchParams: URLSearchParams): {
  p_business_plate: string | null
  p_creator_channel: string | null
} {
  let plate = searchParams.get('businessPlate')
  let channel = searchParams.get('creatorChannel')

  const legacy = searchParams.get('businessLine')
  if (!plate && legacy && legacy !== 'all') {
    if (legacy === 'rental') plate = 'rental'
    else if (legacy === 'badminton') plate = 'badminton'
    else if (legacy === 'youtube') {
      plate = 'creator'
      channel = 'youtube'
    } else if (legacy === 'wechat_video') {
      plate = 'creator'
      channel = 'wechat_video'
    }
  }

  const p_business_plate = plate && plate !== 'all' ? plate : null
  const p_creator_channel = channel && channel !== 'all' ? channel : null

  return { p_business_plate, p_creator_channel }
}

type SummaryFilters = {
  startDate: string | null
  endDate: string | null
  safeType: 'income' | 'expense' | null
  category: string | null
  p_business_plate: string | null
  p_creator_channel: string | null
}

async function fetchSummaryRowsViaRpc(filters: SummaryFilters): Promise<{
  rows: TransactionSummaryRow[]
  error: unknown | null
}> {
  const { data, error } = await supabaseServer.rpc('get_transaction_summary', {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_type: filters.safeType,
    p_category: filters.category,
    p_business_plate: filters.p_business_plate,
    p_creator_channel: filters.p_creator_channel,
  })

  if (error) return { rows: [], error }

  const rows = (data || []).map((row: Record<string, unknown>) => ({
    business_plate: (row.business_plate as string | null) ?? null,
    creator_channel: (row.creator_channel as string | null) ?? null,
    type: String(row.type ?? ''),
    category: String(row.category ?? '其他'),
    total_amount: Number(row.total_amount) || 0,
    tx_count: Number(row.tx_count) || 0,
  }))

  return { rows, error: null }
}

async function fetchSummaryRowsFallback(filters: SummaryFilters): Promise<TransactionSummaryRow[]> {
  let query = supabaseServer
    .from('transactions')
    .select('business_plate, creator_channel, type, category, amount')

  if (filters.startDate) query = query.gte('transaction_date', filters.startDate)
  if (filters.endDate) query = query.lte('transaction_date', filters.endDate)
  if (filters.safeType) query = query.eq('type', filters.safeType)
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.p_business_plate) query = query.eq('business_plate', filters.p_business_plate)
  if (filters.p_creator_channel) {
    query = query.eq('creator_channel', filters.p_creator_channel)
  }

  const { data, error } = await query
  if (error) throw error

  return buildSummaryRowsFromTransactions(
    (data || []) as {
      business_plate: string | null
      creator_channel: string | null
      type: string
      category: string | null
      amount: number | string
    }[]
  )
}

async function loadSummaryRows(filters: SummaryFilters): Promise<TransactionSummaryRow[]> {
  const { rows, error } = await fetchSummaryRowsViaRpc(filters)

  if (!error) return rows

  if (isPlateMigrationMissingFromDbError(error)) {
    throw error
  }

  console.warn('[transactions/stats] RPC failed, using fallback query:', dbErrorMessage(error))
  return fetchSummaryRowsFallback(filters)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const includeScopeBreakdown = searchParams.get('includeScopeBreakdown') === 'true'

    const safeType = type === 'income' || type === 'expense' ? type : null
    const { p_business_plate, p_creator_channel } = resolvePlateFilters(searchParams)

    const filters: SummaryFilters = {
      startDate: startDate || null,
      endDate: endDate || null,
      safeType,
      category: category || null,
      p_business_plate,
      p_creator_channel,
    }

    const summaryRows = await loadSummaryRows(filters)
    const payload = aggregateTransactionSummaryRows(summaryRows)

    const scopeBreakdown =
      includeScopeBreakdown && !p_business_plate
        ? aggregateScopeBreakdown(summaryRows)
        : undefined

    return NextResponse.json({
      ...payload,
      scopeBreakdown,
      success: true,
      data: { ...payload, scopeBreakdown },
    })
  } catch (error) {
    if (isPlateMigrationMissingFromDbError(error)) {
      return apiError(
        'DB_MIGRATION_REQUIRED',
        '交易统计依赖 get_transaction_summary 或 business_plate 字段。请在 Supabase 执行 supabase/migration_business_plates.sql 或 supabase/add_transaction_summary_rpc.sql。',
        400
      )
    }
    const message = dbErrorMessage(error)
    console.error('Error fetching transaction stats:', error)
    return apiError('TRANSACTION_STATS_FETCH_FAILED', message, 500)
  }
}
