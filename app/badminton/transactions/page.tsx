import { Suspense } from 'react'
import { TransactionList } from '@/components/transactions/TransactionList'

export default function BadmintonTransactionsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded bg-muted" />}>
      <TransactionList initialScope="badminton" />
    </Suspense>
  )
}
