import { TransactionForm } from '@/components/transactions/TransactionForm'

export default function EditTransactionPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8">
      <TransactionForm transactionId={params.id} />
    </div>
  )
}
