import { NextResponse } from 'next/server'
import { getOrder, updateOrder, createTransaction } from '@/lib/supabase/queries'
import { supabase } from '@/lib/supabase/client'

// 辅助函数：根据订单状态更新资产状态
async function updateItemStatusesByOrderStatus(
  orderItems: Array<{ item_id: string | null; subtotal: number }>,
  newStatus: string,
  oldStatus?: string
) {
  if (!orderItems || orderItems.length === 0) {
    console.log('No order items to update')
    return
  }

  // 订单状态为待发货、进行中或已确认时，资产标记为已租出
  // 包括：in_progress/confirmed 正向流转，以及 in_progress→pending 回退（回退发货但订单仍有效）
  const shouldSetRented =
    newStatus === 'in_progress' ||
    newStatus === 'confirmed' ||
    (newStatus === 'pending' && oldStatus === 'in_progress')
  if (shouldSetRented) {
    for (const orderItem of orderItems) {
      if (orderItem.item_id && orderItem.item_id.trim() !== '') {
        const hasRent = (orderItem.subtotal || 0) > 0
        const newItemStatus = hasRent ? 'rented' : 'in_use'
        try {
          const { error } = await supabase
            .from('items')
            .update({ status: newItemStatus })
            .eq('id', orderItem.item_id)
          if (error) console.error(`Failed to update item ${orderItem.item_id} status:`, error)
          else console.log(`Updated item ${orderItem.item_id} status to ${newItemStatus} (order status: ${newStatus})`)
        } catch (error) {
          console.error(`Failed to update item ${orderItem.item_id} status:`, error)
        }
      }
    }
  }
  // 订单完成、取消，或 confirmed→pending 回退时，资产恢复可用
  else if (newStatus === 'completed' || newStatus === 'cancelled' || (newStatus === 'pending' && oldStatus === 'confirmed')) {
    for (const orderItem of orderItems) {
      if (orderItem.item_id && orderItem.item_id.trim() !== '') {
        try {
          const { error } = await supabase
            .from('items')
            .update({ status: 'available' })
            .eq('id', orderItem.item_id)
          if (error) console.error(`Failed to update item ${orderItem.item_id} status:`, error)
          else console.log(`Updated item ${orderItem.item_id} status to available (order status: ${newStatus})`)
        } catch (error) {
          console.error(`Failed to update item ${orderItem.item_id} status:`, error)
        }
      }
    }
  }
}

