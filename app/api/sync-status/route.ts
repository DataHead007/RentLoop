import { NextResponse } from 'next/server'
import { 
  getItems as getItemsFromSupabase,
  getOrders as getOrdersFromSupabase,
  getCustomers as getCustomersFromSupabase,
  getCategories as getCategoriesFromSupabase,
} from '@/lib/supabase/queries'

export async function GET() {
  try {
    const tables = ['items', 'orders', 'customers', 'categories'] as const
    
    // API 路由只返回 Supabase 的数据
    // 客户端自己查询本地缓存并进行对比
    const status = await Promise.all(
      tables.map(async (table) => {
        // 获取 Supabase 数据数量（直接查询，不缓存）
        let supabaseCount = 0
        let syncError: string | null = null
        
        try {
          switch (table) {
            case 'items':
              const items = await getItemsFromSupabase()
              supabaseCount = items.length
              break
            case 'orders':
              const orders = await getOrdersFromSupabase({})
              supabaseCount = orders.length
              break
            case 'customers':
              const customers = await getCustomersFromSupabase()
              supabaseCount = customers.length
              break
            case 'categories':
              const categories = await getCategoriesFromSupabase()
              supabaseCount = categories.length
              break
          }
        } catch (error) {
          syncError = error instanceof Error ? error.message : 'Unknown error'
          console.error(`Failed to get ${table} count from Supabase:`, error)
        }
        
        return {
          table,
          supabaseCount,
          syncError,
        }
      })
    )
    
    return NextResponse.json({ status })
  } catch (error) {
    console.error('Error getting sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
