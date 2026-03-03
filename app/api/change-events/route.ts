import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const action = searchParams.get('action') // insert | update | delete
    const autoCreated = searchParams.get('autoCreated') // true | false
    const itemId = searchParams.get('itemId')
    const orderId = searchParams.get('orderId')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    
    // 构建查询
    let query = supabase
      .from('transaction_change_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // 时间范围筛选
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`)
    }
    
    // 操作类型筛选
    if (action && ['insert', 'update', 'delete'].includes(action)) {
      query = query.eq('action', action)
    }
    
    // 是否自动创建筛选
    if (autoCreated === 'true') {
      query = query.eq('auto_created', true)
    } else if (autoCreated === 'false') {
      query = query.eq('auto_created', false)
    }
    
    // 资产筛选
    if (itemId) {
      query = query.eq('item_id', itemId)
    }
    
    // 订单筛选
    if (orderId) {
      query = query.eq('order_id', orderId)
    }
    
    // 类别筛选
    if (category) {
      query = query.eq('category', category)
    }
    
    // 分页
    query = query.range(offset, offset + limit - 1)
    
    const { data: events, error, count } = await query
    
    // 如果表不存在（用户还没执行 SQL），返回空数组而不是错误
    if (error) {
      // 检查是否是表不存在的错误（PostgreSQL 错误代码 42P01）
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('transaction_change_events table does not exist yet. Please run the migration SQL.')
        return NextResponse.json({
          events: [],
          total: 0,
          limit,
          offset,
        })
      }
      throw error
    }
    
    return NextResponse.json({
      events: events || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Error fetching change events:', error)
    // 对于其他错误，也尝试返回空数组而不是 500
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({
        events: [],
        total: 0,
        limit: parseInt(new URL(request.url).searchParams.get('limit') || '100', 10),
        offset: parseInt(new URL(request.url).searchParams.get('offset') || '0', 10),
      })
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch change events' },
      { status: 500 }
    )
  }
}
