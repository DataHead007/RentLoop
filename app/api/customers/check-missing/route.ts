import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { findOrCreateCustomer, updateCustomerStats } from '@/lib/supabase/queries'

// 解析客户信息的工具函数（与前端保持一致）
function parseCustomerInfo(text: string): {
  name: string
  phone: string
  email: string
  address: string
} {
  const result = {
    name: '',
    phone: '',
    email: '',
    address: '',
  }
  
  if (!text || !text.trim()) return result
  
  // 先提取邮箱（如果有）
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g
  const emailMatch = text.match(emailRegex)
  if (emailMatch && emailMatch[0]) {
    result.email = emailMatch[0].trim()
    text = text.replace(emailMatch[0], '')
  }
  
  // 查找手机号（11位，1开头，可能包含空格、横线）
  const phoneRegex = /1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/
  const phoneMatch = text.match(phoneRegex)
  
  if (phoneMatch && phoneMatch[0]) {
    const phoneIndex = phoneMatch.index!
    const phoneNumber = phoneMatch[0].replace(/[\s-]/g, '')
    
    result.phone = phoneNumber
    
    // 手机号前面的部分是姓名
    const namePart = text.substring(0, phoneIndex).trim()
    if (namePart) {
      // 移除"收货人:"、"姓名:"等前缀
      const cleanNamePart = namePart.replace(/^(收货人|姓名|客户)[:：]\s*/, '')
      const nameMatch = cleanNamePart.match(/^[\u4e00-\u9fa5]+/)
      result.name = nameMatch ? nameMatch[0].trim() : cleanNamePart.split(/\s+/)[0].trim()
    }
    
    // 手机号后面的部分是地址
    const addressPart = text.substring(phoneIndex + phoneMatch[0].length).trim()
    if (addressPart) {
      // 移除"地址信息:"、"地址:"等前缀
      result.address = addressPart
        .replace(/^(地址信息|地址)[:：]\s*/, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  } else {
    // 尝试固定电话
    const landlineRegex = /0\d{2,3}[\s-]?\d{7,8}/
    const landlineMatch = text.match(landlineRegex)
    
    if (landlineMatch && landlineMatch[0]) {
      const phoneIndex = landlineMatch.index!
      const phoneNumber = landlineMatch[0].replace(/[\s-]/g, '')
      
      result.phone = phoneNumber
      
      const namePart = text.substring(0, phoneIndex).trim()
      if (namePart) {
        const cleanNamePart = namePart.replace(/^(收货人|姓名|客户)[:：]\s*/, '')
        const nameMatch = cleanNamePart.match(/^[\u4e00-\u9fa5]+/)
        result.name = nameMatch ? nameMatch[0].trim() : cleanNamePart.split(/\s+/)[0].trim()
      }
      
      const addressPart = text.substring(phoneIndex + landlineMatch[0].length).trim()
      if (addressPart) {
        result.address = addressPart
          .replace(/^(地址信息|地址)[:：]\s*/, '')
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    } else {
      // 没有电话号码，尝试按空格分隔
      const parts = text.trim().split(/\s+/)
      if (parts.length >= 2) {
        const nameMatch = parts[0].match(/^[\u4e00-\u9fa5]+/)
        if (nameMatch) {
          result.name = nameMatch[0]
          result.address = parts.slice(1).join(' ')
        } else {
          result.name = parts[0]
          if (parts.length > 1) {
            result.address = parts.slice(1).join(' ')
          }
        }
      } else {
        result.name = text.trim()
      }
    }
  }
  
  return result
}

/**
 * 检查历史订单中未生成客户档案的数据
 */
export async function GET() {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:8',message:'GET: check-missing API called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // 1. 查询所有有客户姓名的订单（包括租赁和羽毛球订单）
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, customer_email, customer_address, customer_id, created_at, total_amount, start_date, service_date, order_type')
      .not('customer_name', 'is', null)
      .neq('customer_name', '')
    
    if (ordersError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:15',message:'GET: query orders ERROR',data:{error:ordersError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw ordersError
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:18',message:'GET: got all orders',data:{orderCount:allOrders?.length || 0,sampleOrders:allOrders?.slice(0,3).map(o => ({id:o.id.slice(0,8),customerName:o.customer_name,customerPhone:o.customer_phone,customerId:o.customer_id})) || []},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // 2. 获取所有有效的客户ID
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id')
    
    const validCustomerIds = new Set(allCustomers?.map(c => c.id) || [])
    
    // 3. 筛选出 customer_id 为 NULL 或 customer_id 无效的订单
    const ordersWithoutCustomer = allOrders?.filter(order => {
      // customer_id 为 NULL 或 customer_id 不存在于客户表中
      const hasNoCustomerId = !order.customer_id
      const hasInvalidCustomerId = order.customer_id && !validCustomerIds.has(order.customer_id)
      return hasNoCustomerId || hasInvalidCustomerId
    }) || []
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:146',message:'GET: filtered orders without customer',data:{totalOrders:allOrders?.length || 0,validCustomerCount:validCustomerIds.size,ordersWithoutCustomerCount:ordersWithoutCustomer.length,ordersWithNullCustomerId:allOrders?.filter(o => !o.customer_id).length || 0,ordersWithInvalidCustomerId:allOrders?.filter(o => o.customer_id && !validCustomerIds.has(o.customer_id)).length || 0,detailedBreakdown:allOrders?.map(o => ({orderId:o.id.slice(0,8),customerId:o.customer_id?.slice(0,8),hasCustomerId:!!o.customer_id,isValidCustomerId:o.customer_id ? validCustomerIds.has(o.customer_id) : false,customerName:o.customer_name?.substring(0,30)})) || []},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // 4. 统计唯一客户（按姓名+电话+邮箱组合）
    const uniqueCustomers = new Map<string, {
      name: string
      phone: string | null
      email: string | null
      address: string | null
      orderCount: number
      totalAmount: number
      orderIds: string[]
      firstOrderDate: string | null
      lastOrderDate: string | null
    }>()
    
    ordersWithoutCustomer?.forEach(order => {
      const key = `${order.customer_name || ''}|${order.customer_phone || ''}|${order.customer_email || ''}`
      
      if (!uniqueCustomers.has(key)) {
        uniqueCustomers.set(key, {
          name: order.customer_name,
          phone: order.customer_phone,
          email: order.customer_email,
          address: order.customer_address,
          orderCount: 0,
          totalAmount: 0,
          orderIds: [],
          firstOrderDate: null,
          lastOrderDate: null,
        })
      }
      
      const customer = uniqueCustomers.get(key)!
      customer.orderCount++
      customer.totalAmount += parseFloat(order.total_amount?.toString() || '0')
      customer.orderIds.push(order.id)
      
      // 更新最早和最晚订单日期（羽毛球订单使用 service_date，租赁订单使用 start_date）
      const orderDate = (order as any).order_type === 'badminton' && (order as any).service_date
        ? (order as any).service_date
        : order.start_date
      if (orderDate) {
        if (!customer.firstOrderDate || orderDate < customer.firstOrderDate) {
          customer.firstOrderDate = orderDate
        }
        if (!customer.lastOrderDate || orderDate > customer.lastOrderDate) {
          customer.lastOrderDate = orderDate
        }
      }
    })
    
    // 5. 查询所有订单统计
    const { count: totalOrdersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .not('customer_name', 'is', null)
      .neq('customer_name', '')
    
    // 6. 计算真正有效的已关联订单数（customer_id 存在且有效）
    const validLinkedOrders = allOrders?.filter(order => 
      order.customer_id && validCustomerIds.has(order.customer_id)
    ).length || 0
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:80',message:'GET: calculated valid linked orders',data:{totalOrders:allOrders?.length || 0,ordersWithCustomerId:allOrders?.filter(o => o.customer_id).length || 0,validLinkedOrders,invalidCustomerIds:allOrders?.filter(o => o.customer_id && !validCustomerIds.has(o.customer_id)).map(o => ({orderId:o.id.slice(0,8),customerId:o.customer_id?.slice(0,8),customerName:o.customer_name})) || []},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // 7. 查询当前客户总数
    const { count: currentCustomerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
    
    // 8. 检查客户统计是否准确（实际订单数 vs 客户表中的 total_orders 累加）
    const { data: allCustomersWithStats } = await supabase
      .from('customers')
      .select('id, total_orders')
    
    const totalOrdersFromCustomers = allCustomersWithStats?.reduce((sum, c) => sum + (c.total_orders || 0), 0) || 0
    const actualLinkedOrdersCount = validLinkedOrders
    
    return NextResponse.json({
      summary: {
        totalOrders: totalOrdersCount || 0,
        linkedOrders: validLinkedOrders,
        unlinkedOrders: ordersWithoutCustomer.length,
        uniqueMissingCustomers: uniqueCustomers.size,
        currentCustomerCount: currentCustomerCount || 0,
        invalidCustomerIds: allOrders?.filter(order => 
          order.customer_id && !validCustomerIds.has(order.customer_id)
        ).length || 0,
        // 新增：客户统计准确性检查
        totalOrdersFromCustomersTable: totalOrdersFromCustomers,
        actualLinkedOrdersCount: actualLinkedOrdersCount,
        statsMismatch: totalOrdersFromCustomers !== actualLinkedOrdersCount,
      },
      missingCustomers: Array.from(uniqueCustomers.values()).map(customer => ({
        ...customer,
        orderIds: customer.orderIds.slice(0, 5), // 只显示前5个订单ID
        totalOrderIds: customer.orderIds.length
      })),
      detailedOrders: ordersWithoutCustomer.slice(0, 50) // 只返回前50条详细记录
    })
  } catch (error) {
    console.error('Error checking missing customers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check missing customers' },
      { status: 500 }
    )
  }
}

/**
 * 修复缺失的客户档案（批量创建）
 */
export async function POST() {
  try {
    // 1. 查询所有有客户姓名的订单（包括租赁和羽毛球订单）
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, customer_email, customer_address, customer_id, total_amount, start_date, service_date, order_type')
      .not('customer_name', 'is', null)
      .neq('customer_name', '')
    
    if (ordersError) throw ordersError
    
    // 2. 获取所有有效的客户ID
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id')
    
    const validCustomerIds = new Set(allCustomers?.map(c => c.id) || [])
    
    // 3. 筛选出 customer_id 为 NULL 或 customer_id 无效的订单
    const ordersWithoutCustomer = allOrders?.filter(order => {
      // customer_id 为 NULL 或 customer_id 不存在于客户表中
      return !order.customer_id || !validCustomerIds.has(order.customer_id)
    }) || []
    
    if (ordersWithoutCustomer.length === 0) {
      return NextResponse.json({
        message: '没有需要修复的订单',
        created: 0,
        updated: 0
      })
    }
    
    // 4. 按客户分组（先解析再分组，确保正确识别唯一客户）
    const customerGroups = new Map<string, typeof ordersWithoutCustomer>()
    
    ordersWithoutCustomer.forEach(order => {
      // 尝试解析 customer_name（如果 phone 为空）
      let customerName = order.customer_name || ''
      let customerPhone = order.customer_phone || ''
      let customerEmail = order.customer_email || ''
      
      if (!customerPhone && customerName) {
        const parsed = parseCustomerInfo(customerName)
        if (parsed.name) customerName = parsed.name
        if (parsed.phone) customerPhone = parsed.phone
        if (parsed.email && !customerEmail) customerEmail = parsed.email
      }
      
      // 使用解析后的信息进行分组（优先使用手机号或邮箱作为唯一标识）
      const key = customerPhone 
        ? `${customerPhone}` // 如果有手机号，只用手机号分组
        : customerEmail 
        ? `${customerEmail}` // 如果有邮箱，用邮箱分组
        : `${customerName}` // 否则用姓名分组
      
      if (!customerGroups.has(key)) {
        customerGroups.set(key, [])
      }
      customerGroups.get(key)!.push(order)
    })
    
    let createdCount = 0
    let updatedCount = 0
    const errors: string[] = []
    
    // 3. 为每个唯一客户创建档案并关联订单
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:173',message:'POST: starting fix process',data:{totalGroups:customerGroups.size,groupKeys:Array.from(customerGroups.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    for (const [key, orders] of customerGroups.entries()) {
      const firstOrder = orders[0]
      let customerName = firstOrder.customer_name
      let customerPhone = firstOrder.customer_phone
      let customerEmail = firstOrder.customer_email
      let customerAddress = firstOrder.customer_address
      
      // 如果 customer_phone 为空但 customer_name 包含完整信息，尝试解析
      if ((!customerPhone || !customerPhone.trim()) && customerName && customerName.trim()) {
        const parsed = parseCustomerInfo(customerName)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:240',message:'POST: parsed customer_name',data:{originalName:customerName,parsedName:parsed.name,parsedPhone:parsed.phone,parsedAddress:parsed.address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (parsed.name) customerName = parsed.name
        if (parsed.phone) customerPhone = parsed.phone
        if (parsed.email && !customerEmail) customerEmail = parsed.email
        if (parsed.address && !customerAddress) customerAddress = parsed.address
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:250',message:'POST: processing customer group',data:{key,customerName,customerPhone,customerEmail,customerAddress,orderCount:orders.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      try {
        // 使用现有的 findOrCreateCustomer 函数
        const customer = await findOrCreateCustomer(
          customerName,
          customerPhone || null,
          customerEmail || null
        )
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:185',message:'POST: customer found/created',data:{customerId:customer.id,customerName:customer.name,ordersToLink:orders.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        const customerId = customer.id
        
        // 计算该客户的订单统计
        const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || '0'), 0)
        // 羽毛球订单使用 service_date，租赁订单使用 start_date
        const firstOrderDate = orders.reduce((min, o) => {
          const orderDate = (o as any).order_type === 'badminton' && (o as any).service_date
            ? (o as any).service_date
            : o.start_date
          if (!orderDate) return min
          return !min || orderDate < min ? orderDate : min
        }, null as string | null)
        
        const lastOrderDate = orders.reduce((max, o) => {
          const orderDate = (o as any).order_type === 'badminton' && (o as any).service_date
            ? (o as any).service_date
            : o.start_date
          if (!orderDate) return max
          return !max || orderDate > max ? orderDate : max
        }, null as string | null)
        
        // 更新客户统计信息
        // findOrCreateCustomer 已经为新客户设置了 total_orders=1，但对于现有客户，它已经更新了订单数
        // 我们需要计算这个客户总共有多少个订单需要关联
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('total_orders, total_amount, first_order_date, last_order_date')
          .eq('id', customerId)
          .single()
        
        // 判断是否是新创建的客户（通过比较创建前后的订单数）
        // findOrCreateCustomer 返回的 customer.total_orders 已经反映了创建/更新后的状态
        // 如果返回的订单数是1，且我们只有1个订单要关联，可能是新客户
        // 但实际上，findOrCreateCustomer 对现有客户也会+1，所以我们需要更准确的判断
        
        // 获取创建前的客户信息来判断（如果 customer.total_orders === orders.length === 1，可能是新客户）
        const wasNewCustomer = customer.total_orders === 1 && orders.length === 1
        
        if (existingCustomer) {
          // 计算应该有的总订单数（这些订单都应该计入）
          const shouldBeTotalOrders = orders.length
          // 计算当前已有的订单数（findOrCreateCustomer 可能已经更新过了）
          const currentOrders = existingCustomer.total_orders || 0
          
          // 如果当前订单数小于应该有的订单数，需要更新
          if (currentOrders < shouldBeTotalOrders) {
            const additionalOrders = shouldBeTotalOrders - currentOrders
            
            // 累加金额（这些订单的金额可能还没有计入）
            const newTotalAmount = parseFloat(existingCustomer.total_amount?.toString() || '0') + totalAmount
            
            await supabase
              .from('customers')
              .update({
                total_orders: shouldBeTotalOrders,
                total_amount: newTotalAmount,
                first_order_date: firstOrderDate || existingCustomer.first_order_date,
                last_order_date: lastOrderDate || existingCustomer.last_order_date,
                updated_at: new Date().toISOString(),
              })
              .eq('id', customerId)
          } else {
            // 订单数已经正确，只需要更新日期
            await supabase
              .from('customers')
              .update({
                first_order_date: firstOrderDate || existingCustomer.first_order_date,
                last_order_date: lastOrderDate || existingCustomer.last_order_date,
                updated_at: new Date().toISOString(),
              })
              .eq('id', customerId)
          }
        }
        
        // 4. 关联所有相关订单，同时更新解析出的客户信息
        const orderIds = orders.map(o => o.id)
        const updateData: any = { customer_id: customerId }
        
        // 如果解析出了手机号和地址，也更新订单
        if (customerPhone && customerPhone.trim()) {
          updateData.customer_phone = customerPhone.trim()
        }
        if (customerAddress && customerAddress.trim()) {
          updateData.customer_address = customerAddress.trim()
        }
        if (customerEmail && customerEmail.trim() && !updateData.customer_email) {
          updateData.customer_email = customerEmail.trim()
        }
        
        const { error: updateOrdersError } = await supabase
          .from('orders')
          .update(updateData)
          .in('id', orderIds)
        
        if (updateOrdersError) {
          throw new Error(`Failed to update orders: ${updateOrdersError.message}`)
        }
        
        // 统计创建和更新的客户数
        if (wasNewCustomer) {
          createdCount++
        } else {
          updatedCount++
        }
        
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/66c1fe55-59cf-4a6f-8b61-f7efccfabd51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'check-missing/route.ts:249',message:'POST: customer processing ERROR',data:{customerName,customerPhone,customerEmail,error:error instanceof Error ? error.message : 'Unknown error'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        const errorMsg = `处理客户 "${customerName}" 时出错: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(errorMsg, error)
      }
    }
    
    // 修复完成后，重新同步所有客户的统计信息
    // 这确保客户的 total_orders 和 total_amount 与实际订单数据一致
    try {
      const { data: allCustomersAfterFix } = await supabase
        .from('customers')
        .select('id')
      
      if (allCustomersAfterFix) {
        for (const customer of allCustomersAfterFix) {
          // 查询该客户的所有订单
          const { data: customerOrders } = await supabase
            .from('orders')
            .select('id, total_amount, start_date, service_date, order_type')
            .eq('customer_id', customer.id)
          
          if (customerOrders && customerOrders.length > 0) {
            // 去重订单
            const uniqueOrderIds = new Set(customerOrders.map(o => o.id))
            const uniqueOrders = Array.from(uniqueOrderIds).map(orderId => 
              customerOrders.find(o => o.id === orderId)!
            )
            
            // 重新计算统计
            const totalOrders = uniqueOrders.length
            const totalAmount = uniqueOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount?.toString() || '0') || 0), 0)
            
            // 计算订单日期（羽毛球订单使用 service_date，租赁订单使用 start_date）
            const orderDates = uniqueOrders
              .map(o => {
                const order = o as any
                return order.order_type === 'badminton' && order.service_date
                  ? order.service_date
                  : o.start_date
              })
              .filter((date): date is string => !!date)
              .sort()
            
            const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null
            const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null
            
            // 更新客户统计
            await supabase
              .from('customers')
              .update({
                total_orders: totalOrders,
                total_amount: totalAmount,
                first_order_date: firstOrderDate,
                last_order_date: lastOrderDate,
                updated_at: new Date().toISOString(),
              })
              .eq('id', customer.id)
          }
        }
      }
    } catch (syncError) {
      console.error('Error syncing customer stats after fix:', syncError)
      // 不阻断修复流程，只记录错误
    }
    
    return NextResponse.json({
      message: '客户档案修复完成，并已同步所有客户统计信息',
      created: createdCount,
      updated: updatedCount,
      totalProcessed: customerGroups.size,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error fixing missing customers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fix missing customers' },
      { status: 500 }
    )
  }
}