// 强制同步订单的资产状态（用于确保状态一致性）
async function forceSyncOrderItemStatuses(orderId: string) {
  try {
    // 重新获取完整的订单信息
    const order = await getOrder(orderId)
    
    if (!order || !order.order_items || order.order_items.length === 0) {
      console.log(`Order ${orderId} has no items to sync`)
      return
    }

    const orderStatus = order.status
    console.log(`Force syncing item statuses for order ${orderId} (status: ${orderStatus})`)

    // 根据订单状态同步资产状态
    await updateItemStatusesByOrderStatus(
      order.order_items.map(item => ({
        item_id: item.item_id,
        subtotal: item.subtotal || 0
      })),
      orderStatus
    )
  } catch (error) {
    console.error(`Failed to force sync order ${orderId} item statuses:`, error)
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const order = await getOrder(params.id)
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(order)
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const oldOrder = await getOrder(params.id)
    if (!oldOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const isBadminton = (oldOrder as any)?.order_type === 'badminton' || body.badminton_order_lines !== undefined

    if (isBadminton && body.badminton_order_lines !== undefined) {
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

      let totalAmount = 0
      for (const line of badminton_order_lines) {
        const amt = Math.abs(Number(line.amount)) || 0
        if (line.line_type === 'income') totalAmount += amt
        else totalAmount -= amt
      }

      const sd = service_date ? service_date.split('T')[0] : (oldOrder as any)?.service_date || oldOrder.start_date
      const updateData: any = {
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_address: null,
        start_date: sd,
        end_date: sd,
        total_amount: totalAmount,
        total_deposit: 0,
        total_shipping_cost: 0,
        notes: notes || null,
        status: status !== undefined ? status : oldOrder.status,
      }
      if (service_type !== undefined) updateData.service_type = service_type
      if (location !== undefined) updateData.location = location
      if (service_date !== undefined) updateData.service_date = sd
      if (service_start_time !== undefined) updateData.service_start_time = service_start_time || null
      if (service_end_time !== undefined) updateData.service_end_time = service_end_time || null
      await updateOrder(params.id, updateData)

      await supabase.from('badminton_order_lines').delete().eq('order_id', params.id)
      if (badminton_order_lines.length > 0) {
        const linesWithOrderId = badminton_order_lines.map((l: any) => ({
          order_id: params.id,
          line_type: l.line_type,
          category: l.category,
          amount: Math.abs(Number(l.amount)) || 0,
          notes: l.notes || null,
        }))
        const { error: linesErr } = await supabase.from('badminton_order_lines').insert(linesWithOrderId)
        if (linesErr) throw linesErr
      }

      const order = await getOrder(params.id)
      if (!order) throw new Error('Failed to retrieve updated order')
      
      // 如果订单已完成，同步更新交易记录
      if (order.status === 'completed') {
        try {
          // 1. 删除旧的自动交易记录
          await supabase
            .from('transactions')
            .delete()
            .eq('order_id', params.id)
            .eq('auto_created', true)
          
          // 2. 根据新的 badminton_order_lines 重新生成交易记录
          const badmintonLines = (order as any).badminton_order_lines as any[] | undefined
          if (badmintonLines && badmintonLines.length > 0) {
            const txDate = (order as any).service_date || order.end_date
            for (const line of badmintonLines) {
              const amt = Math.abs(Number(line.amount)) || 0
              if (amt <= 0) continue
              await createTransaction({
                order_id: order.id,
                item_id: null,
                type: line.line_type,
                amount: line.line_type === 'income' ? amt : -amt,
                category: line.category,
                description: `羽毛球订单 ${order.order_number || order.id.slice(0, 8)} - ${line.category}`,
                transaction_date: txDate,
                auto_created: true,
                business_line: 'badminton',
              })
            }
          }
        } catch (transactionError) {
          console.error('[Orders API] Failed to sync transactions after badminton order lines update', {
            orderId: params.id,
            context: 'badminton_order_lines_update',
            error: transactionError instanceof Error ? transactionError.message : String(transactionError),
            stack: transactionError instanceof Error ? transactionError.stack : undefined,
          })
        }
      }
      
      return NextResponse.json(order)
    }

    // 羽毛球订单：仅更新主表字段（状态、客户、服务日期等，不更新收支明细）
    if ((oldOrder as any)?.order_type === 'badminton' && body.badminton_order_lines === undefined) {
      const updateData: any = {}
      if (body.status !== undefined) updateData.status = body.status
      if (body.customer_name !== undefined) updateData.customer_name = body.customer_name
      if (body.customer_phone !== undefined) updateData.customer_phone = body.customer_phone
      if (body.customer_email !== undefined) updateData.customer_email = body.customer_email
      if (body.customer_address !== undefined) updateData.customer_address = body.customer_address
      if (body.notes !== undefined) updateData.notes = body.notes
      if (body.service_type !== undefined) updateData.service_type = body.service_type
      if (body.location !== undefined) updateData.location = body.location
      if (body.service_date !== undefined) {
        updateData.service_date = body.service_date
        updateData.start_date = body.service_date
        updateData.end_date = body.service_date
      }
      if (body.service_start_time !== undefined) updateData.service_start_time = body.service_start_time
      if (body.service_end_time !== undefined) updateData.service_end_time = body.service_end_time
      if (Object.keys(updateData).length > 0) {
        await updateOrder(params.id, updateData)
      }

      // 重新获取订单以获取最新的 badminton_order_lines
      const order = await getOrder(params.id)
      if (!order) throw new Error('Failed to retrieve updated order')

      // 如果订单状态从"已完成"回退，删除自动生成的交易记录
      if (oldOrder?.status === 'completed' && body.status !== 'completed' && body.status !== undefined) {
        try {
          await supabase
            .from('transactions')
            .delete()
            .eq('order_id', params.id)
            .eq('auto_created', true)
          
          console.log(`Deleted auto-created transactions for order ${params.id} (badminton order status reverted from completed)`)
        } catch (transactionError) {
          console.error('Failed to delete transactions on status revert:', transactionError)
        }
      }

      // 如果订单状态变为"已完成"，自动创建交易记录
      if (body.status === 'completed' && oldOrder?.status !== 'completed') {
        try {
          // 1. 先删除该订单的所有旧自动交易（支持状态回滚）
          await supabase
            .from('transactions')
            .delete()
            .eq('order_id', params.id)
            .eq('auto_created', true)
          
          // 2. 根据 badminton_order_lines 生成交易记录
          const badmintonLines = (order as any).badminton_order_lines as any[] | undefined
          if (badmintonLines && badmintonLines.length > 0) {
            const txDate = (order as any).service_date || order.end_date
            for (const line of badmintonLines) {
              const amt = Math.abs(Number(line.amount)) || 0
              if (amt <= 0) continue
              await createTransaction({
                order_id: order.id,
                item_id: null,
                type: line.line_type,
                amount: line.line_type === 'income' ? amt : -amt,
                category: line.category,
                description: `羽毛球订单 ${order.order_number || order.id.slice(0, 8)} - ${line.category}`,
                transaction_date: txDate,
                auto_created: true,
                business_line: 'badminton',
              })
            }
          }
        } catch (transactionError) {
          console.error('[Orders API] Failed to auto-create transactions for badminton order', {
            orderId: params.id,
            context: 'badminton_status_to_completed',
            error: transactionError instanceof Error ? transactionError.message : String(transactionError),
            stack: transactionError instanceof Error ? transactionError.stack : undefined,
          })
        }
      }

      return NextResponse.json(order)
    }

    if (body.order_items || body.third_party_rentals || body.shipping_fees) {
      // 完整更新订单（包括订单项等）
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
        notes,
        order_items,
        third_party_rentals,
        shipping_fees,
      } = body

      // 如果提供了 shipping_fees，自动重新计算 total_shipping_cost
      let calculatedShippingCost = total_shipping_cost
      if (shipping_fees !== undefined && shipping_fees.length > 0) {
        calculatedShippingCost = shipping_fees.reduce(
          (sum: number, fee: any) => sum + (Number(fee.amount) || 0),
          0
        )
      } else if (shipping_fees !== undefined && shipping_fees.length === 0) {
        // 如果 shipping_fees 是空数组，说明删除了所有运费
        calculatedShippingCost = 0
      }

      // 更新订单主记录
      const updatedOrder = await updateOrder(params.id, {
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_address: customer_address || null,
        start_date,
        end_date,
        total_amount,
        total_deposit,
        total_shipping_cost: calculatedShippingCost,
        notes: notes || null,
      })
      
      // 注意：本地缓存更新在客户端组件中处理

      // 更新订单项、游戏账号等（如果提供了）
      if (order_items !== undefined) {
        // 在删除现有订单项之前，先记录旧的订单项，用于恢复被删除资产的状态
        const oldOrderItems = oldOrder?.order_items || []
        const oldItemIds = oldOrderItems
          .map(item => item.item_id)
          .filter((id): id is string => !!id && id.trim() !== '')
        
        // 删除现有订单项，然后插入新的
        await supabase
          .from('order_items')
          .delete()
          .eq('order_id', params.id)
        
        // 记录新的订单项资产ID
        const newItemIds = order_items
          .filter((item: any) => item.item_id && item.item_id.trim() !== '')
          .map((item: any) => item.item_id)
        
        // 找出被删除的资产ID（在旧列表中有，但在新列表中没有）
        const removedItemIds = oldItemIds.filter(id => !newItemIds.includes(id))
        
        // 恢复被删除资产的状态为 available，并结束相关绑定
        if (removedItemIds.length > 0) {
          console.log(`Restoring status for removed items from order ${params.id}:`, removedItemIds)
          for (const itemId of removedItemIds) {
            try {
              // 结束该资产的绑定记录
              await supabase
                .from('item_account_bindings')
                .update({ bind_end_date: new Date().toISOString().split('T')[0] })
                .eq('account_item_id', itemId)
                .is('bind_end_date', null)
              
              const { error } = await supabase
                .from('items')
                .update({ status: 'available' })
                .eq('id', itemId)
              
              if (error) {
                console.error(`Failed to restore item ${itemId} status:`, error)
              } else {
                console.log(`Restored item ${itemId} status to available (removed from order)`)
              }
            } catch (error) {
              console.error(`Failed to restore item ${itemId} status:`, error)
            }
          }
        }
        
        if (order_items.length > 0) {
          const orderItemsWithOrderId = order_items
            .filter((item: any) => item.item_id && item.item_id.trim() !== '')
            .map((item: any) => ({
              ...item,
              order_id: params.id,
              item_id: item.item_id && item.item_id.trim() !== '' ? item.item_id : null,
              device_id: item.device_id && item.device_id.trim() !== '' ? item.device_id : null,
              account_binding_type: item.account_binding_type || null,
            }))
          
          if (orderItemsWithOrderId.length > 0) {
            const { data: insertedItems, error: itemsError } = await supabase
              .from('order_items')
              .insert(orderItemsWithOrderId)
              .select()
            
            if (itemsError) throw itemsError
            
            // 创建或更新账号绑定记录
            if (insertedItems && insertedItems.length > 0) {
              const itemIds = insertedItems
                .map((oi: any) => oi.item_id)
                .filter((id): id is string => !!id && id.trim() !== '')
              
              if (itemIds.length > 0) {
                const { data: items } = await supabase
                  .from('items')
                  .select('id, category:categories(name)')
                  .in('id', itemIds)
                
                if (items) {
                  const itemsMap = new Map(items.map((item: any) => [item.id, item]))
                  const bindingsToCreate: any[] = []
                  
                  for (const orderItem of insertedItems) {
                    const item = itemsMap.get(orderItem.item_id)
                    const isGameAccount = item?.category && (
                      (item.category as any)?.name === '数字版游戏账号' || 
                      (item.category as any)?.name?.includes('游戏账号')
                    )
                    
                    if (isGameAccount && orderItem.device_id && orderItem.account_binding_type) {
                      // 结束旧绑定
                      await supabase
                        .from('item_account_bindings')
                        .update({ bind_end_date: start_date || new Date().toISOString().split('T')[0] })
                        .eq('account_item_id', orderItem.item_id)
                        .eq('device_item_id', orderItem.device_id)
                        .is('bind_end_date', null)
                      
                      bindingsToCreate.push({
                        account_item_id: orderItem.item_id,
                        device_item_id: orderItem.device_id,
                        binding_type: orderItem.account_binding_type,
                        bind_start_date: start_date || new Date().toISOString().split('T')[0],
                        bind_end_date: null,
                        order_id: params.id,
                        order_item_id: orderItem.id,
                      })
                    } else if (isGameAccount && !orderItem.device_id) {
                      bindingsToCreate.push({
                        account_item_id: orderItem.item_id,
                        device_item_id: null,
                        binding_type: null,
                        bind_start_date: start_date || new Date().toISOString().split('T')[0],
                        bind_end_date: null,
                        order_id: params.id,
                        order_item_id: orderItem.id,
                      })
                    }
                  }
                  
                  if (bindingsToCreate.length > 0) {
                    await supabase
                      .from('item_account_bindings')
                      .insert(bindingsToCreate)
                  }
                }
              }
            }
          }
        }
      }

      if (third_party_rentals !== undefined) {
        // 删除现有记录，然后插入新的
        await supabase
          .from('third_party_rentals')
          .delete()
          .eq('order_id', params.id)
        
        if (third_party_rentals.length > 0) {
          const rentalsWithOrderId = third_party_rentals.map((rental: any) => ({
            ...rental,
            order_id: params.id
          }))
          
          const { error: rentalsError } = await supabase
            .from('third_party_rentals')
            .insert(rentalsWithOrderId)
          
          if (rentalsError) throw rentalsError
        }
      }

      if (shipping_fees !== undefined) {
        // 删除现有记录，然后插入新的
        await supabase
          .from('shipping_fees')
          .delete()
          .eq('order_id', params.id)
        
        if (shipping_fees.length > 0) {
          const feesWithOrderId = shipping_fees.map((fee: any) => ({
            ...fee,
            order_id: params.id
          }))
          
          const { error: feesError } = await supabase
            .from('shipping_fees')
            .insert(feesWithOrderId)
          
          if (feesError) throw feesError
        }
      }

      // 重新获取完整的订单数据
      const order = await getOrder(params.id)
      if (!order) throw new Error('Failed to retrieve updated order')
      
      // 无论订单状态是否变化，只要订单是进行中或已确认，都要检查并同步资产状态
      // 这样可以确保即使只更新了订单项，资产状态也会同步
      const currentOrderStatus = order.status
      const orderItemsUpdated = body.order_items !== undefined
      
      // 如果更新了订单项，或者订单状态是 in_progress、confirmed、completed 或 cancelled，都要同步资产状态
      if (currentOrderStatus === 'in_progress' || currentOrderStatus === 'confirmed' || currentOrderStatus === 'completed' || currentOrderStatus === 'cancelled') {
        if (order.order_items && order.order_items.length > 0) {
          const statusChanged = body.status !== undefined && body.status !== oldOrder?.status
          console.log(`Ensuring item statuses are synced for order ${params.id} (status: ${currentOrderStatus}, itemsUpdated: ${orderItemsUpdated}, statusChanged: ${statusChanged})`)
          await updateItemStatusesByOrderStatus(
            order.order_items.map(item => ({
              item_id: item.item_id,
              subtotal: item.subtotal || 0
            })),
            currentOrderStatus,
            oldOrder?.status
          )
        } else {
          console.warn(`Order ${params.id} has no order_items, cannot sync item statuses`)
        }
      } else if (body.status !== undefined && body.status !== oldOrder?.status) {
        // 即使状态不是上述几种，如果状态有变化，也要尝试同步（兼容未来可能的状态）
        if (order.order_items && order.order_items.length > 0) {
          console.log(`Syncing item statuses for order ${params.id} due to status change: ${oldOrder?.status || 'N/A'} → ${body.status}`)
          await updateItemStatusesByOrderStatus(
            order.order_items.map(item => ({
              item_id: item.item_id,
              subtotal: item.subtotal || 0
            })),
            body.status,
            oldOrder?.status
          )
        }
      } else if (orderItemsUpdated && (currentOrderStatus === 'in_progress' || currentOrderStatus === 'confirmed')) {
        // 如果只更新了订单项（没有状态变化），但订单是进行中或已确认，也要确保同步
        if (order.order_items && order.order_items.length > 0) {
          console.log(`Syncing item statuses for order ${params.id} after order items update (status: ${currentOrderStatus})`)
          await updateItemStatusesByOrderStatus(
            order.order_items.map(item => ({
              item_id: item.item_id,
              subtotal: item.subtotal || 0
            })),
            currentOrderStatus,
            oldOrder?.status
          )
        }
      }
      
      // 如果订单状态从"已完成"回退，删除自动生成的交易记录
      if (oldOrder?.status === 'completed' && body.status !== 'completed' && body.status !== undefined) {
        try {
          // 删除该订单的所有自动交易记录
          await supabase
            .from('transactions')
            .delete()
            .eq('order_id', params.id)
            .eq('auto_created', true)
          
          console.log(`Deleted auto-created transactions for order ${params.id} (status reverted from completed)`)
        } catch (transactionError) {
          console.error('Failed to delete transactions on status revert:', transactionError)
        }
      }
      
      // 如果订单状态变为"已完成"，自动创建交易记录（按方案2：拆分收支+资产级别交易）
      if (body.status === 'completed' && oldOrder?.status !== 'completed') {
        try {
          // 1. 先删除该订单的所有旧自动交易（支持状态回滚）
          await supabase
            .from('transactions')
            .delete()
            .eq('order_id', params.id)
            .eq('auto_created', true)
          
          // 2. 为每个订单项创建收入交易（资产级别）。行总金额 = (net_amount ?? subtotal) * quantity
          const lineAmount = (item: { net_amount: number | null; subtotal: number; quantity: number }) =>
            ((item.net_amount != null && item.net_amount > 0 ? item.net_amount : (item.subtotal || 0)) * (item.quantity || 1))

          if (order.order_items && order.order_items.length > 0) {
            const totalNetAmount = order.order_items.reduce((sum, item) => sum + lineAmount(item), 0)

            for (const orderItem of order.order_items) {
              const incomeAmount = lineAmount(orderItem)
              if (incomeAmount > 0 && orderItem.item_id) {
                await createTransaction({
                  order_id: order.id,
                  item_id: orderItem.item_id,
                  type: 'income',
                  amount: incomeAmount,
                  category: '租金收入',
                  description: `订单 ${order.order_number || order.id.slice(0, 8)} - ${orderItem.item?.name || '设备'}租金${orderItem.net_amount != null ? '（已扣除手续费）' : ''}${(orderItem.quantity || 1) > 1 ? ` x${orderItem.quantity}` : ''}`,
                  transaction_date: order.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
            // 物流成本：优先用订单汇总，若为 0 则从 shipping_fees 汇总
            let shippingCost = Number(order.total_shipping_cost) || 0
            if (shippingCost === 0 && order.shipping_fees?.length) {
              shippingCost = (order.shipping_fees as any[]).reduce((s, f) => s + (Number(f.amount) || 0), 0)
            }
            if (shippingCost > 0) {
              if (totalNetAmount > 0) {
                for (const orderItem of order.order_items) {
                  const itemAmount = lineAmount(orderItem)
                  if (itemAmount > 0 && orderItem.item_id) {
                    const allocationRatio = itemAmount / totalNetAmount
                    const allocatedShippingCost = shippingCost * allocationRatio
                    await createTransaction({
                      order_id: order.id,
                      item_id: orderItem.item_id,
                      type: 'expense',
                      amount: -allocatedShippingCost,
                      category: '物流支出',
                      description: `订单 ${order.order_number || order.id.slice(0, 8)} - ${orderItem.item?.name || '设备'}物流成本（按实际租金比例分摊）`,
                      transaction_date: order.end_date,
                      auto_created: true,
                      business_line: 'rental',
                    })
                  }
                }
              } else {
                // 无订单项或租金为 0 时，物流费用记为一笔支出（不分摊）
                await createTransaction({
                  order_id: order.id,
                  item_id: null,
                  type: 'expense',
                  amount: -shippingCost,
                  category: '物流支出',
                  description: `订单 ${order.order_number || order.id.slice(0, 8)} - 物流成本`,
                  transaction_date: order.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
          } else {
            // 无订单项但有物流费用时，记为一笔物流支出
            let shippingCostNoItems = Number(order.total_shipping_cost) || 0
            if (shippingCostNoItems === 0 && order.shipping_fees?.length) {
              shippingCostNoItems = (order.shipping_fees as any[]).reduce((s, f) => s + (Number(f.amount) || 0), 0)
            }
            if (shippingCostNoItems > 0) {
              await createTransaction({
                order_id: order.id,
                item_id: null,
                type: 'expense',
                amount: -shippingCostNoItems,
                category: '物流支出',
                description: `订单 ${order.order_number || order.id.slice(0, 8)} - 物流成本`,
                transaction_date: order.end_date,
                auto_created: true,
                business_line: 'rental',
              })
            }
          }
          
          if (order.third_party_rentals && order.third_party_rentals.length > 0) {
            for (const rental of order.third_party_rentals) {
              if (rental.rental_cost > 0) {
                await createTransaction({
                  order_id: order.id,
                  item_id: null,
                  type: 'expense',
                  amount: -rental.rental_cost,
                  category: '转租支出',
                  description: `订单 ${order.order_number || order.id.slice(0, 8)} - ${rental.game_name}转租成本`,
                  transaction_date: order.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
          }
          const badmintonLines = (order as any).badminton_order_lines as any[] | undefined
          if ((order as any).order_type === 'badminton' && badmintonLines?.length) {
            const txDate = (order as any).service_date || order.end_date
            for (const line of badmintonLines) {
              const amt = Math.abs(Number(line.amount)) || 0
              if (amt <= 0) continue
              await createTransaction({
                order_id: order.id,
                item_id: null,
                type: line.line_type,
                amount: line.line_type === 'income' ? amt : -amt,
                category: line.category,
                description: `羽毛球订单 ${order.order_number || order.id.slice(0, 8)} - ${line.category}`,
                transaction_date: txDate,
                auto_created: true,
                business_line: 'badminton',
              })
            }
          }
        } catch (transactionError) {
          console.error('[Orders API] Failed to auto-create transactions for rental order', {
            orderId: params.id,
            context: 'rental_status_to_completed',
            error: transactionError instanceof Error ? transactionError.message : String(transactionError),
            stack: transactionError instanceof Error ? transactionError.stack : undefined,
          })
        }
      }
      
      // 如果订单已完成且更新了订单项（但没有状态变化），需要重新生成交易记录
      // 注意：如果状态从 completed 变为其他状态，已在上面处理删除交易记录
      // 如果状态从其他状态变为 completed，已在上面处理创建交易记录
      if (order.status === 'completed' && body.order_items !== undefined && (body.status === undefined || body.status === 'completed')) {
        try {
          // 1. 删除旧的自动交易记录
          await supabase
            .from('transactions')
            .delete()
            .eq('order_id', params.id)
            .eq('auto_created', true)
          
          // 2. 重新生成交易记录（与 status→completed 逻辑一致：行总金额 = (net_amount??subtotal)*quantity）
          const lineAmountSync = (item: { net_amount: number | null; subtotal: number; quantity: number }) =>
            ((item.net_amount != null && item.net_amount > 0 ? item.net_amount : (item.subtotal || 0)) * (item.quantity || 1))

          if (order.order_items && order.order_items.length > 0) {
            const totalNetAmountSync = order.order_items.reduce((sum, item) => sum + lineAmountSync(item), 0)
            for (const orderItem of order.order_items) {
              const incomeAmount = lineAmountSync(orderItem)
              if (incomeAmount > 0 && orderItem.item_id) {
                await createTransaction({
                  order_id: order.id,
                  item_id: orderItem.item_id,
                  type: 'income',
                  amount: incomeAmount,
                  category: '租金收入',
                  description: `订单 ${order.order_number || order.id.slice(0, 8)} - ${orderItem.item?.name || '设备'}租金${orderItem.net_amount != null ? '（已扣除手续费）' : ''}${(orderItem.quantity || 1) > 1 ? ` x${orderItem.quantity}` : ''}`,
                  transaction_date: order.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
            let shippingCostSync = Number(order.total_shipping_cost) || 0
            if (shippingCostSync === 0 && order.shipping_fees?.length) {
              shippingCostSync = (order.shipping_fees as any[]).reduce((s, f) => s + (Number(f.amount) || 0), 0)
            }
            if (shippingCostSync > 0) {
              if (totalNetAmountSync > 0) {
                for (const orderItem of order.order_items) {
                  const itemAmount = lineAmountSync(orderItem)
                  if (itemAmount > 0 && orderItem.item_id) {
                    const allocationRatio = itemAmount / totalNetAmountSync
                    const allocatedShippingCost = shippingCostSync * allocationRatio
                    await createTransaction({
                      order_id: order.id,
                      item_id: orderItem.item_id,
                      type: 'expense',
                      amount: -allocatedShippingCost,
                      category: '物流支出',
                      description: `订单 ${order.order_number || order.id.slice(0, 8)} - ${orderItem.item?.name || '设备'}物流成本（按实际租金比例分摊）`,
                      transaction_date: order.end_date,
                      auto_created: true,
                      business_line: 'rental',
                    })
                  }
                }
              } else {
                await createTransaction({
                  order_id: order.id,
                  item_id: null,
                  type: 'expense',
                  amount: -shippingCostSync,
                  category: '物流支出',
                  description: `订单 ${order.order_number || order.id.slice(0, 8)} - 物流成本`,
                  transaction_date: order.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
          } else {
            let shippingCostNoItemsSync = Number(order.total_shipping_cost) || 0
            if (shippingCostNoItemsSync === 0 && order.shipping_fees?.length) {
              shippingCostNoItemsSync = (order.shipping_fees as any[]).reduce((s, f) => s + (Number(f.amount) || 0), 0)
            }
            if (shippingCostNoItemsSync > 0) {
              await createTransaction({
                order_id: order.id,
                item_id: null,
                type: 'expense',
                amount: -shippingCostNoItemsSync,
                category: '物流支出',
                description: `订单 ${order.order_number || order.id.slice(0, 8)} - 物流成本`,
                transaction_date: order.end_date,
                auto_created: true,
                business_line: 'rental',
              })
            }
          }

          if (order.third_party_rentals && order.third_party_rentals.length > 0) {
            for (const rental of order.third_party_rentals) {
              if (rental.rental_cost > 0) {
                await createTransaction({
                  order_id: order.id,
                  item_id: null,
                  type: 'expense',
                  amount: -rental.rental_cost,
                  category: '转租支出',
                  description: `订单 ${order.order_number || order.id.slice(0, 8)} - ${rental.game_name}转租成本`,
                  transaction_date: order.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
          }
        } catch (transactionError) {
          console.error('[Orders API] Failed to sync transactions after order items update', {
            orderId: params.id,
            context: 'order_items_update_completed',
            error: transactionError instanceof Error ? transactionError.message : String(transactionError),
            stack: transactionError instanceof Error ? transactionError.stack : undefined,
          })
        }
      }

      return NextResponse.json(order)
    } else {
      const order = await updateOrder(params.id, body)
      
      // 注意：本地缓存更新在客户端组件中处理
      
      // 强制重新加载订单以获取最新的 order_items
      // 因为 updateOrder 可能在某些情况下不返回完整的关联数据
      const fullOrder = await getOrder(params.id)
      
      if (fullOrder && fullOrder.order_items && fullOrder.order_items.length > 0) {
        const currentOrderStatus = fullOrder.status
        const statusChanged = body.status !== undefined && body.status !== oldOrder?.status
        
        // 无论状态是否变化，只要订单是 in_progress、confirmed、completed 或 cancelled，都要同步资产状态
        // 这样可以确保即使没有状态变化，资产状态也会保持同步
        if (currentOrderStatus === 'in_progress' || currentOrderStatus === 'confirmed' || currentOrderStatus === 'completed' || currentOrderStatus === 'cancelled') {
          console.log(`Ensuring item statuses are synced for order ${params.id} (status: ${currentOrderStatus}, statusChanged: ${statusChanged})`)
          await updateItemStatusesByOrderStatus(
            fullOrder.order_items.map(item => ({
              item_id: item.item_id,
              subtotal: item.subtotal || 0
            })),
            currentOrderStatus,
            oldOrder?.status
          )
        } else if (statusChanged) {
          // 即使状态不是上述几种，如果状态有变化，也要尝试同步
          console.log(`Syncing item statuses for order ${params.id} due to status change: ${oldOrder?.status || 'N/A'} → ${body.status}`)
          await updateItemStatusesByOrderStatus(
            fullOrder.order_items.map(item => ({
              item_id: item.item_id,
              subtotal: item.subtotal || 0
            })),
            body.status,
            oldOrder?.status
          )
        } else if (currentOrderStatus === 'pending' && oldOrder?.status && oldOrder.status !== 'pending') {
          // 订单回退到待处理状态，恢复资产状态为可用
          console.log(`Syncing item statuses for order ${params.id} reverted to pending from ${oldOrder.status}`)
          await updateItemStatusesByOrderStatus(
            fullOrder.order_items.map(item => ({
              item_id: item.item_id,
              subtotal: item.subtotal || 0
            })),
            'pending',
            oldOrder?.status
          )
        }
      } else {
        console.warn(`Order ${params.id} has no order_items after update, cannot sync item statuses`)
      }
      
      // 如果订单状态从"已完成"回退，删除自动生成的交易记录
      if (oldOrder?.status === 'completed' && body.status !== 'completed' && body.status !== undefined) {
        try {
          // 删除该订单的所有自动交易记录
          await supabase
            .from('transactions')
            .delete()
            .eq('order_id', params.id)
            .eq('auto_created', true)
          
          console.log(`Deleted auto-created transactions for order ${params.id} (status reverted from completed)`)
        } catch (transactionError) {
          console.error('Failed to delete transactions on status revert:', transactionError)
        }
      }
      
      // 如果订单状态变为"已完成"，自动创建交易记录
      if (body.status === 'completed' && oldOrder?.status !== 'completed') {
        try {
          // 显式获取最新完整订单数据，确保使用包含所有关联数据的订单
          const orderForTx = await getOrder(params.id)
          if (!orderForTx) throw new Error(`Order ${params.id} not found for transaction creation`)
          
          // 1. 先删除该订单的所有旧自动交易（支持状态回滚）
          await supabase
            .from('transactions')
            .delete()
            .eq('order_id', params.id)
            .eq('auto_created', true)
          
          // 2. 为每个订单项创建收入交易（资产级别）。行总金额 = (net_amount??subtotal)*quantity
          const lineAmountForTx = (item: { net_amount: number | null; subtotal: number; quantity: number }) =>
            ((item.net_amount != null && item.net_amount > 0 ? item.net_amount : (item.subtotal || 0)) * (item.quantity || 1))

          if (orderForTx.order_items && orderForTx.order_items.length > 0) {
            const totalNetAmountForTx = orderForTx.order_items.reduce((sum, item) => sum + lineAmountForTx(item), 0)
            for (const orderItem of orderForTx.order_items) {
              const incomeAmount = lineAmountForTx(orderItem)
              if (incomeAmount > 0 && orderItem.item_id) {
                await createTransaction({
                  order_id: orderForTx.id,
                  item_id: orderItem.item_id,
                  type: 'income',
                  amount: incomeAmount,
                  category: '租金收入',
                  description: `订单 ${orderForTx.order_number || orderForTx.id.slice(0, 8)} - ${orderItem.item?.name || '设备'}租金${orderItem.net_amount != null ? '（已扣除手续费）' : ''}${(orderItem.quantity || 1) > 1 ? ` x${orderItem.quantity}` : ''}`,
                  transaction_date: orderForTx.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
            let shippingCostForTx = Number(orderForTx.total_shipping_cost) || 0
            if (shippingCostForTx === 0 && orderForTx.shipping_fees?.length) {
              shippingCostForTx = (orderForTx.shipping_fees as any[]).reduce((s, f) => s + (Number(f.amount) || 0), 0)
            }
            if (shippingCostForTx > 0) {
              if (totalNetAmountForTx > 0) {
                for (const orderItem of orderForTx.order_items) {
                  const itemAmount = lineAmountForTx(orderItem)
                  if (itemAmount > 0 && orderItem.item_id) {
                    const allocationRatio = itemAmount / totalNetAmountForTx
                    const allocatedShippingCost = shippingCostForTx * allocationRatio
                    await createTransaction({
                      order_id: orderForTx.id,
                      item_id: orderItem.item_id,
                      type: 'expense',
                      amount: -allocatedShippingCost,
                      category: '物流支出',
                      description: `订单 ${orderForTx.order_number || orderForTx.id.slice(0, 8)} - ${orderItem.item?.name || '设备'}物流成本（按实际租金比例分摊）`,
                      transaction_date: orderForTx.end_date,
                      auto_created: true,
                      business_line: 'rental',
                    })
                  }
                }
              } else {
                await createTransaction({
                  order_id: orderForTx.id,
                  item_id: null,
                  type: 'expense',
                  amount: -shippingCostForTx,
                  category: '物流支出',
                  description: `订单 ${orderForTx.order_number || orderForTx.id.slice(0, 8)} - 物流成本`,
                  transaction_date: orderForTx.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
          } else {
            let shippingCostNoItemsForTx = Number(orderForTx.total_shipping_cost) || 0
            if (shippingCostNoItemsForTx === 0 && orderForTx.shipping_fees?.length) {
              shippingCostNoItemsForTx = (orderForTx.shipping_fees as any[]).reduce((s, f) => s + (Number(f.amount) || 0), 0)
            }
            if (shippingCostNoItemsForTx > 0) {
              await createTransaction({
                order_id: orderForTx.id,
                item_id: null,
                type: 'expense',
                amount: -shippingCostNoItemsForTx,
                category: '物流支出',
                description: `订单 ${orderForTx.order_number || orderForTx.id.slice(0, 8)} - 物流成本`,
                transaction_date: orderForTx.end_date,
                auto_created: true,
                business_line: 'rental',
              })
            }
          }

          if (orderForTx.third_party_rentals && orderForTx.third_party_rentals.length > 0) {
            for (const rental of orderForTx.third_party_rentals) {
              if (rental.rental_cost > 0) {
                await createTransaction({
                  order_id: orderForTx.id,
                  item_id: null,
                  type: 'expense',
                  amount: -rental.rental_cost,
                  category: '转租支出',
                  description: `订单 ${orderForTx.order_number || orderForTx.id.slice(0, 8)} - ${rental.game_name}转租成本`,
                  transaction_date: orderForTx.end_date,
                  auto_created: true,
                  business_line: 'rental',
                })
              }
            }
          }
          const badmintonLinesSimple = (orderForTx as any).badminton_order_lines as any[] | undefined
          if ((orderForTx as any).order_type === 'badminton' && badmintonLinesSimple?.length) {
            const txDate = (orderForTx as any).service_date || orderForTx.end_date
            for (const line of badmintonLinesSimple) {
              const amt = Math.abs(Number(line.amount)) || 0
              if (amt <= 0) continue
              await createTransaction({
                order_id: orderForTx.id,
                item_id: null,
                type: line.line_type,
                amount: line.line_type === 'income' ? amt : -amt,
                category: line.category,
                description: `羽毛球订单 ${orderForTx.order_number || orderForTx.id.slice(0, 8)} - ${line.category}`,
                transaction_date: txDate,
                auto_created: true,
                business_line: 'badminton',
              })
            }
          }
        } catch (transactionError) {
          console.error('[Orders API] Failed to auto-create transactions for rental order (status-only update)', {
            orderId: params.id,
            context: 'rental_status_only_to_completed',
            error: transactionError instanceof Error ? transactionError.message : String(transactionError),
            stack: transactionError instanceof Error ? transactionError.stack : undefined,
          })
        }
      }

      return NextResponse.json(order)
    }
  } catch (error: any) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update order' },
      { status: 500 }
    )
  }
}
