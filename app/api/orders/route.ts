import { NextResponse } from 'next/server'
import { getOrders, createOrder, createBadmintonOrder, deleteOrder } from '@/lib/supabase/queries'
import { supabase } from '@/lib/supabase/client'
import { DataConsistencyLogger } from '@/lib/utils/logger'
import type { OrderItem, ThirdPartyRental, ShippingFee } from '@/lib/types/database'

export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const orderType = (searchParams.get('orderType') as 'rental' | 'badminton' | 'all') || 'all'

    const orders = await getOrders({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      orderType,
    })

    DataConsistencyLogger.logQuery(
      'Orders API',
      'orders:all',
      orders.map(o => ({ id: o.id, status: o.status, customer_name: o.customer_name })),
      {
        queryTime: `${Date.now() - startTime}ms`,
        filters: { startDate, endDate, orderType },
        clientInstance: 'shared',
      }
    )

    const statusCounts = {
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      in_progress: orders.filter(o => o.status === 'in_progress').length,
      completed: orders.filter(o => o.status === 'completed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
    }
    
    console.log(`[Orders API] Order Statistics:`, {
      total: orders.length,
      byStatus: statusCounts,
      totalTime: `${Date.now() - startTime}ms`,
    })
    
    return NextResponse.json(orders, {
      headers: {
        // 订单数据变化较频繁，使用较短的缓存时间：10秒内使用缓存，30秒内允许使用过期缓存
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    console.error('[Orders API] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      time: `${Date.now() - startTime}ms`,
    })
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orderType = (body.order_type as 'rental' | 'badminton') || 'rental'

    if (orderType === 'badminton') {
      const {
        customer_name,
        customer_phone,
        customer_email,
        service_type,
        location,
        service_date,
        service_start_time,
        service_end_time,
        status,
        notes,
        badminton_order_lines,
      } = body
      if (
        !customer_name ||
        !service_type ||
        !location ||
        !service_date ||
        !badminton_order_lines ||
        !Array.isArray(badminton_order_lines) ||
        badminton_order_lines.length === 0
      ) {
        return NextResponse.json(
          { error: '羽毛球订单：客户名称、服务类型、地点、服务日期和至少一笔收支明细是必需的' },
          { status: 400 }
        )
      }
      const order = await createBadmintonOrder(
        {
          customer_name,
          customer_phone: customer_phone || null,
          customer_email: customer_email || null,
          service_type,
          location,
          service_date,
          service_start_time: service_start_time || null,
          service_end_time: service_end_time || null,
          status: status || 'pending',
          notes: notes || null,
        },
        badminton_order_lines
      )
      return NextResponse.json(order, { status: 201 })
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      start_date,
      end_date,
      total_amount,
      total_deposit,
      total_shipping_cost,
      status,
      notes,
      order_items,
      third_party_rentals,
      shipping_fees,
      allowOverlap,
    } = body

    if (!customer_name || !start_date || !end_date || !order_items || order_items.length === 0) {
      return NextResponse.json(
        { error: '客户名称、起止日期和至少一个订单项是必需的' },
        { status: 400 }
      )
    }

    // 计算总金额和押金
    // 注意：subtotal 是单个物品的总租金（日租金 × 天数），需要乘以 quantity 才是该订单项的总金额
    // 后端总是重新计算总金额，以确保多个订单项正确累加，并验证前端传入的值
    // 使用 !== undefined 来区分"未提供"和"值为 0"的情况（用于押金和物流费用）
    
    // 1. 总金额：总是从订单项重新计算，确保多个订单项正确累加
    let calculatedTotal = 0
    order_items.forEach((item: Omit<OrderItem, 'id' | 'order_id' | 'created_at' | 'updated_at' | 'item'>) => {
      // subtotal 是单个物品的总租金，需要乘以 quantity 才是该订单项的总金额
      calculatedTotal += (item.subtotal || 0) * (item.quantity || 1)
    })
    
    // 2. 押金：只在未提供时从订单项计算（区分"未提供"和"值为 0"）
    const needsCalculateDeposit = total_deposit === undefined || total_deposit === null
    let calculatedDeposit = total_deposit ?? 0
    if (needsCalculateDeposit) {
      calculatedDeposit = 0 // 重置为 0，避免累加错误
      order_items.forEach((item: Omit<OrderItem, 'id' | 'order_id' | 'created_at' | 'updated_at' | 'item'>) => {
        calculatedDeposit += (item.deposit || 0) * (item.quantity || 1)
      })
      
      if (third_party_rentals) {
        third_party_rentals.forEach((rental: ThirdPartyRental) => {
          calculatedDeposit += rental.deposit || 0
        })
      }
    }
    
    // 3. 物流费用：只在未提供时从 shipping_fees 计算（区分"未提供"和"值为 0"）
    const needsCalculateShipping = total_shipping_cost === undefined || total_shipping_cost === null
    let calculatedShippingCost = total_shipping_cost ?? 0
    if (needsCalculateShipping && shipping_fees) {
      calculatedShippingCost = 0 // 重置为 0，避免累加错误
      shipping_fees.forEach((fee: ShippingFee) => {
        calculatedShippingCost += fee.amount || 0
      })
    }

    // 4. 校验资产在所选日期是否已被其他订单占用（allowOverlap 时跳过）
    const reqStart = String(start_date).split('T')[0]
    const reqEnd = String(end_date).split('T')[0]
    const itemIdsToCheck = order_items
      .filter((item: any) => item.item_id && item.item_id.trim() !== '')
      .map((item: any) => item.item_id)
    if (itemIdsToCheck.length > 0 && !allowOverlap) {
      const { data: overlappingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('order_type', 'rental')
        .in('status', ['pending', 'confirmed', 'in_progress'])
        .lte('start_date', reqEnd)
        .gte('end_date', reqStart)
      const orderIds = (overlappingOrders || []).map((o: { id: string }) => o.id)
      if (orderIds.length > 0) {
        const { data: occupiedRows } = await supabase
          .from('order_items')
          .select('item_id')
          .in('order_id', orderIds)
          .in('item_id', itemIdsToCheck)
        const occupiedItemIds = new Set((occupiedRows || []).map((r: { item_id: string }) => r.item_id))
        if (occupiedItemIds.size > 0) {
          const { data: itemNames } = await supabase
            .from('items')
            .select('id, name')
            .in('id', Array.from(occupiedItemIds))
          const names = (itemNames || []).map((i: { name: string }) => i.name).join('、')
          return NextResponse.json(
            { error: `资产「${names}」在所选日期已被预定，请选择其他日期或设备` },
            { status: 400 }
          )
        }
      }
    }

    // 创建订单
    const order = await createOrder(
      {
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_address: customer_address || null,
        customer_id: null, // 由 createOrder 函数自动处理
        start_date,
        end_date,
        total_amount: calculatedTotal, // 总租金（不包含物流费用）
        total_deposit: calculatedDeposit,
        total_shipping_cost: calculatedShippingCost, // 物流费用（单独记录）
        order_number: null, // 由数据库自动生成或前端生成
        status: status || 'pending',
        checkout_snapshot_url: null,
        checkin_snapshot_url: null,
        notes: notes || null,
      },
      order_items,
      third_party_rentals,
      shipping_fees
    )
    
    // 根据订单状态自动更新资产状态（仅发货后 in_progress/confirmed 才标记为已租出，pending 保持可用）
    const orderStatus = status || 'pending'
    if (orderStatus === 'in_progress' || orderStatus === 'confirmed') {
      // 订单进行中或已确认时，更新资产状态为已租出
      for (const orderItem of order_items) {
        if (orderItem.item_id && orderItem.item_id.trim() !== '') {
          // 根据是否有租金决定状态：有租金 → rented，无租金 → in_use
          const hasRent = (orderItem.subtotal || 0) > 0
          const newStatus = hasRent ? 'rented' : 'in_use'
          
          try {
            const { error: updateError } = await supabase
              .from('items')
              .update({ status: newStatus })
              .eq('id', orderItem.item_id)
            
            if (updateError) {
              console.error(`Failed to update item ${orderItem.item_id} status:`, updateError)
            } else {
              console.log(`Updated item ${orderItem.item_id} status to ${newStatus} (new order ${order.id})`)
            }
          } catch (error) {
            console.error(`Failed to update item ${orderItem.item_id} status:`, error)
            // 不阻断订单创建流程
          }
        }
      }
    }
    
    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }
    
    await deleteOrder(id)
    
    // 注意：本地缓存删除在客户端组件中处理
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    )
  }
}
