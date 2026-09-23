import type { Order } from '@/lib/types/database'

/** 订单列表利润成本：物流 + 第三方转租实际成本（不含可退押金、维护/赔偿） */
export function getOrderListProfitCost(order: Pick<Order, 'total_shipping_cost' | 'third_party_rentals'>): number {
  const shipping = Number(order.total_shipping_cost) || 0
  const thirdPartyCost = (order.third_party_rentals || []).reduce(
    (sum, r) => sum + (r.rental_cost ?? 0),
    0
  )
  return shipping + thirdPartyCost
}

/**
 * 与订单列表顶部「利润」同口径：
 * 租金/净额 −（物流 + 第三方转租成本）
 * 不含维护、赔偿、客户押金、付供应商可退押金。
 */
export function getOrderListNetProfit(
  order: Pick<Order, 'total_amount' | 'total_shipping_cost' | 'third_party_rentals' | 'order_type'>
): number {
  const income = Number(order.total_amount) || 0
  if (order.order_type === 'badminton') {
    // 羽毛球 total_amount 已是订单净额
    return income
  }
  return income - getOrderListProfitCost(order)
}

export function getOrderListNetProfitTitle(
  order: Pick<Order, 'total_amount' | 'total_shipping_cost' | 'third_party_rentals' | 'order_type'>
): string {
  if (order.order_type === 'badminton') {
    return '羽毛球订单净额（收入 − 支出明细）'
  }
  const shipping = Number(order.total_shipping_cost) || 0
  const thirdPartyCost = (order.third_party_rentals || []).reduce(
    (sum, r) => sum + (r.rental_cost ?? 0),
    0
  )
  return `租金 ${Number(order.total_amount) || 0} − 物流 ${shipping} − 转租 ${thirdPartyCost}（不含维护/赔偿）`
}
