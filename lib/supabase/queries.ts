import { supabase } from './client'
import { supabaseServer } from './server'
import { createClient } from '@supabase/supabase-js'
// API 路由在服务端执行，使用 supabaseServer 绕过 RLS；客户端使用 anon key
const supabaseDb = typeof window === 'undefined' ? supabaseServer : supabase
import type { 
  Category, 
  Item, 
  Order, 
  Transaction, 
  ItemWithStats,
  OrderItem,
  ThirdPartyRental,
  ShippingFee,
  Customer,
  ItemAccountBinding,
  BadmintonOrderLine,
  FinancingLoan,
  FinancingLoanPayment,
} from '../types/database'
import type { BusinessPlate, CreatorChannel } from '../types/businessPlate'
import { normalizeTransactionPlateInput } from '@/lib/finance/transactionPlate'

const NON_OPERATING_INCOME_CATEGORIES = new Set(['融资放款入账'])
const NON_OPERATING_EXPENSE_CATEGORIES = new Set(['归还借款本金'])

// 品类查询
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabaseDb
    .from('categories')
    .select('*')
    .order('name')
  
  if (error) throw error
  return data || []
}

export async function createCategory(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
  const { data, error } = await supabaseDb
    .from('categories')
    .insert(category)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabaseDb
    .from('categories')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function updateCategory(
  id: string,
  updates: { name?: string; description?: string | null }
): Promise<Category> {
  const { data, error } = await supabaseDb
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 资产查询
export async function getItems(): Promise<Item[]> {
  const { data, error } = await supabaseDb
    .from('items')
    .select(`
      *,
      category:categories(*)
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

/**
 * 获取指定日期范围内可用的资产列表
 * 仅排除被已发货（in_progress）订单在重叠日期占用的资产，待发货订单不占
 * @param startDate 开始日期 YYYY-MM-DD
 * @param endDate 结束日期 YYYY-MM-DD
 * @param excludeOrderId 编辑订单时排除的订单 ID
 */
export async function getItemsAvailableForDateRange(
  startDate: string,
  endDate: string,
  excludeOrderId?: string | null
): Promise<Item[]> {
  const reqStart = startDate.split('T')[0] ?? startDate
  const reqEnd = endDate.split('T')[0] ?? endDate

  // 包含 rented/in_use，可用性仅由「该档期内是否有 in_progress 订单」决定，便于同一资产接不重叠档期
  const { data: items, error: itemsError } = await supabaseDb
    .from('items')
    .select(`
      *,
      category:categories(*)
    `)
    .in('status', ['available', 'retired', 'rented', 'in_use'])
    .order('created_at', { ascending: false })

  if (itemsError) throw itemsError
  if (!items || items.length === 0) return []

  // 仅已发货（in_progress）的订单占用档期，待发货（pending/confirmed）不占用，便于远期订单创建后仍可接其他档期
  let ordersQuery = supabaseDb
    .from('orders')
    .select('id')
    .eq('order_type', 'rental')
    .eq('status', 'in_progress')
    .lte('start_date', reqEnd)
    .gte('end_date', reqStart)

  if (excludeOrderId) {
    ordersQuery = ordersQuery.neq('id', excludeOrderId)
  }

  const { data: overlappingOrders, error: ordersError } = await ordersQuery
  if (ordersError) throw ordersError
  if (!overlappingOrders || overlappingOrders.length === 0) return items as Item[]

  const orderIds = overlappingOrders.map((o: { id: string }) => o.id)

  const { data: orderItems, error: oiError } = await supabaseDb
    .from('order_items')
    .select('item_id')
    .in('order_id', orderIds)

  if (oiError) throw oiError

  const occupiedItemIds = new Set(
    (orderItems || []).map((row: { item_id: string }) => row.item_id).filter(Boolean)
  )

  return (items as Item[]).filter((item) => !occupiedItemIds.has(item.id))
}

/** 占用档期信息，用于前端展示 */
export interface OccupancyPeriod {
  startDate: string
  endDate: string
}

/** 带占用信息的资产（用于新建订单资产选择） */
export interface ItemWithOccupancy extends Item {
  occupancyInfo?: {
    available: boolean
    conflictPeriods?: OccupancyPeriod[]
  }
}

/**
 * 获取带占用信息的资产列表（包含空闲 + 使用中）
 * 用于新建订单时展示全部资产，并按空闲/使用中分组
 */
export async function getItemsWithOccupancyInfo(
  startDate: string,
  endDate: string,
  excludeOrderId?: string | null
): Promise<ItemWithOccupancy[]> {
  const reqStart = startDate.split('T')[0] ?? startDate
  const reqEnd = endDate.split('T')[0] ?? endDate

  // 包含 rented/in_use 状态的资产，以便展示「使用中」分组
  const { data: items, error: itemsError } = await supabaseDb
    .from('items')
    .select(`
      *,
      category:categories(*)
    `)
    .in('status', ['available', 'retired', 'rented', 'in_use'])
    .order('created_at', { ascending: false })

  if (itemsError) throw itemsError
  if (!items || items.length === 0) return []

  // 仅已发货（in_progress）的订单计入占用档期，待发货订单不占
  let ordersQuery = supabaseDb
    .from('orders')
    .select('id, start_date, end_date')
    .eq('order_type', 'rental')
    .eq('status', 'in_progress')
    .lte('start_date', reqEnd)
    .gte('end_date', reqStart)

  if (excludeOrderId) {
    ordersQuery = ordersQuery.neq('id', excludeOrderId)
  }

  const { data: overlappingOrders, error: ordersError } = await ordersQuery
  if (ordersError) throw ordersError

  const itemOccupancy = new Map<
    string,
    { available: boolean; conflictPeriods: OccupancyPeriod[] }
  >()

  for (const item of items as Item[]) {
    // 状态为 rented/in_use 的资产默认为使用中，即使当前查不到重叠订单也展示在「使用中」分组
    const statusOccupied = item.status === 'rented' || item.status === 'in_use'
    itemOccupancy.set(item.id, { available: !statusOccupied, conflictPeriods: [] })
  }

  if (overlappingOrders && overlappingOrders.length > 0) {
    const orderIds = overlappingOrders.map((o: { id: string }) => o.id)
    const { data: orderItems, error: oiError } = await supabaseDb
      .from('order_items')
      .select('item_id, order_id')
      .in('order_id', orderIds)

    if (oiError) throw oiError

    const orderMap = new Map(
      overlappingOrders.map((o: { id: string; start_date: string; end_date: string }) => [
        o.id,
        { startDate: (o.start_date || '').split('T')[0], endDate: (o.end_date || '').split('T')[0] },
      ])
    )

    for (const row of orderItems || []) {
      const itemId = row.item_id as string
      if (!itemId) continue
      const period = orderMap.get(row.order_id as string)
      if (!period) continue
      const info = itemOccupancy.get(itemId)
      if (info) {
        info.available = false
        if (!info.conflictPeriods.some((p) => p.startDate === period.startDate && p.endDate === period.endDate)) {
          info.conflictPeriods.push(period)
        }
      }
    }
  }

  return (items as Item[]).map((item) => {
    const info = itemOccupancy.get(item.id)
    return {
      ...item,
      occupancyInfo: info
        ? { available: info.available, conflictPeriods: info.conflictPeriods }
        : undefined,
    } as ItemWithOccupancy
  })
}

export async function getItem(id: string): Promise<Item | null> {
  const { data, error } = await supabaseDb
    .from('items')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('id', id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

// 获取带统计信息的单个资产
export async function getItemWithStats(id: string): Promise<ItemWithStats | null> {
  const item = await getItem(id)
  if (!item) return null
  
  const stats = await getItemStats(id, item)
  // ROI 使用净收益计算：(净收益 / 总成本) × 100%
  // 总成本 = 购买成本 + 维护成本 + 其他所有支出
  const totalCost = stats.effectivePurchaseCost + stats.other_costs
  const roi = totalCost > 0 
    ? (stats.net_profit / totalCost) * 100 
    : 0

  const loans = await getFinancingLoans(id)
  const financing_principal_remaining = Math.round(
    loans
      .filter((l) => l.status === 'active')
      .reduce((acc, l) => acc + (parseFloat(String(l.principal_remaining ?? 0)) || 0), 0) * 100
  ) / 100
  
  return {
    ...item,
    total_revenue: stats.total_revenue,
    net_profit: stats.net_profit,
    total_days_rented: stats.total_days_rented,
    roi: Math.round(roi * 100) / 100, // 保留两位小数
    payback_progress_pct: stats.payback_progress_pct,
    payback_excess_amount: stats.payback_excess_amount,
    payback_remaining: stats.payback_remaining,
    financing_disbursement_total: stats.financing_disbursement_total,
    owner_equity_purchase: stats.owner_equity_purchase,
    operating_surplus: stats.operating_surplus,
    effective_purchase_cost: stats.effectivePurchaseCost,
    financing_principal_remaining,
  }
}

export async function createItem(item: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Promise<Item> {
  const { data, error } = await supabaseDb
    .from('items')
    .insert(item)
    .select(`
      *,
      category:categories(*)
    `)
    .single()
  
  if (error) throw error
  return data
}

export async function updateItem(id: string, item: Partial<Item>): Promise<Item> {
  const { data, error } = await supabaseDb
    .from('items')
    .update(item)
    .eq('id', id)
    .select(`
      *,
      category:categories(*)
    `)
    .single()
  
  if (error) throw error
  return data
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabaseDb
    .from('items')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// 获取资产统计信息（用于计算 ROI）- 优化版本：主要从 transactions 表查询
export async function getItemStats(
  itemId: string,
  item?: { purchase_price: number; sold_price?: number | null }
): Promise<{
  total_revenue: number
  net_profit: number
  total_days_rented: number
  effectivePurchaseCost: number
  other_costs: number
  financing_disbursement_total: number
  owner_equity_purchase: number
  operating_surplus: number
  payback_remaining: number
  payback_progress_pct: number
  payback_excess_amount: number
}> {
  // 1. 从 transactions 表查询该资产的所有交易（收入 + 支出）
  const { data: allTransactions, error: transactionsError } = await supabaseDb
    .from('transactions')
    .select('amount, type, category')
    .eq('item_id', itemId)
  
  if (transactionsError) throw transactionsError
  
  // 计算收入和支出（区分购买成本和其他成本）
  let total_revenue = 0
  let purchase_cost = 0  // 购买成本（从交易记录中获取）
  let other_costs = 0    // 其他成本（物流、转租等，不包括购买成本）
  let financing_disbursement_total = 0
  const purchaseCategories = new Set(['设备采购', '设备购买'])
  
  allTransactions?.forEach(tx => {
    const amount = parseFloat(tx.amount.toString()) || 0
    if (tx.type === 'income') {
      if (NON_OPERATING_INCOME_CATEGORIES.has(tx.category || '')) {
        financing_disbursement_total += Math.abs(amount)
      } else {
        total_revenue += amount
      }
    } else if (tx.type === 'expense') {
      const absAmount = Math.abs(amount)
      if (NON_OPERATING_EXPENSE_CATEGORIES.has(tx.category || '')) {
        return
      }
      // 区分购买成本和其他成本
      if (purchaseCategories.has(tx.category || '')) {
        purchase_cost += absAmount
      } else {
        other_costs += absAmount
      }
    }
  })
  
  // 如果没有交易记录中的购买成本，使用 items 表中的购买价格（向后兼容旧数据）
  const purchasePrice = item?.purchase_price || 0
  const effectivePurchaseCost = purchase_cost > 0 ? purchase_cost : purchasePrice

  const owner_equity_purchase = Math.max(0, effectivePurchaseCost - financing_disbursement_total)
  const operating_surplus = total_revenue - other_costs
  const payback_remaining = Math.max(0, effectivePurchaseCost - operating_surplus)
  const payback_excess_amount = Math.max(0, operating_surplus - effectivePurchaseCost)
  const payback_progress_pct =
    effectivePurchaseCost > 0
      ? Math.max(0, (operating_surplus / effectivePurchaseCost) * 100)
      : 0
  
  // 2. 计算总出租天数（仍需要查询 order_items，因为天数不是财务概念）
  const { data: orderItemsData, error: orderItemsError } = await supabaseDb
    .from('order_items')
    .select(`
      order:orders!inner(start_date, end_date, status)
    `)
    .eq('item_id', itemId)
    .in('order.status', ['completed', 'in_progress'])
  
  if (orderItemsError) throw orderItemsError
  
  const total_days_rented = orderItemsData?.reduce((sum, item) => {
    const order = item.order as any
    if (order?.start_date && order?.end_date) {
      const start = new Date(order.start_date)
      const end = new Date(order.end_date)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      return sum + days
    }
    return sum
  }, 0) || 0
  
  // 3. 计算净收益（以 transactions 为唯一真相）：总收入 - 购买成本 - 其他成本
  // 设备出售收入也应当以 transactions 中的"设备出售"收入交易为准（旧数据请通过回填脚本补齐）
  const net_profit = total_revenue - effectivePurchaseCost - other_costs
  
  return {
    total_revenue,
    net_profit,
    total_days_rented,
    effectivePurchaseCost,
    other_costs,
    financing_disbursement_total,
    owner_equity_purchase,
    operating_surplus,
    payback_remaining,
    payback_progress_pct: Math.round(payback_progress_pct * 100) / 100,
    payback_excess_amount,
  }
}

// 获取带统计信息的资产列表（优化版本：批量查询）
export async function getItemsWithStats(): Promise<ItemWithStats[]> {
  const items = await getItems()
  
  if (items.length === 0) return []
  
  const itemIds = items.map(item => item.id)
  
  // 批量查询所有资产的订单收入（一次性获取所有数据）
  const { data: allOrderItems, error: orderItemsError } = await supabaseDb
    .from('order_items')
    .select(`
      item_id,
      subtotal,
      order:orders!inner(start_date, end_date, status)
    `)
    .in('item_id', itemIds)
    .in('order.status', ['completed', 'in_progress'])
  
  if (orderItemsError) throw orderItemsError
  
  // 批量查询所有资产的交易记录（收入和支出）- 一次性获取所有数据
  const { data: allTransactions, error: transactionsError } = await supabaseDb
    .from('transactions')
    .select('item_id, amount, type, category')
    .in('item_id', itemIds)
  
  if (transactionsError) throw transactionsError

  const { data: activeLoanRows, error: activeLoanErr } = await supabaseDb
    .from('financing_loans')
    .select('item_id, principal_remaining, status')
    .eq('status', 'active')
    .in('item_id', itemIds)

  if (activeLoanErr) throw activeLoanErr

  const financingPrincipalByItem = (activeLoanRows || []).reduce(
    (acc, row: { item_id: string; principal_remaining: unknown }) => {
      const id = row.item_id
      const pr = parseFloat(String(row.principal_remaining ?? 0)) || 0
      acc[id] = (acc[id] || 0) + pr
      return acc
    },
    {} as Record<string, number>
  )

  // 将数据按 item_id 分组，便于后续计算
  const orderItemsByItem = (allOrderItems || []).reduce((acc, item) => {
    if (!acc[item.item_id]) acc[item.item_id] = []
    acc[item.item_id].push(item)
    return acc
  }, {} as Record<string, any[]>)
  
  const transactionsByItem = (allTransactions || []).reduce((acc, tx) => {
    if (!acc[tx.item_id]) acc[tx.item_id] = []
    acc[tx.item_id].push(tx)
    return acc
  }, {} as Record<string, any[]>)
  
  // 在内存中计算每个资产的统计数据（无需额外查询）
  const itemsWithStats = items.map((item) => {
    const orderItems = orderItemsByItem[item.id] || []
    const transactions = transactionsByItem[item.id] || []
    
    // 计算总出租天数（仍需从 order_items 获取）
    const total_days_rented = orderItems.reduce((sum, oi) => {
      const order = oi.order as any
      if (order?.start_date && order?.end_date) {
        const start = new Date(order.start_date)
        const end = new Date(order.end_date)
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        return sum + days
      }
      return sum
    }, 0)
    
    // 从 transactions 表计算收入和支出（区分购买成本和其他成本）
    let total_revenue = 0
    let purchase_cost = 0  // 购买成本（从交易记录中获取）
    let other_costs = 0    // 其他成本（物流、转租等，不包括购买成本）
    let financing_disbursement_total = 0
    const purchaseCategories = new Set(['设备采购', '设备购买'])
    
    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount.toString()) || 0
      if (tx.type === 'income') {
        if (NON_OPERATING_INCOME_CATEGORIES.has(tx.category || '')) {
          financing_disbursement_total += Math.abs(amount)
        } else {
          total_revenue += amount
        }
      } else if (tx.type === 'expense') {
        const absAmount = Math.abs(amount)
        if (NON_OPERATING_EXPENSE_CATEGORIES.has(tx.category || '')) {
          return
        }
        // 区分购买成本和其他成本
        if (purchaseCategories.has(tx.category || '')) {
          purchase_cost += absAmount
        } else {
          other_costs += absAmount
        }
      }
    })
    
    // 如果没有交易记录中的购买成本，使用 items 表中的购买价格（向后兼容旧数据）
    const purchasePrice = item.purchase_price || 0
    const effectivePurchaseCost = purchase_cost > 0 ? purchase_cost : purchasePrice

    const owner_equity_purchase = Math.max(0, effectivePurchaseCost - financing_disbursement_total)
    const operating_surplus = total_revenue - other_costs
    const payback_remaining = Math.max(0, effectivePurchaseCost - operating_surplus)
    const payback_excess_amount = Math.max(0, operating_surplus - effectivePurchaseCost)
    const payback_progress_pct =
      effectivePurchaseCost > 0
        ? Math.max(0, (operating_surplus / effectivePurchaseCost) * 100)
        : 0
    
    // 计算净收益（以 transactions 为唯一真相）：总收入 - 购买成本 - 其他成本
    // 设备出售收入也应当以 transactions 中的"设备出售"收入交易为准（旧数据请通过回填脚本补齐）
    const net_profit = total_revenue - effectivePurchaseCost - other_costs
    
    // ROI 使用净收益计算：(净收益 / 总成本) × 100%
    // 总成本 = 购买成本 + 维护成本 + 其他所有支出
    const totalCost = effectivePurchaseCost + other_costs
    const roi = totalCost > 0 
      ? (net_profit / totalCost) * 100 
      : 0
    
    return {
      ...item,
      total_revenue,
      net_profit,
      total_days_rented,
      roi: Math.round(roi * 100) / 100, // 保留两位小数
      payback_progress_pct: Math.round(payback_progress_pct * 100) / 100,
      payback_excess_amount,
      payback_remaining,
      financing_disbursement_total,
      owner_equity_purchase,
      operating_surplus,
      effective_purchase_cost: effectivePurchaseCost,
      financing_principal_remaining: Math.round((financingPrincipalByItem[item.id] || 0) * 100) / 100,
    }
  })
  
  return itemsWithStats
}

// 订单查询（日期筛选按业务日期：租赁用 start_date，羽毛球用 service_date）
export async function getOrders(
  opts?: { startDate?: string; endDate?: string; orderType?: 'rental' | 'badminton' | 'all' }
): Promise<Order[]> {
  const { startDate, endDate, orderType = 'all' } = opts || {}
  let query = supabaseDb
    .from('orders')
    .select(`
      *,
      customer:customers(*),
      order_items:order_items(*, 
        item:items!item_id(*, category:categories(*)),
        device:items!device_id(*, category:categories(*))
      ),
      third_party_rentals:third_party_rentals(*),
      shipping_fees:shipping_fees(*),
      badminton_order_lines:badminton_order_lines(*)
    `)

  if (startDate && endDate) {
    if (orderType === 'rental') {
      query = query.eq('order_type', 'rental').gte('start_date', startDate).lte('start_date', endDate)
    } else if (orderType === 'badminton') {
      query = query.eq('order_type', 'badminton').gte('service_date', startDate).lte('service_date', endDate)
    } else {
      query = query.or(
        `and(order_type.eq.rental,start_date.gte.${startDate},start_date.lte.${endDate}),and(order_type.eq.badminton,service_date.gte.${startDate},service_date.lte.${endDate})`
      )
    }
  } else {
    if (orderType !== 'all') query = query.eq('order_type', orderType)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/** 按幂等键查找已创建订单（用于 POST 重试去重） */
export async function findOrderByIdempotencyKey(key: string): Promise<Order | null> {
  const { data, error } = await supabaseDb
    .from('orders')
    .select('id')
    .eq('idempotency_key', key)
    .maybeSingle()
  if (error || !data?.id) return null
  return getOrder(data.id)
}

export async function getOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabaseDb
    .from('orders')
    .select(`
      *,
      customer:customers(*),
      order_items:order_items(*, 
        item:items!item_id(*, category:categories(*)),
        device:items!device_id(*, category:categories(*))
      ),
      third_party_rentals:third_party_rentals(*),
      shipping_fees:shipping_fees(*),
      badminton_order_lines:badminton_order_lines(*)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    // 未找到订单时返回 null，交由上层路由返回 404
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// 创建订单（支持多设备、配件等）
export async function createOrder(
  order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'order_items' | 'game_accounts' | 'third_party_rentals' | 'shipping_fees' | 'customer'>,
  orderItems: Array<Omit<OrderItem, 'id' | 'order_id' | 'created_at' | 'updated_at' | 'item'>>,
  thirdPartyRentals?: Array<Omit<ThirdPartyRental, 'id' | 'order_id' | 'created_at' | 'updated_at'>>,
  shippingFees?: Array<Omit<ShippingFee, 'id' | 'order_id' | 'created_at' | 'updated_at'>>
): Promise<Order> {
  // 0. 自动处理客户档案（查找或创建）
  let customerId: string | null = order.customer_id || null
  if (!customerId && order.customer_name) {
    try {
      const customer = await findOrCreateCustomer(
        order.customer_name,
        order.customer_phone || null,
        order.customer_email || null
      )
      customerId = customer.id
      console.log(`[Customer] Successfully created/found customer: ${customer.name} (ID: ${customer.id}, Phone: ${customer.phone || 'N/A'}, Email: ${customer.email || 'N/A'})`)
    } catch (error) {
      console.error('[Customer] Failed to find or create customer:', {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      // 不阻断订单创建流程，继续使用 customer_name
      // 但会在订单中保留 customer_name，后续可以手动关联
    }
  }

  const orderDataToInsert = {
    ...order,
    customer_id: customerId,
    order_type: (order as any).order_type ?? 'rental',
  }

  const { data: orderData, error: orderError } = await supabaseDb
    .from('orders')
    .insert(orderDataToInsert)
    .select()
    .single()
  
  if (orderError) {
    throw orderError
  }
  
  const orderId = orderData.id

  // 1.5. 更新客户统计信息（累计消费金额）
  if (customerId && order.total_amount) {
    try {
      await updateCustomerStats(customerId, order.total_amount, true)
    } catch (error) {
      console.error('Failed to update customer stats:', error)
      // 不阻断订单创建流程
    }
  }
  
  // 2. 创建订单项
  let createdOrderItems: any[] = []
  if (orderItems.length > 0) {
    // 确保 item_id 为空字符串时转换为 null
    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: orderId,
      item_id: item.item_id && item.item_id.trim() !== '' ? item.item_id : null,
      device_id: item.device_id && item.device_id.trim() !== '' ? item.device_id : null,
      account_binding_type: item.account_binding_type || null,
    }))
    
    const { data: insertedItems, error: itemsError } = await supabaseDb
      .from('order_items')
      .insert(orderItemsWithOrderId)
      .select()
    
    if (itemsError) throw itemsError
    createdOrderItems = insertedItems || []
  }
  
  // 3. 创建账号绑定记录（如果有游戏账号绑定设备）
  if (createdOrderItems.length > 0) {
    // 获取所有订单项对应的资产信息，以判断是否是游戏账号
    const itemIds = createdOrderItems
      .map(oi => oi.item_id)
      .filter((id): id is string => !!id && id.trim() !== '')
    
    if (itemIds.length > 0) {
      const { data: items, error: itemsError } = await supabaseDb
        .from('items')
        .select('id, category:categories(name)')
        .in('id', itemIds)
      
      if (!itemsError && items) {
        const itemsMap = new Map(items.map(item => [item.id, item]))
        
        // 为每个有设备绑定的游戏账号创建绑定记录
        const bindingsToCreate: any[] = []
        for (const orderItem of createdOrderItems) {
          const item = itemsMap.get(orderItem.item_id)
          const isGameAccount = item?.category && (
            (item.category as any)?.name === '数字版游戏账号' || 
            (item.category as any)?.name?.includes('游戏账号')
          )
          
          // 如果是游戏账号且绑定了设备
          if (isGameAccount && orderItem.device_id && orderItem.account_binding_type) {
            // 先结束该账号在该设备上的旧绑定（如果有）
            await supabaseDb
              .from('item_account_bindings')
              .update({ bind_end_date: order.start_date.split('T')[0] })
              .eq('account_item_id', orderItem.item_id)
              .eq('device_item_id', orderItem.device_id)
              .is('bind_end_date', null)
            
            // 创建新绑定记录
            bindingsToCreate.push({
              account_item_id: orderItem.item_id,
              device_item_id: orderItem.device_id,
              binding_type: orderItem.account_binding_type,
              bind_start_date: order.start_date.split('T')[0],
              bind_end_date: null, // NULL表示当前绑定
              order_id: orderId,
              order_item_id: orderItem.id,
            })
          } else if (isGameAccount && !orderItem.device_id) {
            // 如果游戏账号单独租赁（不绑定设备），也创建一条记录（device_item_id 为 NULL）
            bindingsToCreate.push({
              account_item_id: orderItem.item_id,
              device_item_id: null,
              binding_type: null,
              bind_start_date: order.start_date.split('T')[0],
              bind_end_date: null,
              order_id: orderId,
              order_item_id: orderItem.id,
            })
          }
        }
        
        if (bindingsToCreate.length > 0) {
          const { error: bindingsError } = await supabaseDb
            .from('item_account_bindings')
            .insert(bindingsToCreate)
          
          if (bindingsError) {
            console.error('Error creating account bindings:', bindingsError)
            // 不抛出错误，因为订单已经创建成功
          }
        }
      }
    }
  }
  
  // 4. 创建第三方租赁记录（如果需要）
  if (thirdPartyRentals && thirdPartyRentals.length > 0) {
    const rentalsWithOrderId = thirdPartyRentals.map(rental => ({
      ...rental,
      order_id: orderId
    }))
    
    const { error: rentalsError } = await supabaseDb
      .from('third_party_rentals')
      .insert(rentalsWithOrderId)
    
    if (rentalsError) throw rentalsError
  }
  
  // 5. 创建物流费用记录（如果需要）
  if (shippingFees && shippingFees.length > 0) {
    const feesWithOrderId = shippingFees.map(fee => ({
      ...fee,
      order_id: orderId
    }))
    
    const { error: feesError } = await supabaseDb
      .from('shipping_fees')
      .insert(feesWithOrderId)
    
    if (feesError) throw feesError
  }
  
  // 6. 更新客户统计信息（累计消费金额）
  if (customerId && order.total_amount) {
    try {
      await updateCustomerStats(customerId, order.total_amount, true)
    } catch (error) {
      console.error('Failed to update customer stats:', error)
      // 不阻断订单创建流程
    }
  }
  
  // 7. 返回完整的订单数据
  const fullOrder = await getOrder(orderId)
  if (!fullOrder) throw new Error('Failed to retrieve created order')
  
  return fullOrder
}

export type CreateBadmintonOrderInput = {
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  /** 若提供则直接关联该客户档案，不再按姓名/电话自动合并 */
  customer_id?: string | null
  service_type: string
  location: string
  service_date: string
  service_start_time?: string | null
  service_end_time?: string | null
  status?: Order['status']
  notes?: string | null
  idempotency_key?: string | null
}

export type CreateBadmintonOrderLineInput = {
  line_type: 'income' | 'expense'
  category: string
  amount: number
  notes?: string | null
}

export async function createBadmintonOrder(
  order: CreateBadmintonOrderInput,
  lines: CreateBadmintonOrderLineInput[]
): Promise<Order> {
  if (!lines.length) throw new Error('羽毛球订单至少需要一笔收支明细')

  let customerId: string | null = null
  const explicitId =
    typeof order.customer_id === 'string' && order.customer_id.trim() !== '' ? order.customer_id.trim() : null
  if (explicitId) {
    customerId = explicitId
  } else if (order.customer_name) {
    try {
      const customer = await findOrCreateCustomer(
        order.customer_name,
        order.customer_phone ?? null,
        order.customer_email ?? null
      )
      customerId = customer.id
    } catch (e) {
      console.error('[Customer] createBadmintonOrder findOrCreate:', e)
    }
  }

  let totalAmount = 0
  for (const line of lines) {
    const amt = Math.abs(Number(line.amount)) || 0
    if (line.line_type === 'income') totalAmount += amt
    else totalAmount -= amt
  }

  const sd = order.service_date.split('T')[0]
  const orderRow = {
    order_type: 'badminton' as const,
    customer_id: customerId,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone ?? null,
    customer_email: order.customer_email ?? null,
    customer_address: null,
    start_date: sd,
    end_date: sd,
    total_amount: totalAmount,
    total_deposit: 0,
    total_shipping_cost: 0,
    status: order.status ?? 'pending',
    checkout_snapshot_url: null,
    checkin_snapshot_url: null,
    notes: order.notes ?? null,
    order_number: null,
    service_type: order.service_type,
    location: order.location,
    service_date: sd,
    service_start_time: order.service_start_time ?? null,
    service_end_time: order.service_end_time ?? null,
    ...(order.idempotency_key ? { idempotency_key: order.idempotency_key } : {}),
  }

  const { data: orderData, error: orderErr } = await supabaseDb
    .from('orders')
    .insert(orderRow)
    .select()
    .single()
  if (orderErr) throw orderErr
  const orderId = orderData.id

  if (customerId && totalAmount > 0) {
    try { await updateCustomerStats(customerId, totalAmount, true) } catch (e) { console.error(e) }
  }

  const linesWithOrderId = lines.map((l) => ({
    order_id: orderId,
    line_type: l.line_type,
    category: l.category,
    amount: Math.abs(Number(l.amount)) || 0,
    notes: l.notes ?? null,
  }))
  const { error: linesErr } = await supabaseDb.from('badminton_order_lines').insert(linesWithOrderId)
  if (linesErr) throw linesErr

  const full = await getOrder(orderId)
  if (!full) throw new Error('Failed to retrieve created badminton order')
  return full
}

export async function updateOrder(
  id: string, 
  order: Partial<Omit<Order, 'id' | 'created_at' | 'updated_at' | 'order_items' | 'game_accounts' | 'third_party_rentals' | 'shipping_fees' | 'customer'>>
): Promise<Order> {
  // 若请求体显式携带 customer_id（含置为 null 解除关联），则不再自动 findOrCreate
  const customerIdExplicit = Object.prototype.hasOwnProperty.call(order, 'customer_id')

  if (
    !customerIdExplicit &&
    (order.customer_name || order.customer_phone !== undefined || order.customer_email !== undefined)
  ) {
    let customerId: string | null = order.customer_id || null

    if (!customerId) {
      const { data: existingOrder } = await supabaseDb
        .from('orders')
        .select('customer_name, customer_phone, customer_email, customer_id')
        .eq('id', id)
        .single()

      const name = order.customer_name || existingOrder?.customer_name || ''
      const phone = order.customer_phone !== undefined ? order.customer_phone : existingOrder?.customer_phone || null
      const email = order.customer_email !== undefined ? order.customer_email : existingOrder?.customer_email || null

      if (name) {
        try {
          const customer = await findOrCreateCustomer(name, phone, email)
          customerId = customer.id
          order.customer_id = customerId
          console.log(`[Customer] Successfully created/found customer in updateOrder: ${customer.name} (ID: ${customer.id})`)
        } catch (error) {
          console.error('[Customer] Failed to find or create customer in updateOrder:', {
            name,
            phone,
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          })
        }
      }
    }
  }
  
  const { data, error } = await supabaseDb
    .from('orders')
    .update(order)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  
  const fullOrder = await getOrder(id)
  if (!fullOrder) throw new Error('Failed to retrieve updated order')
  
  return fullOrder
}

export async function deleteOrder(id: string): Promise<void> {
  // 1. 先获取订单信息，以便后续清理
  const { data: order, error: orderError } = await supabaseDb
    .from('orders')
    .select(`
      id,
      status,
      order_items:order_items(id, item_id, device_id)
    `)
    .eq('id', id)
    .single()
  
  if (orderError) throw orderError
  if (!order) throw new Error('Order not found')
  
  // 2. 恢复资产状态为 available
  if (order.order_items && order.order_items.length > 0) {
    const itemIds = order.order_items
      .map((oi: any) => oi.item_id)
      .filter((id: string | null): id is string => !!id && id.trim() !== '')
    
    if (itemIds.length > 0) {
      // 恢复所有订单项中的资产状态
      const { error: itemsError } = await supabaseDb
        .from('items')
        .update({ status: 'available' })
        .in('id', itemIds)
      
      if (itemsError) {
        console.error(`Failed to restore items status for order ${id}:`, itemsError)
        // 不阻断删除流程，但记录错误
      } else {
        console.log(`Restored ${itemIds.length} items status to available for order ${id}`)
      }
    }
  }
  
  // 3. 结束账号绑定记录
  // 查找该订单相关的绑定记录，设置 bind_end_date
  const { data: bindings, error: bindingsError } = await supabaseDb
    .from('item_account_bindings')
    .select('id')
    .eq('order_id', id)
    .is('bind_end_date', null)
  
  if (!bindingsError && bindings && bindings.length > 0) {
    const today = new Date().toISOString().split('T')[0]
    const { error: updateBindingsError } = await supabaseDb
      .from('item_account_bindings')
      .update({ bind_end_date: today })
      .eq('order_id', id)
      .is('bind_end_date', null)
    
    if (updateBindingsError) {
      console.error(`Failed to end account bindings for order ${id}:`, updateBindingsError)
    } else {
      console.log(`Ended ${bindings.length} account bindings for order ${id}`)
    }
  }
  
  // 4. 删除自动创建的交易记录（只删除 auto_created = true 的记录）
  const { data: transactions, error: transactionsError } = await supabaseDb
    .from('transactions')
    .select('id')
    .eq('order_id', id)
    .eq('auto_created', true)
  
  if (!transactionsError && transactions && transactions.length > 0) {
    const transactionIds = transactions.map((t: any) => t.id)
    const { error: deleteTransactionsError } = await supabaseDb
      .from('transactions')
      .delete()
      .in('id', transactionIds)
    
    if (deleteTransactionsError) {
      console.error(`Failed to delete auto-created transactions for order ${id}:`, deleteTransactionsError)
    } else {
      console.log(`Deleted ${transactions.length} auto-created transactions for order ${id}`)
    }
  }
  
  // 5. 最后删除订单（会级联删除 order_items, third_party_rentals, shipping_fees）
  // 使用 .select() 确认实际删除行数：RLS 拒绝删除时 PostgREST 常返回 error=null 且 0 行，前端会误以为成功
  const { data: deletedRows, error } = await supabaseDb
    .from('orders')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) throw error
  if (!deletedRows || deletedRows.length === 0) {
    const err = new Error('ORDER_DELETE_NO_ROWS') as Error & { code?: string }
    err.code = 'ORDER_DELETE_NO_ROWS'
    throw err
  }
}

// 交易查询（支持筛选）
export async function getTransactions(
  itemId?: string,
  filters?: {
    startDate?: string
    endDate?: string
    type?: 'income' | 'expense'
    category?: string
    business_plate?: BusinessPlate | 'all'
    creator_channel?: CreatorChannel | 'all'
  }
): Promise<Transaction[]> {
  let query = supabaseDb
    .from('transactions')
    .select(`
      *,
      order:orders(*),
      item:items(*)
    `)

  if (itemId) query = query.eq('item_id', itemId)
  if (filters?.startDate) query = query.gte('transaction_date', filters.startDate)
  if (filters?.endDate) query = query.lte('transaction_date', filters.endDate)
  if (filters?.type) query = query.eq('type', filters.type)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.business_plate && filters.business_plate !== 'all') {
    query = query.eq('business_plate', filters.business_plate)
  }
  if (filters?.creator_channel && filters.creator_channel !== 'all') {
    query = query.eq('creator_channel', filters.creator_channel)
  }

  const { data, error } = await query
  if (error) throw error

  const sorted = (data || []).sort((a, b) => {
    const getSortDate = (tx: any): string => {
      if (tx.order_id && tx.order?.updated_at) return tx.order.updated_at
      return tx.transaction_date ? `${tx.transaction_date}T23:59:59Z` : '1970-01-01T00:00:00Z'
    }
    return getSortDate(b).localeCompare(getSortDate(a))
  })

  return sorted
}

export async function createTransaction(
  transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'business_plate' | 'creator_channel'> &
    Partial<Pick<Transaction, 'business_plate' | 'creator_channel'>>
): Promise<Transaction> {
  const normalized = normalizeTransactionPlateInput(transaction)
  const payload = {
    ...transaction,
    business_plate: normalized.business_plate,
    creator_channel: normalized.creator_channel,
  }
  const { data, error } = await supabaseDb.from('transactions').insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function updateTransaction(id: string, transaction: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>): Promise<Transaction> {
  const { data, error } = await supabaseDb
    .from('transactions')
    .update(transaction)
    .eq('id', id)
    .select('*')
    .single()
  
  if (error) throw error
  return data
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await supabaseDb
    .from('transactions')
    .select(`
      *,
      order:orders(*),
      item:items(*)
    `)
    .eq('id', id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabaseDb
    .from('transactions')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ============================================
// 游戏账号查询（已废弃，游戏账号现在作为资产管理）
// ============================================
// 游戏账号管理功能已移除，游戏账号现在作为 items 表中的资产进行管理
// 账号绑定记录保存在 item_account_bindings 表中

// ============================================
// 账号绑定查询
// ============================================

export async function getAccountBindings(
  activeOnly?: boolean // 是否只返回当前活跃的绑定（bind_end_date 为 NULL）
): Promise<ItemAccountBinding[]> {
  // 注意：此函数可能在服务器端调用，使用共享的客户端实例
  // 如果需要在服务器端使用服务端密钥，应该在 API 路由中处理
  let query = supabaseDb
    .from('item_account_bindings')
    .select(`
      *,
      account_item:items!account_item_id(*, category:categories(*)),
      device_item:items!device_item_id(*, category:categories(*)),
      order:orders(*)
    `)
  
  // 如果只查询活跃绑定，添加条件
  if (activeOnly) {
    query = query.is('bind_end_date', null)
  }
  
  const { data, error } = await query
    .order('bind_start_date', { ascending: false })
  
  if (error) throw error
  return data || []
}

// ============================================
// 客户查询
// ============================================

function normalizeCustomerNameForMatch(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

function normalizePhoneDigitsForMatch(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

/** 未写 customer_id 的历史羽毛球订单，按姓名/电话与档案对齐后计入统计（避免老单永远不进累计） */
function badmintonOrphanMatchesCustomer(
  o: { customer_name?: string | null; customer_phone?: string | null },
  c: Customer,
  sameNormalizedNameCount: number
): boolean {
  if (normalizeCustomerNameForMatch(o.customer_name) !== normalizeCustomerNameForMatch(c.name)) return false
  const od = normalizePhoneDigitsForMatch(o.customer_phone)
  const cd = normalizePhoneDigitsForMatch(c.phone)
  if (od.length > 0 && cd.length > 0) return od === cd
  if (sameNormalizedNameCount !== 1) return false
  if (od.length === 0 && cd.length === 0) return true
  if (od.length === 0 && cd.length > 0) return true
  return false
}

/** 与 getCustomers 去重规则一致：同电话优先，否则同邮箱，否则同名（小写）；均无则用 id 避免空键与 null 崩溃 */
function rollupKeyForCustomerRow(c: {
  id: string
  name?: string | null
  phone?: string | null
  email?: string | null
}): string {
  return (
    c.phone?.trim() ||
    c.email?.trim() ||
    (c.name ?? '').trim().toLowerCase() ||
    `__id__${c.id}`
  )
}

/** 与列表页聚合一致：同一逻辑客户的所有 customers.id（含重复建档） */
async function getMergedCustomerIdsRollup(seedCustomerId: string): Promise<string[]> {
  const { data: seed, error: seedErr } = await supabaseDb
    .from('customers')
    .select('id, name, phone, email')
    .eq('id', seedCustomerId)
    .single()

  if (seedErr || !seed) return [seedCustomerId]

  const { data: allRows, error: allErr } = await supabaseDb
    .from('customers')
    .select('id, name, phone, email')
    .range(0, 9999)

  if (allErr || !allRows?.length) return [seedCustomerId]

  const k = rollupKeyForCustomerRow(seed)
  const ids = allRows.filter((r) => rollupKeyForCustomerRow(r) === k).map((r) => r.id)
  return ids.length > 0 ? ids : [seed.id]
}

export async function getCustomers(): Promise<Customer[]> {
  
  // 先查询总数量进行对比
  const { count: totalCount } = await supabaseDb
    .from('customers')
    .select('*', { count: 'exact', head: true })
  
  const { data, error } = await supabaseDb
    .from('customers')
    .select('*', { count: 'exact' })
    .order('last_order_date', { ascending: false, nullsFirst: false })
    .range(0, 9999) // 明确指定范围，确保获取所有记录（最多9999条）
  
  if (error) {
    throw error
  }
  
  // 去重：每个客户只保留最新的一条记录
  // 使用 phone > email > name 作为唯一标识
  if (data && data.length > 0) {
    const customerMap = new Map<string, Customer>()
    
    for (const customer of data) {
      // 生成唯一键：优先使用 phone，其次 email，最后 name（与 rollupKeyForCustomerRow 一致）
      const key = rollupKeyForCustomerRow(customer)
      
      const existing = customerMap.get(key)
      
      if (!existing) {
        // 首次遇到这个客户，直接添加
        customerMap.set(key, customer)
      } else {
        // 已存在，比较 last_order_date，保留最新的
        const existingDate = existing.last_order_date ? new Date(existing.last_order_date) : null
        const currentDate = customer.last_order_date ? new Date(customer.last_order_date) : null
        
        if (currentDate && (!existingDate || currentDate > existingDate)) {
          // 当前记录的订单日期更新，替换
          customerMap.set(key, customer)
        } else if (!currentDate && !existingDate) {
          // 都没有订单日期，比较 created_at
          const existingCreated = existing.created_at ? new Date(existing.created_at) : null
          const currentCreated = customer.created_at ? new Date(customer.created_at) : null
          if (currentCreated && (!existingCreated || currentCreated > existingCreated)) {
            customerMap.set(key, customer)
          }
        }
      }
    }
    
    const deduplicatedCustomers = Array.from(customerMap.values())
    
    // 从实际订单表重新计算每个客户的统计信息
    // 先收集所有相同客户的ID（用于合并订单统计）
    const customerIdGroups = new Map<string, string[]>() // key -> customer IDs
    
    for (const customer of deduplicatedCustomers) {
      const key = rollupKeyForCustomerRow(customer)

      if (!customerIdGroups.has(key)) {
        customerIdGroups.set(key, [])
      }

      // 添加当前客户ID
      customerIdGroups.get(key)!.push(customer.id)
      
      // 添加所有匹配的旧客户ID
      for (const otherCustomer of data) {
        const otherKey = rollupKeyForCustomerRow(otherCustomer)
        if (otherKey === key && otherCustomer.id !== customer.id) {
          customerIdGroups.get(key)!.push(otherCustomer.id)
        }
      }
    }

    const sameNameCount = new Map<string, number>()
    for (const c of deduplicatedCustomers) {
      const n = normalizeCustomerNameForMatch(c.name)
      sameNameCount.set(n, (sameNameCount.get(n) ?? 0) + 1)
    }

    const { data: orphanBadmintonRows, error: orphanBadmintonErr } = await supabaseDb
      .from('orders')
      .select('id, total_amount, start_date, service_date, order_type, customer_id, customer_name, customer_phone')
      .eq('order_type', 'badminton')
      .is('customer_id', null)

    if (orphanBadmintonErr) {
      console.error('[Customers] orphan badminton orders fetch failed:', orphanBadmintonErr)
    }
    const orphanBadmintonOrders = orphanBadmintonRows || []
    
    // 为每个去重后的客户重新计算统计信息（合并所有相同客户的订单）
    for (const customer of deduplicatedCustomers) {
      const key = rollupKeyForCustomerRow(customer)

      const rawIds = customerIdGroups.get(key)
      const customerIds = rawIds && rawIds.length > 0 ? rawIds : [customer.id]
      
      // 查询所有使用这些客户ID的订单（包括历史记录，包括租赁和羽毛球订单）
      const { data: orders, error: ordersError } = await supabaseDb
        .from('orders')
        .select('id, total_amount, start_date, service_date, order_type, customer_id')
        .in('customer_id', customerIds)

      if (ordersError) {
        console.error('[Customers] orders by customer_id fetch failed:', ordersError)
      }

      const idLinkedOrders = !ordersError && orders ? orders : []
      const nameKey = normalizeCustomerNameForMatch(customer.name)
      const nameDupCount = sameNameCount.get(nameKey) ?? 1

      const matchedOrphans = orphanBadmintonOrders.filter((o) =>
        badmintonOrphanMatchesCustomer(o, customer, nameDupCount)
      )

      const mergedById = new Map<string, (typeof idLinkedOrders)[0] | (typeof orphanBadmintonOrders)[0]>()
      for (const o of idLinkedOrders) mergedById.set(o.id, o)
      for (const o of matchedOrphans) mergedById.set(o.id, o)
      const uniqueOrders = [...mergedById.values()]

      if (uniqueOrders.length > 0) {
        // 重新计算统计信息（含历史上未写 customer_id 的羽毛球单，在姓名/电话可对上时并入）
        customer.total_orders = uniqueOrders.length
        customer.total_amount = uniqueOrders.reduce(
          (sum, o) => sum + (parseFloat(o.total_amount?.toString() || '0') || 0),
          0
        )

        const badmintonOrders = uniqueOrders.filter((o) => (o as { order_type?: string }).order_type === 'badminton')
        customer.badminton_order_count = badmintonOrders.length
        customer.badminton_total_amount = badmintonOrders.reduce(
          (sum, o) => sum + (parseFloat(o.total_amount?.toString() || '0') || 0),
          0
        )
        
        // 计算最早和最晚订单日期（羽毛球订单使用 service_date，租赁订单使用 start_date）
        const orderDates = uniqueOrders
          .map(o => {
            const order = o as any
            return order.order_type === 'badminton' && order.service_date
              ? order.service_date
              : o.start_date
          })
          .filter((date): date is string => !!date)
          .sort()
        
        if (orderDates.length > 0) {
          customer.first_order_date = orderDates[0]
          customer.last_order_date = orderDates[orderDates.length - 1]
        }
      }
    }
    
    // 按 last_order_date 重新排序（最新的在前）
    // 如果 last_order_date 相同，则按 created_at 排序（新创建的客户优先）
    deduplicatedCustomers.sort((a, b) => {
      const dateA = a.last_order_date ? new Date(a.last_order_date).getTime() : 0
      const dateB = b.last_order_date ? new Date(b.last_order_date).getTime() : 0
      if (dateB !== dateA) {
        return dateB - dateA // 降序
      }
      // 如果 last_order_date 相同，按 created_at 降序（新创建的在前）
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    })
    
    return deduplicatedCustomers
  }
  
  return data || []
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data: customer, error } = await supabaseDb.from('customers').select('*').eq('id', id).single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }

  const { data: allRows } = await supabaseDb.from('customers').select('id, name, phone, email').range(0, 9999)
  let mergedIds =
    allRows && allRows.length > 0
      ? allRows
          .filter((r) => rollupKeyForCustomerRow(r) === rollupKeyForCustomerRow(customer))
          .map((r) => r.id)
      : [customer.id]
  if (!mergedIds.length) mergedIds = [customer.id]

  const sameNameCount = new Map<string, number>()
  for (const r of allRows || []) {
    const n = normalizeCustomerNameForMatch(r.name)
    sameNameCount.set(n, (sameNameCount.get(n) ?? 0) + 1)
  }
  const nameDupCount = sameNameCount.get(normalizeCustomerNameForMatch(customer.name)) ?? 1

  const { data: idLinkedOrders, error: ordersError } = await supabaseDb
    .from('orders')
    .select(
      'id, order_number, start_date, end_date, service_date, total_amount, status, created_at, order_type, customer_id'
    )
    .in('customer_id', mergedIds)
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('[getCustomer] orders fetch failed:', ordersError)
  }

  const { data: orphanRows, error: orphanErr } = await supabaseDb
    .from('orders')
    .select(
      'id, order_number, start_date, end_date, service_date, total_amount, status, created_at, order_type, customer_id, customer_name, customer_phone'
    )
    .eq('order_type', 'badminton')
    .is('customer_id', null)

  if (orphanErr) {
    console.error('[getCustomer] orphan badminton fetch failed:', orphanErr)
  }
  const orphanBadmintonOrders = orphanRows || []

  const matchedOrphans = orphanBadmintonOrders.filter((o) =>
    badmintonOrphanMatchesCustomer(o, customer, nameDupCount)
  )

  const mergedById = new Map<string, Record<string, unknown>>()
  for (const o of idLinkedOrders || []) mergedById.set(o.id as string, o as Record<string, unknown>)
  for (const o of matchedOrphans) mergedById.set(o.id as string, o as Record<string, unknown>)
  const uniqueOrders = [...mergedById.values()].sort(
    (a, b) =>
      new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime()
  )

  if (uniqueOrders.length > 0) {
    customer.total_orders = uniqueOrders.length
    customer.total_amount = uniqueOrders.reduce(
      (sum, o) => sum + (parseFloat(String(o.total_amount ?? 0)) || 0),
      0
    )

    const badmintonOrders = uniqueOrders.filter((o) => o.order_type === 'badminton')
    customer.badminton_order_count = badmintonOrders.length
    customer.badminton_total_amount = badmintonOrders.reduce(
      (sum, o) => sum + (parseFloat(String(o.total_amount ?? 0)) || 0),
      0
    )

    const orderDates = uniqueOrders
      .map((o) => {
        return o.order_type === 'badminton' && o.service_date ? String(o.service_date) : String(o.start_date || '')
      })
      .filter((d): d is string => !!d)
      .sort()

    if (orderDates.length > 0) {
      customer.first_order_date = orderDates[0]!
      customer.last_order_date = orderDates[orderDates.length - 1]!
    }
  } else {
    customer.total_orders = 0
    customer.total_amount = 0
    customer.badminton_order_count = 0
    customer.badminton_total_amount = 0
  }

  return { ...customer, orders: uniqueOrders as unknown as Order[] }
}

// 删除客户（安全删除：检查是否有关联订单）
export async function deleteCustomer(id: string): Promise<void> {
  const mergedIds = await getMergedCustomerIdsRollup(id)

  // 1. 检查是否有关联订单（与列表聚合一致：同键合并的档案下任一 customer_id 有订单即不可删）
  const { data: orders, error: ordersError } = await supabaseDb
    .from('orders')
    .select('id, order_number, status')
    .in('customer_id', mergedIds)
    .limit(1)
  
  if (ordersError) {
    throw new Error(`检查关联订单失败: ${ordersError.message}`)
  }
  
  if (orders && orders.length > 0) {
    // 获取总订单数（用于错误消息）
    const { count, error: countError } = await supabaseDb
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('customer_id', mergedIds)
    
    if (countError) {
      // 如果获取总数失败，至少我们知道至少有一个订单
      throw new Error(`无法删除客户：该客户还有关联订单。请先删除所有订单后再删除客户。`)
    }
    
    throw new Error(`无法删除客户：该客户还有 ${count || orders.length} 个关联订单。请先删除所有订单后再删除客户。`)
  }
  
  // 2. 如果没有关联订单，执行删除
  const { error } = await supabaseDb
    .from('customers')
    .delete()
    .eq('id', id)
  
  if (error) {
    throw new Error(`删除客户失败: ${error.message}`)
  }
}

// 根据客户信息查找或创建客户档案
export async function findOrCreateCustomer(
  name: string,
  phone: string | null,
  email: string | null
): Promise<Customer> {
  if (!name || name.trim() === '') {
    throw new Error('客户姓名不能为空')
  }

  // 1. 尝试通过手机号查找
  if (phone && phone.trim() !== '') {
    const { data: customerByPhone, error: phoneError } = await supabaseDb
      .from('customers')
      .select('*')
      .eq('phone', phone.trim())
      .maybeSingle()
    
    if (phoneError) {
      console.error('[Customer] Error searching by phone:', phoneError)
    }
    
    if (customerByPhone) {
      console.log(`[Customer] Found existing customer by phone: ${customerByPhone.name} (ID: ${customerByPhone.id})`)
      // 更新最后下单日期和订单数
      const { error: updateError } = await supabaseDb
        .from('customers')
        .update({
          last_order_date: new Date().toISOString().split('T')[0],
          total_orders: customerByPhone.total_orders + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerByPhone.id)
      
      if (updateError) {
        console.error('[Customer] Error updating customer stats:', updateError)
      }
      
      return { ...customerByPhone, total_orders: customerByPhone.total_orders + 1 }
    }
  }

  // 2. 尝试通过邮箱查找
  if (email && email.trim() !== '') {
    const { data: customerByEmail, error: emailError } = await supabaseDb
      .from('customers')
      .select('*')
      .eq('email', email.trim())
      .maybeSingle()
    
    if (emailError) {
      console.error('[Customer] Error searching by email:', emailError)
    }
    
    if (customerByEmail) {
      console.log(`[Customer] Found existing customer by email: ${customerByEmail.name} (ID: ${customerByEmail.id})`)
      // 更新最后下单日期和订单数
      const { error: updateError } = await supabaseDb
        .from('customers')
        .update({
          last_order_date: new Date().toISOString().split('T')[0],
          total_orders: customerByEmail.total_orders + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerByEmail.id)
      
      if (updateError) {
        console.error('[Customer] Error updating customer stats:', updateError)
      }
      
      return { ...customerByEmail, total_orders: customerByEmail.total_orders + 1 }
    }
  }

  // 3. 如果都没找到，创建新客户
  const today = new Date().toISOString().split('T')[0]
  const customerData = {
    name: name.trim(),
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    first_order_date: today,
    last_order_date: today,
    total_orders: 1,
    total_amount: 0, // 会在订单创建后更新
  }
  
  console.log('[Customer] Creating new customer:', customerData)
  
  const { data: newCustomer, error } = await supabaseDb
    .from('customers')
    .insert(customerData)
    .select()
    .single()
  
  if (error) {
    console.error('[Customer] Failed to create customer:', {
      data: customerData,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    
    // 如果创建失败（可能是唯一约束冲突），再次尝试查找
    if (phone && phone.trim() !== '') {
      const { data: existing } = await supabaseDb
        .from('customers')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle()
      if (existing) {
        console.log(`[Customer] Found existing customer after creation conflict: ${existing.name} (ID: ${existing.id})`)
        return existing
      }
    }
    if (email && email.trim() !== '') {
      const { data: existing } = await supabaseDb
        .from('customers')
        .select('*')
        .eq('email', email.trim())
        .maybeSingle()
      if (existing) {
        console.log(`[Customer] Found existing customer after creation conflict: ${existing.name} (ID: ${existing.id})`)
        return existing
      }
    }
    throw error
  }
  
  console.log(`[Customer] Successfully created new customer: ${newCustomer.name} (ID: ${newCustomer.id})`)
  return newCustomer
}

// 更新客户统计信息（订单金额）
export async function updateCustomerStats(
  customerId: string,
  orderAmount: number,
  isNewOrder: boolean = true
): Promise<void> {
  if (isNewOrder && orderAmount) {
    // 新增订单，累加金额
    const { data: customer } = await supabaseDb
      .from('customers')
      .select('total_amount')
      .eq('id', customerId)
      .single()
    
    if (customer) {
      await supabaseDb
        .from('customers')
        .update({ 
          total_amount: (customer.total_amount || 0) + orderAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
    }
  }
}

// ============================================
// 订单项查询
// ============================================

export async function createOrderItem(item: Omit<OrderItem, 'id' | 'created_at' | 'updated_at' | 'item' | 'device'>): Promise<OrderItem> {
  const { data, error } = await supabaseDb
    .from('order_items')
    .insert(item)
    .select(`
      *,
      item:items!item_id(*, category:categories(*)),
      device:items!device_id(*, category:categories(*))
    `)
    .single()
  
  if (error) throw error
  return data
}

export async function updateOrderItem(id: string, item: Partial<Omit<OrderItem, 'id' | 'order_id' | 'created_at' | 'updated_at' | 'item' | 'device'>>): Promise<OrderItem> {
  const { data, error } = await supabaseDb
    .from('order_items')
    .update(item)
    .eq('id', id)
    .select(`
      *,
      item:items!item_id(*, category:categories(*)),
      device:items!device_id(*, category:categories(*))
    `)
    .single()
  
  if (error) throw error
  return data
}

export async function deleteOrderItem(id: string): Promise<void> {
  const { error } = await supabaseDb
    .from('order_items')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ============================================
// 第三方租赁查询
// ============================================

export async function createThirdPartyRental(rental: Omit<ThirdPartyRental, 'id' | 'created_at' | 'updated_at'>): Promise<ThirdPartyRental> {
  const { data, error } = await supabaseDb
    .from('third_party_rentals')
    .insert(rental)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateThirdPartyRental(id: string, rental: Partial<Omit<ThirdPartyRental, 'id' | 'order_id' | 'created_at' | 'updated_at'>>): Promise<ThirdPartyRental> {
  const { data, error } = await supabaseDb
    .from('third_party_rentals')
    .update(rental)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deleteThirdPartyRental(id: string): Promise<void> {
  const { error } = await supabaseDb
    .from('third_party_rentals')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ============================================
// 物流费用查询
// ============================================

export async function createShippingFee(fee: Omit<ShippingFee, 'id' | 'created_at' | 'updated_at'>): Promise<ShippingFee> {
  const { data, error } = await supabaseDb
    .from('shipping_fees')
    .insert(fee)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateShippingFee(id: string, fee: Partial<Omit<ShippingFee, 'id' | 'order_id' | 'created_at' | 'updated_at'>>): Promise<ShippingFee> {
  const { data, error } = await supabaseDb
    .from('shipping_fees')
    .update(fee)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deleteShippingFee(id: string): Promise<void> {
  const { error } = await supabaseDb
    .from('shipping_fees')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ============================================
// 购置融资（MVP）
// ============================================

export async function getFinancingLoans(itemId?: string): Promise<FinancingLoan[]> {
  let q = supabaseDb
    .from('financing_loans')
    .select(`*, item:items(*, category:categories(*))`)
    .order('created_at', { ascending: false })
  if (itemId) q = q.eq('item_id', itemId)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as FinancingLoan[]
}

export async function getFinancingLoanById(id: string): Promise<FinancingLoan | null> {
  const { data, error } = await supabaseDb
    .from('financing_loans')
    .select(`*, item:items(*, category:categories(*))`)
    .eq('id', id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as FinancingLoan
}

export async function getFinancingLoanPayments(loanId: string): Promise<FinancingLoanPayment[]> {
  const { data, error } = await supabaseDb
    .from('financing_loan_payments')
    .select('*')
    .eq('loan_id', loanId)
    .order('payment_date', { ascending: false })
  if (error) throw error
  return (data || []) as FinancingLoanPayment[]
}

export async function createFinancingLoan(
  row: Omit<FinancingLoan, 'id' | 'created_at' | 'updated_at' | 'status' | 'item' | 'principal_remaining'> & {
    principal_remaining?: number
    status?: FinancingLoan['status']
  }
): Promise<FinancingLoan> {
  const principal_remaining = row.principal_remaining ?? row.principal_total
  const { data, error } = await supabaseDb
    .from('financing_loans')
    .insert({
      item_id: row.item_id,
      title: row.title ?? null,
      principal_total: row.principal_total,
      principal_remaining,
      annual_rate_percent: row.annual_rate_percent,
      repayment_day_of_month: row.repayment_day_of_month,
      start_date: row.start_date,
      status: row.status ?? 'active',
      notes: row.notes ?? null,
    })
    .select(`*, item:items(*, category:categories(*))`)
    .single()
  if (error) throw error
  return data as FinancingLoan
}
