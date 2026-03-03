import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const businessLine = searchParams.get('businessLine') as 'rental' | 'badminton' | 'youtube' | null

    let query = supabase
      .from('transactions')
      .select('amount, type, category, business_line')

    if (startDate) query = query.gte('transaction_date', startDate)
    if (endDate) query = query.lte('transaction_date', endDate)
    if (type && (type === 'income' || type === 'expense')) query = query.eq('type', type)
    if (category) query = query.eq('category', category)
    if (businessLine && businessLine !== 'all') query = query.eq('business_line', businessLine)

    const { data: transactions, error } = await query
    
    if (error) throw error
    
    // 计算统计信息
    let totalIncome = 0
    let totalExpense = 0
    let transactionCount = transactions?.length || 0
    
    transactions?.forEach(tx => {
      const amount = parseFloat(tx.amount.toString()) || 0
      if (tx.type === 'income') {
        totalIncome += amount
      } else if (tx.type === 'expense') {
        totalExpense += Math.abs(amount) // 支出是负数，取绝对值
      }
    })
    
    const netProfit = totalIncome - totalExpense
    
    // 按类别统计
    const incomeByCategory: Record<string, number> = {}
    const expenseByCategory: Record<string, number> = {}
    
    transactions?.forEach(tx => {
      const amount = parseFloat(tx.amount.toString()) || 0
      const category = tx.category || '其他'
      
      if (tx.type === 'income') {
        incomeByCategory[category] = (incomeByCategory[category] || 0) + amount
      } else if (tx.type === 'expense') {
        expenseByCategory[category] = (expenseByCategory[category] || 0) + Math.abs(amount)
      }
    })
    
    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Error fetching transaction stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transaction stats' },
      { status: 500 }
    )
  }
}
