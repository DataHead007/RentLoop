import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // 构建查询
    let query = supabase
      .from('transaction_change_events')
      .select('delta_income, delta_expense, delta_net_profit, action, auto_created')
    
    // 时间范围筛选
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`)
    }
    
    const { data: events, error } = await query
    
    // 如果表不存在（用户还没执行 SQL），返回空统计而不是错误
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('transaction_change_events table does not exist yet. Please run the migration SQL.')
        const payload = {
          totalDeltaIncome: 0,
          totalDeltaExpense: 0,
          totalDeltaNetProfit: 0,
          totalEvents: 0,
          insertCount: 0,
          updateCount: 0,
          deleteCount: 0,
          autoCreatedCount: 0,
          manualCount: 0,
        }
        return NextResponse.json({
          ...payload,
          success: true,
          data: payload,
        })
      }
      throw error
    }
    
    // 计算统计
    let totalDeltaIncome = 0
    let totalDeltaExpense = 0
    let totalDeltaNetProfit = 0
    let insertCount = 0
    let updateCount = 0
    let deleteCount = 0
    let autoCreatedCount = 0
    let manualCount = 0
    
    events?.forEach(event => {
      totalDeltaIncome += parseFloat(event.delta_income?.toString() || '0')
      totalDeltaExpense += parseFloat(event.delta_expense?.toString() || '0')
      totalDeltaNetProfit += parseFloat(event.delta_net_profit?.toString() || '0')
      
      if (event.action === 'insert') insertCount++
      else if (event.action === 'update') updateCount++
      else if (event.action === 'delete') deleteCount++
      
      if (event.auto_created) autoCreatedCount++
      else manualCount++
    })
    
    const payload = {
      totalDeltaIncome,
      totalDeltaExpense,
      totalDeltaNetProfit,
      totalEvents: events?.length || 0,
      insertCount,
      updateCount,
      deleteCount,
      autoCreatedCount,
      manualCount,
    }
    return NextResponse.json({
      ...payload,
      success: true,
      data: payload,
    })
  } catch (error: any) {
    console.error('Error fetching change events stats:', error)
    // 对于其他错误，也尝试返回空统计
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      const payload = {
        totalDeltaIncome: 0,
        totalDeltaExpense: 0,
        totalDeltaNetProfit: 0,
        totalEvents: 0,
        insertCount: 0,
        updateCount: 0,
        deleteCount: 0,
        autoCreatedCount: 0,
        manualCount: 0,
      }
      return NextResponse.json({
        ...payload,
        success: true,
        data: payload,
      })
    }
    return apiError('CHANGE_EVENTS_STATS_FETCH_FAILED', error?.message || 'Failed to fetch change events stats', 500)
  }
}
