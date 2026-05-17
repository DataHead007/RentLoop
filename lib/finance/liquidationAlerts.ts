/**
 * P5：资产已清算（售出）后的 ALM 提示
 * - 红：融资剩余本金 > 0（变卖收入不会自动冲减负债）。
 * - 黄：融资本金已清，但 ALM 黄段（经营尚未覆盖的自有购置缺口）仍 > 0。
 */

import type { Item } from '@/lib/types/database'
import { computeAlmStackSegments } from '@/lib/finance/almItemWaterfall'

export function isItemLiquidated(item: Pick<Item, 'status' | 'sold_price' | 'sale_date'>): boolean {
  if (item.status === 'sold') return true
  return !!(item.sold_price && item.sold_price > 0 && item.sale_date)
}

export type PostSaleLiquidationAlert =
  | { level: 'red'; debtRemaining: number }
  | { level: 'yellow'; ownGapRemaining: number }

export function getPostSaleLiquidationAlert(input: {
  liquidated: boolean
  effectivePurchase: number
  financingPrincipalRemaining: number
  paybackRemaining: number
  paybackExcess: number
}): PostSaleLiquidationAlert | null {
  if (!input.liquidated || input.effectivePurchase <= 0) return null

  const L = Math.max(0, input.financingPrincipalRemaining)
  if (L >= 0.01) {
    return { level: 'red', debtRemaining: Math.round(L * 100) / 100 }
  }

  const stack = computeAlmStackSegments({
    effectivePurchase: input.effectivePurchase,
    unpaidLoanPrincipal: L,
    paybackRemaining: input.paybackRemaining,
    paybackExcess: input.paybackExcess,
  })

  if (stack.yellowAmount >= 0.01) {
    return { level: 'yellow', ownGapRemaining: stack.yellowAmount }
  }

  return null
}
