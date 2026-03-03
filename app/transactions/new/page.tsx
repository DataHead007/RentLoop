import { TransactionForm } from '@/components/transactions/TransactionForm'

export default function NewTransactionPage({
  searchParams,
}: {
  searchParams: { itemId?: string; orderId?: string }
}) {
  return (
    <div className="container mx-auto py-8">
      <TransactionForm itemId={searchParams?.itemId} orderId={searchParams?.orderId} />
    </div>
  )
}
