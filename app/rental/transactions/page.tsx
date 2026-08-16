import { Suspense } from 'react'
import { TransactionList } from '@/components/transactions/TransactionList'

export default function RentalTransactionsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 rounded bg-muted" />}>
      <TransactionList initialScope="rental" />
    </Suspense>
  )
}
