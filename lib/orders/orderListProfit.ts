import type { Order, OrderItem } from '@/lib/types/database'
import { calculateNetAmountFromSubtotal, DEFAULT_FEE_RATE } from '@/lib/orders/feeRate'

/** 订单列表利润成本：物流 + 第三方转租实际成本（不含可退押金、维护/赔偿） */
export function getOrderListProfitCost(order: Pick<Order, 'total_shipping_cost' | 'third_party_rentals'>): number {
  const shipping = Number(order.total_shipping_cost) || 0
  const thirdPartyCost = (order.third_party_rentals || []).reduce(
    (sum, r) => sum + (r.rental_cost ?? 0),
    0
  )
  return shipping + thirdPartyCost
}

/** 单行到账净额：优先 net_amount，否则按 subtotal 与费率推算 */
function getOrderItemReceivedAmount(item: Pick<OrderItem, 'subtotal' | 'net_amount' | 'fee_rate' | 'quantity'>): number {
  const qty = item.quantity || 1
  if (item.net_amount != null && Number.isFinite(Number(item.net_amount))) {
    return Number(item.net_amount) * qty
  }
  return calculateNetAmountFromSubtotal(Number(item.subtotal) || 0, item.fee_rate ?? DEFAULT_FEE_RATE) * qty
}

/**
 * 列表「净利润」口径（到账净额）：
 * 租赁：Σ(到账净额) − 物流 − 第三方转租成本
 * 羽毛球：total_amount 已是净额
 * 不含维护、赔偿、客户押金、付供应商可退押金。
 */
export function getOrderListNetProfit(
  order: Pick<
    Order,
    'total_amount' | 'total_shipping_cost' | 'third_party_rentals' | 'order_type' | 'order_items'
  >
): number {
  if (order.order_type === 'badminton') {
    return Number(order.total_amount) || 0
  }

  const items = order.order_items || []
  const received =
    items.length > 0
      ? items.reduce((sum, item) => sum + getOrderItemReceivedAmount(item), 0)
      : Number(order.total_amount) || 0

  return received - getOrderListProfitCost(order)
}

export function getOrderListNetProfitTitle(
  order: Pick<
    Order,
    'total_amount' | 'total_shipping_cost' | 'third_party_rentals' | 'order_type' | 'order_items'
  >
): string {
  if (order.order_type === 'badminton') {
    return '羽毛球订单净额（收入 − 支出明细）'
  }
  const items = order.order_items || []
  const received =
    items.length > 0
      ? items.reduce((sum, item) => sum + getOrderItemReceivedAmount(item), 0)
      : Number(order.total_amount) || 0
  const shipping = Number(order.total_shipping_cost) || 0
  const thirdPartyCost = (order.third_party_rentals || []).reduce(
    (sum, r) => sum + (r.rental_cost ?? 0),
    0
  )
  return `到账净额 ${received.toFixed(2)} − 物流 ${shipping} − 转租 ${thirdPartyCost}（已扣手续费，不含维护/赔偿）`
}
