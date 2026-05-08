import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

function toMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: unknown; details?: unknown }
    const message = typeof maybe.message === 'string' ? maybe.message : undefined
    const details = typeof maybe.details === 'string' ? maybe.details : undefined
    if (message && details && !message.includes(details)) return `${message} (${details})`
    if (message) return message
  }
  return error instanceof Error ? error.message : 'Failed to fetch assets value'
}

export async function GET() {
  try {
    // 查询所有未出售的资产（status != 'sold'）
    // 注意：supabase-js 在网络抖动时可能抛出 fetch failed / ECONNRESET，做轻量重试并在最终失败时降级返回 200。
    let items: Array<{ purchase_price: unknown }> | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabaseServer
        .from('items')
        .select('purchase_price')
        .neq('status', 'sold')

      if (!error) {
        items = (data as Array<{ purchase_price: unknown }> | null) ?? []
        lastError = null
        break
      }

      lastError = error
      // 150ms, 400ms backoff
      if (attempt < 2) await sleep(attempt === 0 ? 150 : 400)
    }
    
    if (lastError) {
      const message = toMessage(lastError)
      console.error('Error fetching assets value:', lastError)
      // 降级：避免 UI 因为短暂网络/DB 抖动频繁 500
      return NextResponse.json(
        {
          totalPurchasePrice: 0,
          assetCount: 0,
          degraded: true,
          error: message,
          errorDetail: { code: 'ASSETS_VALUE_DEGRADED', message },
        },
        { status: 200 }
      )
    }
    
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
    const message = toMessage(error)
    console.error('Error fetching assets value:', error)
    // 最外层异常也降级为 200，避免前端把它当成致命错误
    return NextResponse.json(
      {
        totalPurchasePrice: 0,
        assetCount: 0,
        degraded: true,
        error: message,
        errorDetail: { code: 'ASSETS_VALUE_EXCEPTION', message },
      },
      { status: 200 }
    )
  }
}
