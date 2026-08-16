import { Suspense } from 'react'
import { TransactionList } from '@/components/transactions/TransactionList'

export default function CreatorTransactionsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded bg-muted" />}>
      <TransactionList initialScope="creator" />
    </Suspense>
  )
}
