'use client'

import Link from 'next/link'
import type { Transaction } from '@/lib/types/database'
import {
  getOrderDetailHref,
  getTransactionOrderId,
  getTransactionOrderLabel,
  parseOrderTokenFromDescription,
} from '@/lib/transactions/transactionOrderLink'
import { cn } from '@/lib/utils'

type TransactionDescriptionLinkProps = {
  transaction: Transaction
  className?: string
}

export function TransactionDescriptionLink({ transaction, className }: TransactionDescriptionLinkProps) {
  const orderId = getTransactionOrderId(transaction)
  const description = transaction.description?.trim()

  if (!description) {
    return <span className={cn('text-muted-foreground', className)}>—</span>
  }

  if (!orderId) {
    return <span className={cn('text-foreground/90', className)}>{description}</span>
  }

  const href = getOrderDetailHref(orderId)
  const token = parseOrderTokenFromDescription(description)
  const orderLabel = getTransactionOrderLabel(transaction)

  if (token && description.startsWith(`订单 ${token}`)) {
    const rest = description.slice(`订单 ${token}`.length)
    return (
      <span className={cn('text-foreground/90', className)}>
        <Link
          href={href}
          className="font-medium text-primary underline-offset-2 hover:underline"
          title="查看订单详情"
        >
          订单 {token}
        </Link>
        {rest}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'font-medium text-primary underline-offset-2 hover:underline',
        className
      )}
      title="查看订单详情"
    >
      {orderLabel && description.includes('订单') ? description : orderLabel || description}
    </Link>
  )
}
