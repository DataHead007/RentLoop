import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const businessLine = searchParams.get('businessLine') as
      | 'rental'
      | 'badminton'
      | 'youtube'
      | 'wechat_video'
      | 'all'
      | null

    const safeType = type === 'income' || type === 'expense' ? type : null
    const safeBusinessLine = businessLine && businessLine !== 'all' ? businessLine : null

    const { data: summaryRows, error } = await supabaseServer.rpc('get_transaction_summary', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_type: safeType,
      p_category: category || null,
      p_business_line: safeBusinessLine,
    })

    if (error) throw error
    
    let totalIncome = 0
    let totalExpense = 0
    let transactionCount = 0
    
    const incomeByCategory: Record<string, number> = {}
    const expenseByCategory: Record<string, number> = {}

    ;(summaryRows || []).forEach((row: any) => {
      const amount = parseFloat(row.total_amount?.toString() || '0') || 0
      const count = Number(row.tx_count) || 0
      const rowCategory = row.category || '其他'
      transactionCount += count

      if (row.type === 'income') {
        totalIncome += amount
        incomeByCategory[rowCategory] = (incomeByCategory[rowCategory] || 0) + amount
      } else if (row.type === 'expense') {
        totalExpense += amount
        expenseByCategory[rowCategory] = (expenseByCategory[rowCategory] || 0) + amount
      }
    })
    
    const netProfit = totalIncome - totalExpense

    const payload = {
      totalIncome,
      totalExpense,
      netProfit,
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

    // 双轨兼容：
    // 1) 保留历史顶层字段（现有前端直接读取）
    // 2) 新增 success + data 结构（新协议）
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
