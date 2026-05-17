import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'

import { isPlateMigrationMissingFromDbError } from '@/lib/supabase/plateMigrationErrors'

const NON_OPERATING_INCOME_CATEGORIES = new Set(['融资放款入账'])
const NON_OPERATING_EXPENSE_CATEGORIES = new Set(['归还借款本金'])

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

  const p_business_plate =
    plate && plate !== 'all' ? plate : null
  const p_creator_channel =
    channel && channel !== 'all' ? channel : null

  return { p_business_plate, p_creator_channel }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')
    const category = searchParams.get('category')

    const safeType = type === 'income' || type === 'expense' ? type : null

    const { p_business_plate, p_creator_channel } = resolvePlateFilters(searchParams)

    const { data: summaryRows, error } = await supabaseServer.rpc('get_transaction_summary', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_type: safeType,
      p_category: category || null,
      p_business_plate,
      p_creator_channel,
    })

    if (error) {
      if (isPlateMigrationMissingFromDbError(error)) {
        return apiError(
          'DB_MIGRATION_REQUIRED',
          '交易统计接口依赖三大板块迁移。请先在 Supabase SQL Editor 执行 `supabase/migration_business_plates.sql`（会替换 transactions.business_line，并重定义 get_transaction_summary）。',
          400
        )
      }
      throw error
    }

    let totalIncome = 0
    let totalExpense = 0
    let operatingIncome = 0
    let operatingExpense = 0
    let transactionCount = 0

    const incomeByCategory: Record<string, number> = {}
    const expenseByCategory: Record<string, number> = {}

    ;(summaryRows || []).forEach((row: Record<string, unknown>) => {
      const amount = parseFloat(String(row.total_amount ?? '0')) || 0
      const count = Number(row.tx_count) || 0
      const rowCategory = (row.category as string) || '其他'
      transactionCount += count

      if (row.type === 'income') {
        totalIncome += amount
        incomeByCategory[rowCategory] = (incomeByCategory[rowCategory] || 0) + amount
        if (!NON_OPERATING_INCOME_CATEGORIES.has(rowCategory)) {
          operatingIncome += amount
        }
      } else if (row.type === 'expense') {
        totalExpense += amount
        expenseByCategory[rowCategory] = (expenseByCategory[rowCategory] || 0) + amount
        if (!NON_OPERATING_EXPENSE_CATEGORIES.has(rowCategory)) {
          operatingExpense += amount
        }
      }
    })

    const netProfit = operatingIncome - operatingExpense

    const payload = {
      totalIncome,
      totalExpense,
      netProfit,
      operatingIncome,
      operatingExpense,
      cashNetFlow: totalIncome - totalExpense,
      transactionCount,
      incomeByCategory: Object.entries(incomeByCategory).map(([category, amount]) => ({
        category,
        amount,
      })),
      expenseByCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({
        category,
        amount,
      })),
    }

    return NextResponse.json({
      ...payload,
      success: true,
      data: payload,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transaction stats'
    console.error('Error fetching transaction stats:', error)
    return apiError('TRANSACTION_STATS_FETCH_FAILED', message, 500)
  }
}
