import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET() {
  try {
    // 查询所有未出售的资产（status != 'sold'）
    const { data: items, error } = await supabase
      .from('items')
      .select('purchase_price')
      .neq('status', 'sold')
    
    if (error) throw error
    
    // 计算总购买价格
    const totalPurchasePrice = items?.reduce((sum, item) => {
      const price = parseFloat(item.purchase_price?.toString() || '0') || 0
      return sum + price
    }, 0) || 0
    
    // 统计资产数量
    const assetCount = items?.length || 0
    
    return NextResponse.json({
      totalPurchasePrice,
      assetCount,
    })
  } catch (error) {
    console.error('Error fetching assets value:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assets value' },
      { status: 500 }
    )
  }
}
