import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'

/**
 * 修复端点：同步已发货（in_progress）订单的资产状态为已租出
 * 仅处理 in_progress，待发货订单不占资产
 */
export async function POST() {
  try {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        order_items (
          id,
          item_id,
          subtotal,
          name
        )
      `)
      .eq('order_type', 'rental')
      .eq('status', 'in_progress')

    if (ordersError) throw ordersError

    let fixedCount = 0
    let errorCount = 0
    let skippedCount = 0
    let alreadyCorrectCount = 0
    const skippedItems: Array<{ orderId: string; itemName: string; reason: string }> = []
    const fixedItems: Array<{ itemId: string; itemName: string; oldStatus: string; newStatus: string }> = []

    // 遍历每个订单，更新关联的资产状态
    for (const order of orders || []) {
      if (!order.order_items || order.order_items.length === 0) {
        skippedItems.push({
          orderId: order.id,
          itemName: 'N/A',
          reason: '订单没有订单项'
        })
        continue
      }

      for (const orderItem of order.order_items) {
        // 检查 item_id 是否为空
        if (!orderItem.item_id || orderItem.item_id.trim() === '') {
          skippedCount++
          skippedItems.push({
            orderId: order.id,
            itemName: orderItem.name || '未知设备',
            reason: '订单项没有关联资产（item_id 为空）'
          })
          continue
        }

        // 根据是否有租金决定状态：有租金 → rented，无租金 → in_use
        const hasRent = (orderItem.subtotal || 0) > 0
        const newStatus = hasRent ? 'rented' : 'in_use'

        try {
          // 获取当前资产状态
          const { data: item, error: itemError } = await supabase
            .from('items')
            .select('id, status, name')
            .eq('id', orderItem.item_id)
            .single()

          if (itemError) {
            console.error(`Failed to fetch item ${orderItem.item_id}:`, itemError)
            errorCount++
            skippedItems.push({
              orderId: order.id,
              itemName: orderItem.name || '未知设备',
              reason: `无法找到资产 (${itemError.message})`
            })
            continue
          }

          // 如果状态不正确，更新它
          if (item && item.status !== newStatus) {
            const { error: updateError } = await supabase
              .from('items')
              .update({ status: newStatus })
              .eq('id', orderItem.item_id)

            if (updateError) {
              console.error(`Failed to update item ${orderItem.item_id} status:`, updateError)
              errorCount++
            } else {
              fixedCount++
              fixedItems.push({
                itemId: orderItem.item_id,
                itemName: item.name || orderItem.name || '未知设备',
                oldStatus: item.status,
                newStatus: newStatus
              })
              console.log(`Fixed item ${item.name || orderItem.item_id} (${orderItem.item_id}) status: ${item.status} → ${newStatus}`)
            }
          } else if (item && item.status === newStatus) {
            // 状态已经正确
            alreadyCorrectCount++
            console.log(`Item ${item.name || orderItem.item_id} (${orderItem.item_id}) status is already correct: ${newStatus}`)
          }
        } catch (error: any) {
          console.error(`Error processing item ${orderItem.item_id}:`, error)
          errorCount++
          skippedItems.push({
            orderId: order.id,
            itemName: orderItem.name || '未知设备',
            reason: `处理错误: ${error.message || '未知错误'}`
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `同步完成：修复了 ${fixedCount} 个资产状态，${alreadyCorrectCount} 个已正确，${errorCount} 个错误，${skippedCount} 个跳过（无关联资产）`,
      fixedCount,
      alreadyCorrectCount,
      errorCount,
      skippedCount,
      totalOrders: orders?.length || 0,
      fixedItems,
      skippedItems,
    })
  } catch (error: any) {
    console.error('Error syncing item statuses:', error)
    return apiError('ORDER_ITEM_STATUS_SYNC_FAILED', error.message || 'Failed to sync item statuses', 500)
  }
}
