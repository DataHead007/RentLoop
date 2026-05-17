import { TransactionList } from '@/components/transactions/TransactionList'

export default function RentalTransactionsPage() {
  return (
    <div className="container mx-auto min-w-0 max-w-full px-3 py-4 sm:px-4 md:px-6 md:py-8">
      <TransactionList initialScope="rental" />
    </div>
  )
}

