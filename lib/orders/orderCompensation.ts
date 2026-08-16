import type { OrderItem } from '@/lib/types/database'

export type CompensationDirection = 'income' | 'expense'
export type CompensationAllocationMethod = 'manual' | 'rent_ratio' | 'purchase_ratio'

export const COMPENSATION_INCOME_CATEGORIES = ['赔偿收入'] as const
export const COMPENSATION_EXPENSE_CATEGORIES = ['维护费用', '物流费用', '其他支出'] as const

export interface OrderCompensationLineInput {
  order_item_id: string
  item_id: string | null
  direction: CompensationDirection
  category: string
  amount: number
  reason: string | null
  allocation_method: CompensationAllocationMethod | null
}

/** 与订单完成时分摊逻辑一致：单件行租金 = (net_amount ?? subtotal) × quantity */
export function getOrderItemRentLineAmount(item: {
  net_amount: number | null
  subtotal: number
  quantity: number
}): number {
  const unit =
    item.net_amount != null && item.net_amount > 0 ? item.net_amount : item.subtotal || 0
  return unit * (item.quantity || 1)
}

export function splitAmountByWeights(total: number, weights: number[]): number[] {
  if (total <= 0 || weights.length === 0) {
    return weights.map(() => 0)
  }
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) {
    return weights.map(() => 0)
  }

  const raw = weights.map((w) => (total * w) / sum)
  const rounded = raw.map((v) => Math.round(v * 100) / 100)
  let remainder = Math.round((total - rounded.reduce((a, b) => a + b, 0)) * 100) / 100

  if (remainder !== 0) {
    let maxIdx = 0
    for (let i = 1; i < weights.length; i++) {
      if (weights[i] > weights[maxIdx]) maxIdx = i
    }
    rounded[maxIdx] = Math.round((rounded[maxIdx] + remainder) * 100) / 100
    remainder = Math.round((total - rounded.reduce((a, b) => a + b, 0)) * 100) / 100
    if (remainder !== 0 && rounded[maxIdx] > 0) {
      rounded[maxIdx] = Math.round((rounded[maxIdx] + remainder) * 100) / 100
    }
  }

  return rounded
}

export function allocateCompensationByRentRatio(
  orderItems: OrderItem[],
  totalAmount: number,
  base: {
    direction: CompensationDirection
    category: string
    reason: string | null
  }
): OrderCompensationLineInput[] {
  const weights = orderItems.map((oi) => getOrderItemRentLineAmount(oi))
  const amounts = splitAmountByWeights(totalAmount, weights)

  return orderItems.map((oi, i) => ({
    order_item_id: oi.id,
    item_id: oi.item_id,
    direction: base.direction,
    category: base.category,
    amount: amounts[i] ?? 0,
    reason: base.reason,
    allocation_method: 'rent_ratio' as const,
  }))
}

export function allocateCompensationByPurchaseRatio(
  orderItems: OrderItem[],
  totalAmount: number,
  base: {
    direction: CompensationDirection
    category: string
    reason: string | null
  }
): OrderCompensationLineInput[] {
  const weights = orderItems.map((oi) => Math.max(0, oi.item?.purchase_price ?? 0))
  const amounts = splitAmountByWeights(totalAmount, weights)

  return orderItems.map((oi, i) => ({
    order_item_id: oi.id,
    item_id: oi.item_id,
    direction: base.direction,
    category: base.category,
    amount: amounts[i] ?? 0,
    reason: base.reason,
    allocation_method: 'purchase_ratio' as const,
  }))
}

export function buildCompensationTransactionDescription(
  orderNumber: string | null,
  orderId: string,
  itemName: string | null,
  reason: string | null
): string {
  const label = orderNumber || orderId.slice(0, 8)
  const parts = [`订单 ${label}`]
  if (itemName) parts.push(itemName)
  if (reason?.trim()) parts.push(reason.trim())
  return parts.join(' - ')
}

export function defaultCategoryForDirection(direction: CompensationDirection): string {
  return direction === 'income' ? '赔偿收入' : '维护费用'
}
