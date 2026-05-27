import type { Transaction } from '@/lib/types/database'

const ORDER_DESC_PREFIX_RE = /^订单\s+(\S+)/

/** 从描述解析订单编号片段（常为 order_number 前 8 位） */
export function parseOrderTokenFromDescription(description: string | null | undefined): string | null {
  if (!description) return null
  const match = description.match(ORDER_DESC_PREFIX_RE)
  return match?.[1] ?? null
}

export function getTransactionOrderId(transaction: Transaction): string | null {
  if (transaction.order_id) return transaction.order_id
  if (transaction.order?.id) return transaction.order.id
  return null
}

export function getOrderDetailHref(orderId: string): string {
  return `/orders/${orderId}`
}

export function getTransactionOrderLabel(transaction: Transaction): string | null {
  const orderId = getTransactionOrderId(transaction)
  if (!orderId) return null
  const num = transaction.order?.order_number
  if (num) return `订单 ${num}`
  const token = parseOrderTokenFromDescription(transaction.description)
  if (token) return `订单 ${token}`
  return `订单 ${orderId.slice(0, 8)}`
}

type OrderLookup = { id: string; order_number: string | null }

/** 为缺失 order_id 但描述含「订单 xxx」的交易补全关联（仅限该资产相关订单） */
export function enrichTransactionsWithOrderIds(
  transactions: Transaction[],
  relatedOrders: OrderLookup[]
): Transaction[] {
  if (relatedOrders.length === 0) return transactions

  const findOrderId = (token: string): string | null => {
    const hit = relatedOrders.find(
      (o) =>
        o.id === token ||
        o.id.startsWith(token) ||
        (o.order_number != null &&
          (o.order_number === token || o.order_number.startsWith(token)))
    )
    return hit?.id ?? null
  }

  return transactions.map((tx) => {
    const existing = getTransactionOrderId(tx)
    if (existing) return tx.order_id ? tx : { ...tx, order_id: existing }

    const token = parseOrderTokenFromDescription(tx.description)
    if (!token) return tx

    const resolved = findOrderId(token)
    return resolved ? { ...tx, order_id: resolved } : tx
  })
}
